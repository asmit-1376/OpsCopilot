import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { auth } from "@/auth/auth";
import { prisma } from "@/prisma";

const roles: Role[] = ["OWNER", "COUNSELOR", "TRAINER", "ACCOUNTS", "STUDENT"];

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.emailVerified) {
    return NextResponse.json({ message: "Verify your email before activating your account." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const role = String(body?.role ?? "") as Role;
  if (!roles.includes(role)) return NextResponse.json({ message: "Choose a valid portal role." }, { status: 400 });

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: session.user.id },
        include: { roles: { select: { role: true } } },
      });
      if (!user || user.status !== "ACTIVE") {
        throw new Error("The verified account does not match the role you selected.");
      }

      const alreadyAssigned = user.roles.some((entry) => entry.role === role);
      if (!alreadyAssigned && user.requestedRole !== role) {
        throw new Error("The verified account does not match the role you selected.");
      }
      const invitation = alreadyAssigned ? null : await tx.registrationInvite.findFirst({
        where: {
          instituteId: user.instituteId,
          email: user.email.toLowerCase(),
          role,
          status: "PENDING",
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });
      const studentProfile = !alreadyAssigned && role === "STUDENT" && !invitation
        ? await tx.student.findFirst({
            where: {
              instituteId: user.instituteId,
              email: { equals: user.email, mode: "insensitive" },
              status: "ACTIVE",
              userId: null,
            },
          })
        : null;
      if (!alreadyAssigned && !invitation && !studentProfile) {
        throw new Error("No active profile or invitation matches this email and role. Contact your institute administrator.");
      }

      await tx.userRole.upsert({
        where: { userId_role: { userId: user.id, role } },
        create: { userId: user.id, role },
        update: {},
      });

      if (role === "STUDENT") {
        const linked = await tx.student.findUnique({ where: { userId: user.id } });
        if (linked && linked.instituteId !== user.instituteId) {
          throw new Error("The linked student profile belongs to a different institute.");
        }
        const rosterProfile = linked ?? studentProfile ?? await tx.student.findFirst({
          where: {
            instituteId: user.instituteId,
            email: { equals: user.email, mode: "insensitive" },
            userId: null,
          },
        });
        if (rosterProfile) {
          await tx.student.update({
            where: { id: rosterProfile.id },
            data: { userId: user.id, email: user.email.toLowerCase(), name: user.name },
          });
        } else {
          await tx.student.create({
            data: { userId: user.id, instituteId: user.instituteId, email: user.email.toLowerCase(), name: user.name },
          });
        }
      }

      if (invitation) {
        await tx.registrationInvite.update({
          where: { id: invitation.id },
          data: { status: "ACCEPTED", acceptedAt: new Date() },
        });
      }

      await tx.user.update({ where: { id: user.id }, data: { hasLoggedIn: true } });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "We could not activate this account." },
      { status: 403 },
    );
  }
}
