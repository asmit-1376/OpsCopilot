import { createSchedulePlan, readTimetableWorkspace, requireTimetableUser, timetableErrorResponse, TimetableError } from "@/auth/timetable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireTimetableUser();
    return Response.json(await readTimetableWorkspace(user), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return timetableErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireTimetableUser();
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { throw new TimetableError("Request body must be valid JSON."); }
    const plan = await createSchedulePlan(user, {
      query: typeof body.query === "string" ? body.query : "",
      retryFeedback: typeof body.retryFeedback === "string" ? body.retryFeedback : undefined,
      retryOfId: typeof body.retryOfId === "string" ? body.retryOfId : undefined,
    });
    return Response.json({ data: plan }, { status: 201 });
  } catch (error) {
    return timetableErrorResponse(error);
  }
}

