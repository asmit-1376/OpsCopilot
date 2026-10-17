import { getAuthenticatedUser } from "@/auth/authorization";
import { prisma } from "@/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function wait(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(done, milliseconds);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Please sign in to continue." }, { status: 401 });
  if (!prisma.realtimeEvent) {
    return Response.json({
      error: "The database client is out of date. Run `npx prisma generate` and restart the dev server.",
    }, { status: 503 });
  }

  const headerCursor = request.headers.get("last-event-id");
  let cursor: bigint;
  try {
    cursor = headerCursor && /^\d+$/.test(headerCursor)
      ? BigInt(headerCursor)
      : (await prisma.realtimeEvent.aggregate({
          where: { instituteId: user.instituteId, OR: [{ recipientUserId: null }, { recipientUserId: user.id }] },
          _max: { id: true },
        }))._max.id ?? BigInt(0);
  } catch (error) {
    const failure = error instanceof Error ? error : new Error("Unknown realtime database error.");
    const code = "code" in failure ? String(failure.code) : undefined;
    console.error("Could not initialize institute event stream.", {
      name: failure.name,
      code,
      message: failure.message,
    });
    return Response.json({ error: "Live updates are temporarily unavailable." }, { status: 503 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (message: string) => controller.enqueue(encoder.encode(message));
      let heartbeatAt = Date.now();
      send(`retry: 3000\nevent: ready\ndata: ${JSON.stringify({ connected: true })}\n\n`);

      while (!request.signal.aborted) {
        try {
          const events = await prisma.realtimeEvent.findMany({
            where: {
              instituteId: user.instituteId,
              id: { gt: cursor },
              OR: [{ recipientUserId: null }, { recipientUserId: user.id }],
            },
            orderBy: { id: "asc" },
            take: 100,
            select: { id: true, eventType: true, objectType: true, objectId: true, createdAt: true },
          });
          for (const event of events) {
            cursor = event.id;
            send(`id: ${event.id}\nevent: change\ndata: ${JSON.stringify({ eventType: event.eventType, objectType: event.objectType, objectId: event.objectId, createdAt: event.createdAt.toISOString() })}\n\n`);
          }
          if (Date.now() - heartbeatAt > 20_000) {
            send(": keepalive\n\n");
            heartbeatAt = Date.now();
          }
        } catch {
          send(`event: unavailable\ndata: ${JSON.stringify({ message: "Live updates paused; reconnecting…" })}\n\n`);
          break;
        }
        await wait(1_500, request.signal);
      }
      try {
        controller.close();
      } catch {
        // The browser may already have closed the stream.
      }
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
}
