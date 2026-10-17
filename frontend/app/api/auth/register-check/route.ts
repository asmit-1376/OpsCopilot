import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { prisma } from "@/prisma";

const roles: Role[] = ["OWNER", "COUNSELOR", "TRAINER", "ACCOUNTS", "STUDENT"];

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const role = String(body?.role ?? "") as Role;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !roles.includes(role)) {
    return NextResponse.json({ message: "Enter a valid email and choose your assigned role." }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) {
    return NextResponse.json({ message: "An account already exists for this email. Use Sign in instead." }, { status: 409 });
  }

  const invitations = await prisma.registrationInvite.findMany({
    where: {
      email,
      role,
      status: "PENDING",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true },
    take: 2,
  });
  const invitation = invitations.length === 1 ? invitations[0] : null;
  const studentProfiles = role === "STUDENT" && invitations.length === 0
    ? await prisma.student.findMany({
        where: { email: { equals: email, mode: "insensitive" }, status: "ACTIVE", userId: null },
        select: { id: true },
        take: 2,
      })
    : [];
  const student = studentProfiles.length === 1 ? studentProfiles[0] : null;
  if (invitation || student) return NextResponse.json({ ok: true });

  return NextResponse.json(
    { message: "There is no active student profile or invitation for this email and role. Ask your institute administrator to add your account first." },
    { status: 403 },
  );
}
