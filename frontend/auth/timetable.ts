import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { getAuthenticatedUser } from "@/auth/authorization";
import { backendUrl, signedServiceHeaders } from "@/auth/copilot";
import { prisma } from "@/prisma";

type SolverUser = NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>;

export class TimetableError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

export async function requireTimetableUser() {
  const user = await getAuthenticatedUser();
  if (!user) throw new TimetableError("Please sign in to use the timetable solver.", 401);
  if (user.role !== "OWNER" && user.role !== "COUNSELOR") throw new TimetableError("The timetable solver is available to owners and counselors only.", 403);
  return user;
}

function stableHash(value: unknown) {
  const snapshot = value && typeof value === "object" ? { ...(value as Record<string, unknown>) } : value;
  if (snapshot && typeof snapshot === "object") delete (snapshot as Record<string, unknown>).retrievalAttempts;
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

async function loadTimetableContextOnce(user: SolverUser, retrievalAttempts: number) {
  const instituteId = user.instituteId;
  const [institute, sessions, trainers, batches, rooms, subjects, courses, subjectPlans, trainerExceptions] = await Promise.all([
    prisma.institute.findUniqueOrThrow({ where: { id: instituteId }, select: { timezone: true } }),
    prisma.session.findMany({
      where: { instituteId, status: "SCHEDULED" },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      select: { id: true, batchId: true, trainerId: true, roomId: true, subjectId: true, mode: true, startsAt: true, endsAt: true, status: true, scheduleVersion: true, isLocked: true },
    }),
    prisma.trainer.findMany({
      where: { instituteId }, orderBy: { user: { name: "asc" } },
      select: { id: true, skills: true, user: { select: { name: true } }, batchAssignments: { select: { batchId: true } }, subjectEligibility: { where: { active: true }, select: { subjectId: true, proficiencyLevel: true } }, availability: { select: { dayOfWeek: true, startTime: true, endTime: true, available: true } } },
    }),
    prisma.batch.findMany({
      where: { instituteId, status: "ACTIVE" }, orderBy: { name: "asc" },
      select: { id: true, name: true, courseId: true, mode: true, preferredWindows: true, sessionsPerWeek: true, sessionDurationMinutes: true, enrollments: { where: { status: "ACTIVE" }, select: { studentId: true } } },
    }),
    prisma.room.findMany({ where: { instituteId }, orderBy: { name: "asc" }, select: { id: true, name: true, capacity: true, capabilities: true } }),
    prisma.subject.findMany({ where: { instituteId, status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, courseId: true } }),
    prisma.course.findMany({ where: { instituteId, status: "ACTIVE" }, select: { id: true, name: true } }),
    prisma.batchSubjectPlan.findMany({ where: { instituteId }, orderBy: { deadline: "asc" }, select: { batchId: true, subjectId: true, requiredMinutes: true, completedMinutes: true, deadline: true, minimumSessionsPerWeek: true, maximumSessionsPerWeek: true, batch: { select: { sessionDurationMinutes: true } } } }),
    prisma.trainerAvailabilityException.findMany({ where: { instituteId, active: true, endsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, select: { trainerId: true, startsAt: true, endsAt: true, reason: true, active: true } }),
  ]);
  const context = {
    retrievalAttempts,
    sessions: sessions.map((item) => ({ ...item, startsAt: item.startsAt.toISOString(), endsAt: item.endsAt.toISOString() })),
    trainers: trainers.map((item) => ({ id: item.id, name: item.user.name, skills: item.skills, batchIds: item.batchAssignments.map((entry) => entry.batchId), subjectIds: item.subjectEligibility.map((entry) => entry.subjectId), availability: item.availability.map((entry) => ({ ...entry, startTime: entry.startTime.toISOString(), endTime: entry.endTime.toISOString() })) })),
    batches: batches.map((item) => ({ id: item.id, name: item.name, courseId: item.courseId, mode: item.mode, preferredWindows: item.preferredWindows, sessionsPerWeek: item.sessionsPerWeek, sessionDurationMinutes: item.sessionDurationMinutes, studentIds: item.enrollments.map((entry) => entry.studentId) })),
    rooms,
    subjects,
    courses,
    subjectPlans: subjectPlans.map(({ batch, ...item }) => ({ ...item, deadline: item.deadline.toISOString(), sessionDurationMinutes: batch.sessionDurationMinutes })),
    trainerExceptions: trainerExceptions.map((item) => ({ ...item, startsAt: item.startsAt.toISOString(), endsAt: item.endsAt.toISOString() })),
  };
  return { context, timezone: institute.timezone, inputHash: stableHash(context) };
}

export async function loadTimetableContext(user: SolverUser) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await loadTimetableContextOnce(user, attempt);
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 75));
    }
  }
  throw lastError;
}

