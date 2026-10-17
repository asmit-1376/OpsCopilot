import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "@/prisma";
import { auth } from "./auth";

export const roleHome: Record<Role, string> = {
  OWNER: "/owner",
  COUNSELOR: "/counselor",
  TRAINER: "/trainer",
  ACCOUNTS: "/accounts",
  STUDENT: "/student",
};

export async function getAuthenticatedUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  // Cookie-cached sessions omit custom user fields, so resolve authorization
  // from the current database record rather than trusting cached role claims.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: { select: { role: true } } },
  });
  if (!user || !user.emailVerified || user.status !== "ACTIVE") return null;

  const role = user.roles.some(({ role }) => role === user.requestedRole)
    ? user.requestedRole
    : user.roles[0]?.role;
  if (!role) return null;

  return {
    ...session.user,
    id: user.id,
    email: user.email,
    name: user.name,
    instituteId: user.instituteId,
    role,
  };
}

export async function requireRole(allowedRole: Role) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login?error=Please%20sign%20in%20to%20continue");
  if (user.role !== allowedRole) redirect(`${roleHome[user.role]}?error=You%20do%20not%20have%20access%20to%20that%20portal`);
  return user;
}

export async function requireAnyRole(allowedRoles: readonly Role[]) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login?error=Please%20sign%20in%20to%20continue");
  if (!allowedRoles.includes(user.role)) redirect(`${roleHome[user.role]}?error=You%20do%20not%20have%20access%20to%20that%20feature`);
  return user;
}
