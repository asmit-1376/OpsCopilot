import { getAuthenticatedUser } from "@/auth/authorization";
import { prisma } from "@/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Please sign in to continue." }, { status: 401 });

  const unreadOnly = new URL(request.url).searchParams.get("unread") === "true";
  const notifications = await prisma.notification.findMany({
    where: { instituteId: user.instituteId, userId: user.id, ...(unreadOnly ? { readAt: null } : {}) },
    orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
    take: 50,
    select: {
      id: true, type: true, title: true, message: true, sessionId: true,
      planId: true, payload: true, readAt: true, createdAt: true,
    },
  });
  return Response.json({
    data: notifications,
    unreadCount: notifications.filter((notification) => !notification.readAt).length,
  });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Please sign in to continue." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { action?: string };
  if (body.action !== "READ_ALL") return Response.json({ error: "Unsupported notification action." }, { status: 400 });

  const result = await prisma.notification.updateMany({
    where: { instituteId: user.instituteId, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return Response.json({ data: { updated: result.count } });
}
