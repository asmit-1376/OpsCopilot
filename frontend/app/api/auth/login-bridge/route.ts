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

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      status: true,
      hasLoggedIn: true,
      requestedRole: true,
      roles: { select: { role: true } },
    },
  });

  if (user) {
    const roleMatches = user.roles.some((entry) => entry.role === role) || user.requestedRole === role;
    if (user.status !== "ACTIVE" || !roleMatches) {
      return NextResponse.json({ message: "This email is not assigned to the selected portal. Choose your assigned role or contact your administrator." }, { status: 403 });
    }
    if (user.hasLoggedIn) return NextResponse.json({ action: "sign_in" });
    return NextResponse.json({ action: "setup_existing" });
  }

  const [invites, students] = await Promise.all([
    prisma.registrationInvite.findMany({
      where: {
        email,
        role,
        status: "PENDING",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
      take: 2,
    }),
    role === "STUDENT"
      ? prisma.student.findMany({
          where: { email: { equals: email, mode: "insensitive" }, status: "ACTIVE", userId: null },
          select: { id: true },
          take: 2,
        })
      : Promise.resolve([]),
  ]);

  if (invites.length === 1 || (!invites.length && students.length === 1)) {
    return NextResponse.json({ action: "setup_new" });
  }
  return NextResponse.json(
    { message: "We couldn't find an active institute profile for this email and role. Ask your institute administrator to add your account." },
    { status: 403 },
  );
}
