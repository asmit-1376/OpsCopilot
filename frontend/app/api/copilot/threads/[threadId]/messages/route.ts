import { createHash, randomUUID } from "node:crypto";
import { CopilotError, backendUrl, copilotErrorResponse, createWhatsAppProposal, makeRequestId, redactPrompt, requireCopilotUser, roleForBackend, signedServiceHeaders, validRequestId } from "@/auth/copilot";
import { prisma } from "@/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ threadId: string }> };
type RunMetadata = {
  intent?: string;
  policy_decision?: string;
  result_count?: number;
  query_plan?: unknown;
};

function encodeSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function parseFrame(frame: string) {
  let event = "message";
  const data: string[] = [];
  for (const rawLine of frame.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (!data.length) return null;
  try {
    return { event, data: JSON.parse(data.join("\n")) as Record<string, unknown> };
  } catch {
    return { event: "error", data: { message: "The Copilot service returned an invalid event." } };
  }
}

function safePolicy(value: unknown): "ALLOW" | "PARTIAL" | "REQUIRE_APPROVAL" {
  if (value === "REQUIRE_APPROVAL") return value;
  if (value === "PARTIAL") return value;
  return "ALLOW";
}

export async function POST(request: Request, { params }: RouteContext) {
  let reservedThreadId: string | null = null;
  let requestId: string | null = null;
  let userMessageId: string | null = null;
  let assistantMessageId: string | null = null;
  try {
    const user = await requireCopilotUser();
    const { threadId } = await params;
    const thread = await prisma.copilotThread.findFirst({
      where: { id: threadId, instituteId: user.instituteId, userId: user.id, archivedAt: null },
      select: { id: true, title: true, activeRequestId: true },
    });
    if (!thread) throw new CopilotError("Conversation not found.", 404);

    let body: { content?: unknown; clientRequestId?: unknown };
    try {
      body = await request.json();
    } catch {
      throw new CopilotError("Request body must be valid JSON.", 400);
    }
    if (typeof body.content !== "string" || !body.content.trim() || body.content.length > 8000) {
      throw new CopilotError("Enter a message of 1 to 8,000 characters.", 400);
    }
    const content = body.content.trim();
    const clientRequestId = validRequestId(request.headers.get("idempotency-key") ?? body.clientRequestId) ?? randomUUID();
    const previousRequest = await prisma.copilotRequest.findUnique({ where: { clientRequestId }, select: { id: true, threadId: true } });
    if (previousRequest) {
      throw new CopilotError(previousRequest.threadId === thread.id ? "This message was already submitted." : "Invalid request identifier.", 409);
    }

    requestId = makeRequestId();
    const reservation = await prisma.copilotThread.updateMany({
      where: { id: thread.id, instituteId: user.instituteId, userId: user.id, archivedAt: null, activeRequestId: null },
      data: { activeRequestId: requestId },
    });
    if (!reservation.count) throw new CopilotError("This conversation is already processing a message.", 409);
    reservedThreadId = thread.id;

    const historyRows = await prisma.copilotMessage.findMany({
      where: { threadId: thread.id, status: "COMPLETED", role: { in: ["USER", "ASSISTANT"] } },
      orderBy: { sequence: "desc" },
      take: 12,
      select: { role: true, content: true },
    });
    const history = historyRows.reverse().map(({ role, content: text }) => ({ role, content: text.slice(0, 6000) }));

    const records = await prisma.$transaction(async (tx) => {
      const last = await tx.copilotMessage.findFirst({ where: { threadId: thread.id }, orderBy: { sequence: "desc" }, select: { sequence: true } });
      const firstSequence = (last?.sequence ?? 0) + 1;
      const copilotRequest = await tx.copilotRequest.create({
        data: {
          id: requestId!,
          threadId: thread.id,
          clientRequestId,
          promptRedacted: redactPrompt(content),
          intent: "pending",
          queryHash: createHash("sha256").update(content).digest("hex"),
          policyDecision: "ALLOW",
        },
      });
      const userMessage = await tx.copilotMessage.create({
        data: { threadId: thread.id, requestId: copilotRequest.id, role: "USER", content, status: "COMPLETED", sequence: firstSequence },
        select: { id: true },
      });
      const assistantMessage = await tx.copilotMessage.create({
        data: { threadId: thread.id, requestId: copilotRequest.id, role: "ASSISTANT", content: "", status: "STREAMING", sequence: firstSequence + 1 },
        select: { id: true },
      });
      await tx.copilotThread.update({
        where: { id: thread.id },
        data: {
          title: thread.title === "New conversation" ? content.replace(/\s+/g, " ").slice(0, 72) : thread.title,
          updatedAt: new Date(),
        },
      });
      return { copilotRequest, userMessage, assistantMessage };
    });
    userMessageId = records.userMessage.id;
    assistantMessageId = records.assistantMessage.id;

    const trainerId = user.trainerId;
    const backendPayload = JSON.stringify({
      request_id: requestId,
      user_id: user.id,
      institute_id: user.instituteId,
      thread_id: thread.id,
      role: roleForBackend(user.role),
      trainer_id: trainerId,
      query: content,
      history,
    });
    const aborter = new AbortController();
    let upstream: Response;
    try {
      upstream = await fetch(backendUrl("/copilot"), {
        method: "POST",
        headers: signedServiceHeaders(backendPayload),
        body: backendPayload,
        cache: "no-store",
        signal: aborter.signal,
      });
    } catch {
      await prisma.$transaction([
        prisma.copilotMessage.update({ where: { id: assistantMessageId }, data: { status: "FAILED", content: "Copilot service is unavailable. Please try again." } }),
        prisma.copilotRequest.update({ where: { id: requestId }, data: { policyDecision: "PARTIAL" } }),
        prisma.copilotThread.updateMany({ where: { id: thread.id, activeRequestId: requestId }, data: { activeRequestId: null } }),
      ]);
      reservedThreadId = null;
      return Response.json({ error: "Copilot service is unavailable. Start the FastAPI backend and try again." }, { status: 503 });
    }
    if (!upstream.ok || !upstream.body) {
      const status = upstream.status === 401 ? 503 : 502;
      await prisma.$transaction([
        prisma.copilotMessage.update({ where: { id: assistantMessageId }, data: { status: "FAILED", content: "Copilot could not start this request." } }),
        prisma.copilotRequest.update({ where: { id: requestId }, data: { policyDecision: "PARTIAL" } }),
        prisma.copilotThread.updateMany({ where: { id: thread.id, activeRequestId: requestId }, data: { activeRequestId: null } }),
      ]);
      reservedThreadId = null;
      return Response.json({ error: "Copilot could not start this request. Check the FastAPI service configuration." }, { status });
    }

    const encoder = new TextEncoder();
    let assistantText = "";
    let runMetadata: RunMetadata = {};
    let hasProposal = false;
    let finalized = false;
    const finalize = async (status: "COMPLETED" | "FAILED" | "CANCELLED", failureText?: string) => {
      if (finalized || !requestId || !assistantMessageId || !reservedThreadId) return;
      finalized = true;
      const finalContent = assistantText || failureText || (status === "CANCELLED" ? "Response cancelled." : "The Copilot request did not return a response.");
      await prisma.$transaction([
        prisma.copilotMessage.update({ where: { id: assistantMessageId }, data: { content: finalContent, status } }),
        prisma.copilotRequest.update({
          where: { id: requestId },
          data: {
            intent: runMetadata.intent?.slice(0, 120) ?? "other",
            policyDecision: status === "COMPLETED" ? safePolicy(hasProposal ? "REQUIRE_APPROVAL" : runMetadata.policy_decision) : "PARTIAL",
            resultCount: typeof runMetadata.result_count === "number" ? runMetadata.result_count : null,
            queryPlan: runMetadata.query_plan && typeof runMetadata.query_plan === "object" ? runMetadata.query_plan as import("@prisma/client").Prisma.InputJsonValue : undefined,
          },
        }),
        prisma.copilotThread.updateMany({ where: { id: reservedThreadId, activeRequestId: requestId }, data: { activeRequestId: null, updatedAt: new Date() } }),
      ]);
      reservedThreadId = null;
    };

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = upstream.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let doneEvent = false;
        const emit = (event: string, data: unknown) => controller.enqueue(encoder.encode(encodeSse(event, data)));
        const processFrame = async (rawFrame: string) => {
          const parsed = parseFrame(rawFrame);
          if (!parsed) return;
          if (parsed.event === "token" && typeof parsed.data.text === "string") assistantText += parsed.data.text;
          if (parsed.event === "proposal") {
            if (typeof parsed.data.recipient_student_id !== "string" || typeof parsed.data.message !== "string") {
              throw new Error("Copilot returned an invalid WhatsApp proposal.");
            }
            const proposal = await createWhatsAppProposal({
              requestId: requestId!,
              studentId: parsed.data.recipient_student_id,
              message: parsed.data.message,
              user,
            });
            hasProposal = true;
            emit("proposal", proposal);
            return;
          }
          if (parsed.event === "done") {
            runMetadata = parsed.data as RunMetadata;
            doneEvent = true;
          }
          emit(parsed.event, parsed.data);
        };
        try {
          while (true) {
            const result = await reader.read();
            if (result.done) break;
            buffer += decoder.decode(result.value, { stream: true });
            let boundary = buffer.indexOf("\n\n");
            while (boundary >= 0) {
              const frame = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary + 2);
              await processFrame(frame);
              boundary = buffer.indexOf("\n\n");
            }
          }
          buffer += decoder.decode();
          if (buffer.trim()) await processFrame(buffer);
          if (!doneEvent) throw new Error("The Copilot stream ended before completion.");
          await finalize("COMPLETED");
        } catch {
          const cancelled = aborter.signal.aborted;
          const message = cancelled ? "Response cancelled." : "Copilot could not complete this request. Please try again.";
          await finalize(cancelled ? "CANCELLED" : "FAILED", message).catch(() => undefined);
          try {
            emit(cancelled ? "cancelled" : "error", { message });
          } catch {
            // The browser may already have disconnected.
          }
        } finally {
          reader.releaseLock();
          try { controller.close(); } catch { /* Stream already closed by the client. */ }
        }
      },
      cancel() {
        aborter.abort();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (reservedThreadId && requestId) {
      await prisma.copilotThread.updateMany({ where: { id: reservedThreadId, activeRequestId: requestId }, data: { activeRequestId: null } }).catch(() => undefined);
      if (assistantMessageId) await prisma.copilotMessage.update({ where: { id: assistantMessageId }, data: { status: "FAILED", content: "Copilot could not start this request." } }).catch(() => undefined);
      if (userMessageId) await prisma.copilotRequest.update({ where: { id: requestId }, data: { policyDecision: "PARTIAL" } }).catch(() => undefined);
    }
    return copilotErrorResponse(error);
  }
}
