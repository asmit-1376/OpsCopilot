import { getAuthenticatedUser } from "@/auth/authorization";
import { prisma } from "@/prisma";

export const runtime = "nodejs";

export async function PATCH(_request: Request, context: { params: Promise<{ notificationId: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Please sign in to continue." }, { status: 401 });
  const { notificationId } = await context.params;
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, instituteId: user.instituteId, userId: user.id },
    select: { id: true, readAt: true },
  });
  if (!notification) return Response.json({ error: "Notification not found." }, { status: 404 });
  const updated = notification.readAt ?? new Date();
  await prisma.notification.update({ where: { id: notification.id }, data: { readAt: updated } });
  return Response.json({ data: { id: notification.id, readAt: updated.toISOString() } });
}