async function callSolver(body: Record<string, unknown>) {
  const serialized = JSON.stringify(body);
  let response: Response;
  try {
    response = await fetch(backendUrl("/timetable/solve"), { method: "POST", headers: signedServiceHeaders(serialized), body: serialized, cache: "no-store", signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new TimetableError("The timetable solver service is unavailable.", 503);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new TimetableError(typeof payload.detail === "string" ? payload.detail : "The timetable solver could not create a valid plan.", response.status);
  return payload as { request: Prisma.InputJsonValue; solverResult: { status: string; changes?: Array<Record<string, unknown>> }; validationResult: { valid: boolean; errors?: string[] }; curriculumDemand: Prisma.InputJsonValue; retrievalAttempts: number };
}

async function revalidateDraft(instituteId: string, timezone: string, context: unknown, solverResult: unknown) {
  const serialized = JSON.stringify({ institute_id: instituteId, timezone, context, solver_result: solverResult });
  let response: Response;
  try {
    response = await fetch(backendUrl("/timetable/validate"), { method: "POST", headers: signedServiceHeaders(serialized), body: serialized, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new TimetableError("The timetable validator is unavailable; publication was stopped.", 503);
  }
  const result = await response.json().catch(() => ({})) as { valid?: boolean; errors?: string[]; detail?: string };
  if (!response.ok || !result.valid) throw new TimetableError(result.errors?.[0] ?? result.detail ?? "The draft failed final validation.", 409);
}

export async function createSchedulePlan(user: SolverUser, input: { query: string; retryFeedback?: string; retryOfId?: string }) {
  const query = input.query?.trim();
  if (!query || query.length < 3 || query.length > 4000) throw new TimetableError("Enter a timetable problem between 3 and 4,000 characters.");
  if (input.retryOfId) {
    const source = await prisma.schedulePlan.findFirst({ where: { id: input.retryOfId, instituteId: user.instituteId }, select: { id: true } });
    if (!source) throw new TimetableError("The plan to retry was not found.", 404);
  }
  const loaded = await loadTimetableContext(user);
  const requestId = randomUUID();
  const result = await callSolver({ request_id: requestId, user_id: user.id, institute_id: user.instituteId, role: user.role.toLowerCase(), query, timezone: loaded.timezone, current_datetime: new Date().toISOString(), retry_feedback: input.retryFeedback?.trim() || null, context: loaded.context });
  if (!result.validationResult.valid || !["OPTIMAL", "FEASIBLE"].includes(result.solverResult.status)) {
    throw new TimetableError(result.validationResult.errors?.[0] ?? "No safe timetable proposal was found.", 422);
  }
  const changes = result.solverResult.changes ?? [];
  return prisma.schedulePlan.create({
    data: {
      instituteId: user.instituteId, requestedById: user.id, retryOfId: input.retryOfId || null, query,
      requestPayload: result.request, inputSnapshot: loaded.context as Prisma.InputJsonValue, inputHash: loaded.inputHash,
      solverResult: result.solverResult as Prisma.InputJsonValue, validationResult: result.validationResult as Prisma.InputJsonValue,
      changes: { create: changes.map((change) => ({ sessionId: change.sessionId ? String(change.sessionId) : null, changeType: String(change.changeType), before: change.before as Prisma.InputJsonValue, after: change.after as Prisma.InputJsonValue, reason: String(change.reason) })) },
    },
    include: { changes: true, requestedBy: { select: { name: true } } },
  });
}

export async function readTimetableWorkspace(user: SolverUser) {
  const [sessions, plans, trainers, subjects] = await Promise.all([
    prisma.session.findMany({ where: { instituteId: user.instituteId, status: "SCHEDULED" }, orderBy: { startsAt: "asc" }, include: { batch: { select: { name: true, course: { select: { name: true } } } }, trainer: { select: { user: { select: { name: true } } } }, room: { select: { name: true } }, subject: { select: { name: true } } } }),
    prisma.schedulePlan.findMany({ where: { instituteId: user.instituteId }, take: 12, orderBy: { createdAt: "desc" }, include: { changes: true, requestedBy: { select: { name: true } }, publishedBy: { select: { name: true } } } }),
    prisma.trainer.findMany({ where: { instituteId: user.instituteId }, select: { id: true, user: { select: { name: true } } }, orderBy: { user: { name: "asc" } } }),
    prisma.subject.findMany({ where: { instituteId: user.instituteId, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return { role: user.role, sessions, plans, trainers: trainers.map((item) => ({ id: item.id, name: item.user.name })), subjects };
}

export async function decideSchedulePlan(user: SolverUser, planId: string, action: "PUBLISH" | "CANCEL") {
  const plan = await prisma.schedulePlan.findFirst({ where: { id: planId, instituteId: user.instituteId }, include: { changes: true } });
  if (!plan) throw new TimetableError("Schedule plan not found.", 404);
  if (plan.status !== "DRAFT") throw new TimetableError("This schedule plan has already been decided.", 409);
  if (action === "CANCEL") return prisma.schedulePlan.update({ where: { id: plan.id }, data: { status: "CANCELLED" } });
  if (user.role !== "OWNER" && user.role !== "COUNSELOR") throw new TimetableError("Only an owner or counselor can publish a timetable plan.", 403);
  const current = await loadTimetableContext(user);
  if (current.inputHash !== plan.inputHash) throw new TimetableError("The live timetable changed after this draft was created. Retry the plan with fresh data.", 409);
  await revalidateDraft(user.instituteId, current.timezone, current.context, plan.solverResult);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ locked: string }>>`SELECT pg_advisory_xact_lock(hashtext(${user.instituteId}))::text AS locked`;
    const notifyTrainer = async (sessionId: string, previousTrainerId: string | null, createdLecture: boolean) => {
      const session = await tx.session.findUniqueOrThrow({
        where: { id: sessionId },
        include: {
          trainer: { include: { user: { select: { id: true, name: true } } } },
          batch: { select: { name: true, course: { select: { name: true } } } },
          subject: { select: { name: true } },
          room: { select: { name: true } },
        },
      });
      if (!createdLecture && previousTrainerId === session.trainerId) return;
      const subjectName = session.subject?.name ?? session.batch.course.name;
      const dateLabel = new Intl.DateTimeFormat("en-IN", {
        timeZone: current.timezone, dateStyle: "medium", timeStyle: "short",
      }).format(session.startsAt);
      const type = createdLecture ? "EXTRA_LECTURE_ASSIGNED" as const : "SESSION_REASSIGNED" as const;
      const title = createdLecture ? "Extra lecture assigned" : "Lecture reassigned to you";
      const message = `You have been assigned ${subjectName} for ${session.batch.name} on ${dateLabel}${session.room ? ` in ${session.room.name}` : " online"}.`;
      const dedupeKey = `${type}:${plan.id}:${session.id}:${session.trainerId}`;
      const notification = await tx.notification.upsert({
        where: { dedupeKey },
        create: {
          instituteId: user.instituteId,
          userId: session.trainer.user.id,
          type,
          title,
          message,
          sessionId: session.id,
          planId: plan.id,
          dedupeKey,
          payload: {
            batchName: session.batch.name,
            subjectName,
            trainerName: session.trainer.user.name,
            previousTrainerId,
            startsAt: session.startsAt.toISOString(),
            endsAt: session.endsAt.toISOString(),
            roomName: session.room?.name ?? null,
          },
        },
        update: {},
      });
      await tx.realtimeEvent.create({
        data: {
          instituteId: user.instituteId,
          actorId: user.id,
          recipientUserId: session.trainer.user.id,
          eventType: "NOTIFICATION_CREATED",
          objectType: "notification",
          objectId: notification.id,
          payload: { type, sessionId: session.id, planId: plan.id },
        },
      });
    };
    for (const change of plan.changes) {
      const before = change.before as Record<string, unknown>;
      const after = change.after as Record<string, unknown>;
      if (!change.sessionId && change.changeType === "CREATE") {
        const created = await tx.session.create({
          data: {
            instituteId: user.instituteId,
            batchId: String(after.batchId),
            subjectId: String(after.subjectId),
            trainerId: String(after.trainerId),
            roomId: after.roomId ? String(after.roomId) : null,
            mode: after.mode as "CLASSROOM" | "ONLINE" | "HYBRID",
            startsAt: new Date(String(after.startsAt)),
            endsAt: new Date(String(after.endsAt)),
          },
        });
        await tx.schedulePlanChange.update({ where: { id: change.id }, data: { sessionId: created.id } });
        await notifyTrainer(created.id, null, true);
        continue;
      }
      if (!change.sessionId) throw new TimetableError("The draft contains an unsupported schedule change.", 409);
      const currentSession = await tx.session.findFirst({ where: { id: change.sessionId, instituteId: user.instituteId, status: "SCHEDULED" } });
      if (!currentSession || currentSession.scheduleVersion !== Number(before.scheduleVersion)) throw new TimetableError("A session changed while this plan was awaiting approval. Retry it.", 409);
      const previousTrainerId = currentSession.trainerId;
      await tx.session.update({ where: { id: change.sessionId }, data: { subjectId: after.subjectId ? String(after.subjectId) : currentSession.subjectId, trainerId: String(after.trainerId), roomId: after.roomId ? String(after.roomId) : null, startsAt: new Date(String(after.startsAt)), endsAt: new Date(String(after.endsAt)), scheduleVersion: { increment: 1 } } });
      if (previousTrainerId !== String(after.trainerId)) await notifyTrainer(change.sessionId, previousTrainerId, false);
    }
    const published = await tx.schedulePlan.update({ where: { id: plan.id }, data: { status: "PUBLISHED", publishedById: user.id, publishedAt: new Date() } });
    await tx.realtimeEvent.create({ data: { instituteId: user.instituteId, actorId: user.id, eventType: "PUBLISH", objectType: "schedule_plan", objectId: plan.id, payload: { changedSessions: plan.changes.length } } });
    const previous = await tx.auditEvent.findFirst({ where: { instituteId: user.instituteId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { eventHash: true } });
    const createdAt = new Date();
    const metadata = { changedSessions: plan.changes.length, status: "PUBLISHED" };
    const eventHash = createHash("sha256").update(JSON.stringify({ instituteId: user.instituteId, actorId: user.id, eventType: "PUBLISH", objectType: "schedule_plan", objectId: plan.id, metadata, previousHash: previous?.eventHash ?? null, createdAt: createdAt.toISOString() })).digest("hex");
    await tx.auditEvent.create({ data: { instituteId: user.instituteId, actorId: user.id, eventType: "PUBLISH", objectType: "schedule_plan", objectId: plan.id, metadataRedacted: metadata, previousHash: previous?.eventHash ?? null, eventHash, createdAt } });
    return published;
  });
}

export function timetableErrorResponse(error: unknown) {
  if (error instanceof TimetableError) return Response.json({ error: error.message }, { status: error.status });
  console.error("Timetable operation failed.", { name: error instanceof Error ? error.name : "Unknown", message: error instanceof Error ? error.message : String(error) });
  return Response.json({ error: "The timetable operation could not be completed." }, { status: 500 });
}
