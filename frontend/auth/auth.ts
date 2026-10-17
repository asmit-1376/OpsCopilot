import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import type { Role } from "@prisma/client";
import { prisma } from "@/prisma";
import { sendLoginCode } from "./email";

const databaseUrl = process.env.DATABASE_URL;
const authSecret = process.env.BETTER_AUTH_SECRET;

if (!databaseUrl) throw new Error("DATABASE_URL is required to start authentication.");
if (!authSecret) throw new Error("BETTER_AUTH_SECRET is required to start authentication.");

export const auth = betterAuth({
  appName: "OpsCopilot",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: authSecret,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  advanced: { database: { generateId: "uuid" } },
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      requireEmailVerification: true,
      disableSignUp: false,
    },
  },
  user: {
    modelName: "User",
    additionalFields: {
      instituteId: { type: "string", required: false, input: false },
      requestedRole: { type: "string", required: false, input: true },
      hasLoggedIn: { type: "boolean", required: false, input: false },
      status: { type: "string", required: false, input: false },
    },
  },
  session: {
    modelName: "AuthSession",
    expiresIn: 7 * 24 * 60 * 60,
    cookieCache: {
      enabled: true,
      maxAge: 7 * 24 * 60 * 60,
      strategy: "jwe",
      version: "1",
    },
  },
  account: {
    modelName: "Account",
    storeStateStrategy: "cookie",
    storeAccountCookie: true,
    accountLinking: { enabled: true, trustedProviders: ["google"] },
  },
  verification: { modelName: "Verification" },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const email = String(user.email ?? "").trim().toLowerCase();
          const validRoles: Role[] = ["OWNER", "COUNSELOR", "TRAINER", "ACCOUNTS", "STUDENT"];
          const requestedRole = String(user.requestedRole ?? "").trim() as Role | "";
          if (!email || (requestedRole && !validRoles.includes(requestedRole))) return false;

          const invitations = await prisma.registrationInvite.findMany({
            where: {
              email,
              ...(requestedRole ? { role: requestedRole } : {}),
              status: "PENDING",
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
            orderBy: { createdAt: "desc" },
            take: 2,
          });
          const invitation = invitations.length === 1 ? invitations[0] : null;
          const studentProfiles = (!requestedRole || requestedRole === "STUDENT") && invitations.length === 0
            ? await prisma.student.findMany({
                where: { email: { equals: email, mode: "insensitive" }, status: "ACTIVE", userId: null },
                select: { instituteId: true },
                take: 2,
              })
            : [];
          const student = studentProfiles.length === 1 ? studentProfiles[0] : null;
          const role = invitation?.role ?? (student ? "STUDENT" : null);
          const instituteId = invitation?.instituteId ?? student?.instituteId;
          if (!role || !instituteId) return false;

          return {
            data: {
              ...user,
              name: String(user.name ?? invitation?.name ?? "").trim() || invitation?.name || "Institute member",
              instituteId,
              email,
              requestedRole: role,
              status: "ACTIVE",
            },
          };
        },
      },
      update: {
        before: async (user) => {
          if ("instituteId" in user || "requestedRole" in user || "status" in user) return false;
        },
      },
    },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 5,
      storeOTP: "hashed",
      sendVerificationOnSignUp: true,
      overrideDefaultEmailVerification: true,
      sendVerificationOTP: ({ email, otp, type }) =>
        type === "email-verification" || type === "forget-password"
          ? sendLoginCode(email, otp)
          : Promise.resolve(),
    }),
  ],
});
