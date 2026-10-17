import { decideSchedulePlan, requireTimetableUser, timetableErrorResponse, TimetableError } from "@/auth/timetable";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ planId: string }> }) {
  try {
    const user = await requireTimetableUser();
    const { planId } = await context.params;
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { throw new TimetableError("Request body must be valid JSON."); }
    if (body.action !== "PUBLISH" && body.action !== "CANCEL") throw new TimetableError("Action must be PUBLISH or CANCEL.");
    return Response.json({ data: await decideSchedulePlan(user, planId, body.action) });
  } catch (error) {
    return timetableErrorResponse(error);
  }
}

