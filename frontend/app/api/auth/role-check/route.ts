import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { auth } from "@/auth/auth";
import { prisma } from "@/prisma";

const roleDestinations: Record<Role, string> = {
  OWNER: "/owner",
  COUNSELOR: "/counselor",
  TRAINER: "/trainer",
  ACCOUNTS: "/accounts",
  STUDENT: "/student",
};

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ message: "Sign in to continue." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const role = String(body?.role ?? "") as Role;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, emailVerified: true, status: true, roles: { select: { role: true } } },
  });
  if (!user || !user.emailVerified || user.status !== "ACTIVE" || !user.roles.some((entry) => entry.role === role)) {
    return NextResponse.json(
      { message: "This email is not assigned to the selected portal. Choose your assigned role or contact your administrator." },
      { status: 403 },
    );
  }

  await prisma.user.update({ where: { id: session.user.id }, data: { hasLoggedIn: true } });
  return NextResponse.json({ ok: true, role, redirectTo: roleDestinations[role] });
}
