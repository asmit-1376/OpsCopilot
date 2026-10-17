import { CopilotError, copilotErrorResponse, requireCopilotUser } from "@/auth/copilot";
import { prisma } from "@/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ threadId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await requireCopilotUser();
    const { threadId } = await params;
    const thread = await prisma.copilotThread.findFirst({
      where: { id: threadId, instituteId: user.instituteId, userId: user.id, archivedAt: null },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        activeRequestId: true,
        messages: {
          orderBy: { sequence: "asc" },
          take: 300,
          include: {
            request: {
              include: {
                proposals: {
                  where: { actionType: "WHATSAPP_SEND" },
                  orderBy: { expiresAt: "desc" },
                  take: 1,
                  select: { id: true, status: true, payload: true, expiresAt: true },
                },
              },
            },
          },
        },
      },
    });
    if (!thread) throw new CopilotError("Conversation not found.", 404);
    const messages = thread.messages.map(({ request, ...message }) => ({
      ...message,
      proposals: message.role === "ASSISTANT" ? (request?.proposals ?? []).map((proposal) => {
        const payload = proposal.payload && typeof proposal.payload === "object" && !Array.isArray(proposal.payload)
          ? proposal.payload as Record<string, unknown>
          : {};
        return {
          id: proposal.id,
          status: proposal.status,
          expiresAt: proposal.expiresAt,
          recipientName: typeof payload.recipientName === "string" ? payload.recipientName : "Student",
          recipientMaskedMobile: typeof payload.recipientMaskedMobile === "string" ? payload.recipientMaskedMobile : "",
          message: typeof payload.message === "string" ? payload.message : "",
        };
      }) : [],
    }));
    return Response.json({ thread: { id: thread.id, title: thread.title, createdAt: thread.createdAt, updatedAt: thread.updatedAt, activeRequestId: thread.activeRequestId }, messages }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return copilotErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await requireCopilotUser();
    const { threadId } = await params;
    let body: { title?: unknown; archive?: unknown };
    try {
      body = await request.json();
    } catch {
      throw new CopilotError("Request body must be valid JSON.", 400);
    }
    const thread = await prisma.copilotThread.findFirst({
      where: { id: threadId, instituteId: user.instituteId, userId: user.id, archivedAt: null },
      select: { id: true, activeRequestId: true },
    });
    if (!thread) throw new CopilotError("Conversation not found.", 404);
    if (thread.activeRequestId) throw new CopilotError("Wait for the current reply before changing this conversation.", 409);

    if (body.archive === true) {
      await prisma.copilotThread.update({ where: { id: thread.id }, data: { archivedAt: new Date() } });
      return Response.json({ archived: true });
    }
    if (typeof body.title !== "string" || !body.title.trim()) {
      throw new CopilotError("Enter a conversation title.", 400);
    }
    const updated = await prisma.copilotThread.update({
      where: { id: thread.id },
      data: { title: body.title.trim().slice(0, 120) },
      select: { id: true, title: true, updatedAt: true },
    });
    return Response.json({ thread: updated });
  } catch (error) {
    return copilotErrorResponse(error);
  }
}
