import { CopilotError, backendUrl, copilotErrorResponse, findCopilotRecipient, requireCopilotUser, signedServiceHeaders } from "@/auth/copilot";
import { prisma } from "@/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ proposalId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const user = await requireCopilotUser();
    const { proposalId } = await params;
    let body: { decision?: unknown };
    try {
      body = await request.json();
    } catch {
      throw new CopilotError("Request body must be valid JSON.", 400);
    }
    if (body.decision !== "APPROVED" && body.decision !== "REJECTED") {
      throw new CopilotError("Choose approve or reject for this proposal.", 400);
    }
    const proposal = await prisma.actionProposal.findFirst({
      where: {
        id: proposalId,
        instituteId: user.instituteId,
        actionType: "WHATSAPP_SEND",
        request: { is: { thread: { is: { userId: user.id, instituteId: user.instituteId, archivedAt: null } } } },
      },
      include: { request: { include: { thread: { select: { userId: true } } } } },
    });
    if (!proposal || !proposal.request || proposal.request.thread.userId !== user.id) {
      throw new CopilotError("Proposal not found.", 404);
    }
    if (proposal.status !== "PENDING") throw new CopilotError("This proposal has already been decided.", 409);
    if (proposal.expiresAt && proposal.expiresAt <= new Date()) {
      await prisma.actionProposal.update({ where: { id: proposal.id }, data: { status: "EXPIRED" } });
      throw new CopilotError("This WhatsApp draft has expired. Create a new draft to send it.", 410);
    }

    if (body.decision === "REJECTED") {
      await prisma.$transaction(async (tx) => {
        const update = await tx.actionProposal.updateMany({
          where: { id: proposal.id, instituteId: user.instituteId, status: "PENDING" },
          data: { status: "REJECTED" },
        });
        if (!update.count) throw new CopilotError("This proposal has already been decided.", 409);
        await tx.actionApproval.create({ data: { proposalId: proposal.id, approverId: user.id, decision: "REJECTED" } });
      });
      return Response.json({ status: "REJECTED" });
    }

    const payload = proposal.payload && typeof proposal.payload === "object" && !Array.isArray(proposal.payload)
      ? proposal.payload as Record<string, unknown>
      : {};
    if (typeof payload.recipientStudentId !== "string" || typeof payload.message !== "string") {
      throw new CopilotError("This proposal is incomplete and cannot be sent.", 409);
    }
    const recipient = await findCopilotRecipient(payload.recipientStudentId, user);
    const idempotencyKey = `${proposal.id}:${proposal.revision}`;
    await prisma.$transaction(async (tx) => {
      const update = await tx.actionProposal.updateMany({
        where: { id: proposal.id, instituteId: user.instituteId, status: "PENDING", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        data: { status: "APPROVED" },
      });
      if (!update.count) throw new CopilotError("This proposal has expired or has already been decided.", 409);
      await tx.actionApproval.create({ data: { proposalId: proposal.id, approverId: user.id, decision: "APPROVED" } });
      await tx.actionExecution.create({
        data: { proposalId: proposal.id, idempotencyKey, status: "APPROVED" },
      });
    });

    let sendResult: { status?: string; attempts?: number; reason?: string; message_id?: string | null };
    const sendBody = JSON.stringify({
      proposal_id: proposal.id,
      idempotency_key: idempotencyKey,
      mobile_number: recipient.mobile,
      message: payload.message,
    });
    try {
      const response = await fetch(backendUrl("/internal/whatsapp/send"), {
        method: "POST",
        headers: signedServiceHeaders(sendBody),
        body: sendBody,
        cache: "no-store",
      });
      sendResult = await response.json() as typeof sendResult;
      if (!response.ok) sendResult.status = "failed";
    } catch {
      sendResult = { status: "failed", reason: "service_unavailable" };
    }
    const succeeded = sendResult.status === "success";
    await prisma.$transaction([
      prisma.actionExecution.update({
        where: { idempotencyKey },
        data: { status: succeeded ? "EXECUTED" : "FAILED", executedAt: new Date(), providerRef: sendResult.message_id ?? null },
      }),
      prisma.actionProposal.update({ where: { id: proposal.id }, data: { status: succeeded ? "EXECUTED" : "FAILED" } }),
    ]);
    if (!succeeded) {
      throw new CopilotError("WhatsApp could not send the approved message. The failed attempt is recorded; create a new draft before retrying.", 502);
    }
    return Response.json({ status: "EXECUTED", recipientName: recipient.name });
  } catch (error) {
    return copilotErrorResponse(error);
  }
}
