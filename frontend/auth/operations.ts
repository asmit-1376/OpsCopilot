import { createHash } from "node:crypto";
import type { Prisma, Role } from "@prisma/client";
import { getAuthenticatedUser } from "@/auth/authorization";
import { prisma } from "@/prisma";

export type AppUser = NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>;
type Tx = Prisma.TransactionClient;
type JsonRecord = Record<string, unknown>;

export class OperationError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

function object(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OperationError("Send the operation details as a JSON object.");
  }
  return value as JsonRecord;
}

function requiredString(data: JsonRecord, field: string, max = 200): string {
  const value = data[field];
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new OperationError(`${field} is required and must be at most ${max} characters.`);
  }
  return value.trim();
}

function optionalString(data: JsonRecord, field: string, max = 200): string | null {
  const value = data[field];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > max) {
    throw new OperationError(`${field} must be at most ${max} characters.`);
  }
  return value.trim();
}

function requiredId(data: JsonRecord, field: string): string {
  const value = requiredString(data, field, 64);
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)) {
    throw new OperationError(`${field} is not a valid record ID.`);
  }
  return value;
}

function positiveNumber(data: JsonRecord, field: string, allowZero = false): number {
  const value = Number(data[field]);
  if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) {
    throw new OperationError(`${field} must be a ${allowZero ? "non-negative" : "positive"} number.`);
  }
  return value;
}

function wholeNumber(data: JsonRecord, field: string, minimum = 0): number {
  const value = Number(data[field]);
  if (!Number.isInteger(value) || value < minimum) {
    throw new OperationError(`${field} must be a whole number of at least ${minimum}.`);
  }
  return value;
}

function dateValue(data: JsonRecord, field: string): Date {
  const value = data[field];
  if (typeof value !== "string" || !value.trim()) throw new OperationError(`${field} is required.`);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new OperationError(`${field} is not a valid date.`);
  return parsed;
}

function oneOf<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new OperationError(`${field} must be one of: ${allowed.join(", ")}.`);
  }
  return value as T;
}

function requireRole(user: AppUser, allowed: readonly Role[]) {
  if (!allowed.includes(user.role)) throw new OperationError("Your role cannot perform this operation.", 403);
}

async function requireRecord<T>(record: T | null, label: string): Promise<T> {
  if (!record) throw new OperationError(`${label} was not found in your institute.`, 404);
  return record;
}

async function logChange(
  tx: Tx,
  user: AppUser,
  eventType: string,
  objectType: string,
  objectId: string,
  payload: Prisma.InputJsonValue,
) {
  await tx.realtimeEvent.create({
    data: {
      instituteId: user.instituteId,
      actorId: user.id,
      eventType,
      objectType,
      objectId,
      payload: { eventType, objectType, objectId },
    },
  });

  // pg_advisory_xact_lock returns PostgreSQL `void`, which Prisma's driver
  // adapter cannot deserialize. Casting keeps the blocking transaction lock
  // while returning a supported scalar type.
  await tx.$queryRaw<Array<{ locked: string }>>`
    SELECT pg_advisory_xact_lock(hashtext(${user.instituteId}))::text AS locked
  `;
  const previous = await tx.auditEvent.findFirst({
    where: { instituteId: user.instituteId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { eventHash: true },
  });
  const createdAt = new Date();
  const previousHash = previous?.eventHash ?? null;
  const eventHash = createHash("sha256")
    .update(JSON.stringify({ instituteId: user.instituteId, actorId: user.id, eventType, objectType, objectId, payload, previousHash, createdAt: createdAt.toISOString() }))
    .digest("hex");
  await tx.auditEvent.create({
    data: {
      instituteId: user.instituteId,
      actorId: user.id,
      eventType,
      objectType,
      objectId,
      metadataRedacted: payload,
      previousHash,
      eventHash,
      createdAt,
    },
  });
}

async function requireInstituteRecord<T extends { id: string }>(
  model: { findFirst(args: never): Promise<T | null> },
  id: string,
  instituteId: string,
  label: string,
): Promise<T> {
  const record = await model.findFirst({ where: { id, instituteId } } as never);
  return requireRecord(record, label);
}

async function assertTrainerOwnsSession(tx: Tx, user: AppUser, sessionId: string) {
  const trainer = await tx.trainer.findFirst({ where: { userId: user.id, instituteId: user.instituteId } });
  if (!trainer) throw new OperationError("Your trainer profile is not linked yet.", 403);
  const session = await tx.session.findFirst({
    where: { id: sessionId, instituteId: user.instituteId, trainerId: trainer.id },
    include: { batch: { include: { enrollments: { where: { instituteId: user.instituteId, status: "ACTIVE" }, select: { studentId: true } } } } },
  });
  return { trainer, session: await requireRecord(session, "Assigned session") };
}

async function assertTrainerOwnsStudent(tx: Tx, user: AppUser, studentId: string) {
  const trainer = await tx.trainer.findFirst({ where: { userId: user.id, instituteId: user.instituteId } });
  if (!trainer) throw new OperationError("Your trainer profile is not linked yet.", 403);
  const enrollment = await tx.enrollment.findFirst({
    where: {
      instituteId: user.instituteId,
      studentId,
      status: "ACTIVE",
      batch: { is: { trainerAssignments: { some: { trainerId: trainer.id } } } },
    },
    select: { id: true },
  });
  if (!enrollment) throw new OperationError("That learner is not assigned to one of your batches.", 403);
}

async function requireCounselor(tx: Tx, userId: string, instituteId: string) {
  const counselor = await tx.user.findFirst({
    where: { id: userId, instituteId, status: "ACTIVE", roles: { some: { role: "COUNSELOR" } } },
    select: { id: true },
  });
  if (!counselor) throw new OperationError("Choose an active counselor from your institute.", 404);
  return counselor;
}

async function checkSessionConflict(
  tx: Tx,
  instituteId: string,
  input: { trainerId: string; roomId: string | null; startsAt: Date; endsAt: Date; excludeId?: string },
) {
  if (input.endsAt <= input.startsAt) throw new OperationError("A session must end after it starts.");
  const overlaps = await tx.session.findMany({
    where: {
      instituteId,
      status: "SCHEDULED",
      startsAt: { lt: input.endsAt },
      endsAt: { gt: input.startsAt },
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
    },
    select: { trainerId: true, roomId: true },
  });
  if (overlaps.some((session) => session.trainerId === input.trainerId)) {
    throw new OperationError("That trainer already has a session during this time.", 409);
  }
  if (input.roomId && overlaps.some((session) => session.roomId === input.roomId)) {
    throw new OperationError("That room is already booked during this time.", 409);
  }
}

function validateCounselorSessionWindow(startsAt: Date, endsAt: Date, timezone: string) {
  const durationMinutes = (endsAt.getTime() - startsAt.getTime()) / 60_000;
  if (durationMinutes !== 60) {
    throw new OperationError("Counselor timetable entries must be exactly one hour long.");
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(startsAt);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  const weekday = part("weekday");
  const hour = Number(part("hour"));
  if (!["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday)) {
    throw new OperationError("Choose a weekday from Monday through Friday.");
  }
  if (hour < 9 || hour > 12 || part("minute") !== "00" || part("second") !== "00" || startsAt.getUTCMilliseconds() !== 0) {
    throw new OperationError("Choose a start time from 9:00 AM through 12:00 PM; the lecture ends by 1:00 PM.");
  }
}

export async function readWorkspace(user: AppUser) {
  const instituteId = user.instituteId;
  const isManagement = user.role === "OWNER" || user.role === "COUNSELOR";
  const isFinance = user.role === "OWNER" || user.role === "ACCOUNTS";
  const trainer = user.role === "TRAINER"
    ? await prisma.trainer.findFirst({ where: { userId: user.id, instituteId } })
    : null;
  const student = user.role === "STUDENT"
    ? await prisma.student.findFirst({ where: { userId: user.id, instituteId, status: "ACTIVE" } })
    : null;
  const ownBatchIds = user.role === "TRAINER"
    ? trainer
      ? (await prisma.trainerBatchAssignment.findMany({ where: { trainerId: trainer.id }, select: { batchId: true } })).map(({ batchId }) => batchId)
      : []
    : user.role === "STUDENT"
      ? student
        ? (await prisma.enrollment.findMany({ where: { studentId: student.id, instituteId, status: "ACTIVE" }, select: { batchId: true } })).map(({ batchId }) => batchId)
        : []
      : undefined;

  const batchWhere: Prisma.BatchWhereInput = {
    instituteId,
    status: "ACTIVE",
    ...(ownBatchIds ? { id: { in: ownBatchIds } } : {}),
  };
  const canSeeAll = user.role === "OWNER" || user.role === "COUNSELOR" || user.role === "ACCOUNTS";
  const trainersQuery = canSeeAll
    ? prisma.trainer.findMany({
        where: { instituteId },
        include: { user: { select: { id: true, name: true, email: true } }, batchAssignments: { include: { batch: { select: { id: true, name: true } } } } },
        orderBy: { user: { name: "asc" } },
      })
    : trainer
      ? prisma.trainer.findMany({
          where: { id: trainer.id },
          include: { user: { select: { id: true, name: true, email: true } }, batchAssignments: { include: { batch: { select: { id: true, name: true } } } } },
        })
      : prisma.trainer.findMany({
          where: { instituteId, batchAssignments: { some: { batchId: { in: ownBatchIds ?? [] } } } },
          include: { user: { select: { id: true, name: true } }, batchAssignments: { include: { batch: { select: { id: true, name: true } } } } },
        });
  const counselorsQuery = user.role === "OWNER"
    ? prisma.user.findMany({
        where: { instituteId, status: "ACTIVE", roles: { some: { role: "COUNSELOR" } } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true, hasLoggedIn: true },
      })
    : Promise.resolve([]);
  const counselorInvitesQuery = user.role === "OWNER"
    ? prisma.registrationInvite.findMany({
        where: { instituteId, role: "COUNSELOR", status: "PENDING", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, email: true, createdAt: true },
      })
    : Promise.resolve([]);
  const studentsQuery = isManagement
    ? prisma.student.findMany({
        where: { instituteId },
        orderBy: { name: "asc" },
        include: { enrollments: { where: { instituteId, status: "ACTIVE" }, include: { batch: { include: { course: { select: { name: true } } } } } } },
      })
    : user.role === "TRAINER"
      ? prisma.student.findMany({
          where: { instituteId, enrollments: { some: { instituteId, status: "ACTIVE", batchId: { in: ownBatchIds ?? [] } } } },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            externalRef: true,
            enrollments: {
              where: { instituteId, status: "ACTIVE", batchId: { in: ownBatchIds ?? [] } },
              select: { id: true, batch: { select: { id: true, name: true, course: { select: { name: true } } } } },
            },
          },
        })
      : student
        ? prisma.student.findMany({
            where: { id: student.id, instituteId },
            include: { enrollments: { where: { instituteId, status: "ACTIVE" }, include: { batch: { include: { course: { select: { name: true } } } } } } },
          })
        : Promise.resolve([]);
  const attendanceQuery = user.role === "OWNER" || user.role === "COUNSELOR"
    ? prisma.attendanceSummary.findMany({
        where: { session: { is: { instituteId } } }, take: 500, orderBy: { session: { startsAt: "desc" } },
        include: { student: { select: { id: true, name: true } }, session: { include: { batch: { select: { id: true, name: true } } } } },
      })
    : user.role === "TRAINER" && trainer
      ? prisma.attendanceSummary.findMany({
          where: { session: { is: { instituteId, trainerId: trainer.id } } }, take: 500, orderBy: { session: { startsAt: "desc" } },
          include: { student: { select: { id: true, name: true } }, session: { include: { batch: { select: { id: true, name: true } } } } },
        })
      : student
        ? prisma.attendanceSummary.findMany({
            where: { studentId: student.id, session: { is: { instituteId } } }, take: 200, orderBy: { session: { startsAt: "desc" } },
            include: { student: { select: { id: true, name: true } }, session: { include: { batch: { select: { id: true, name: true } } } } },
          })
        : Promise.resolve([]);
  const sessionsQuery = prisma.session.findMany({
    where: {
      instituteId,
      ...(canSeeAll ? {} : { batchId: { in: ownBatchIds ?? [] } }),
      ...(trainer ? { trainerId: trainer.id } : {}),
      status: { not: "CANCELLED" },
    },
    orderBy: { startsAt: "asc" },
    take: 200,
    include: {
      batch: { include: { course: { select: { name: true } } } },
      trainer: { include: { user: { select: { name: true } } } },
      room: { select: { name: true } },
      subject: { select: { name: true } },
      _count: { select: { attendanceSummaries: true, recordings: true } },
    },
  });
  const recordingsQuery = user.role === "ACCOUNTS"
    ? Promise.resolve([])
    : prisma.recording.findMany({
        where: {
          instituteId,
          ...(user.role === "STUDENT" ? { status: "AVAILABLE", session: { is: { batchId: { in: ownBatchIds ?? [] } } } } : {}),
          ...(trainer ? { session: { is: { trainerId: trainer.id } } } : {}),
        },
        take: 100,
        orderBy: { id: "desc" },
        include: {
          session: {
            include: {
              batch: { select: { id: true, name: true, course: { select: { name: true } } } },
              trainer: { include: { user: { select: { name: true } } } },
            },
          },
        },
      });
  const feePlansQuery = isFinance || student
    ? prisma.feePlan.findMany({
        where: { instituteId, ...(student ? { enrollment: { is: { studentId: student.id, instituteId } } } : {}) },
        include: {
          enrollment: { include: { student: { select: { id: true, name: true, externalRef: true } }, batch: { select: { id: true, name: true, course: { select: { name: true } } } } } },
          installments: { orderBy: { sequenceNo: "asc" }, include: { payments: { orderBy: { paidAt: "desc" } } } },
        },
        orderBy: { id: "desc" },
      })
    : Promise.resolve([]);
  const leadsQuery = isManagement
    ? prisma.admissionLead.findMany({
        where: { instituteId, ...(user.role === "COUNSELOR" ? { OR: [{ assignedCounselorId: user.id }, { assignedCounselorId: null }] } : {}) },
        orderBy: [{ stage: "asc" }, { updatedAt: "desc" }],
        include: { assignedCounselor: { select: { id: true, name: true } }, convertedStudent: { select: { id: true, name: true } } },
        take: 300,
      })
    : Promise.resolve([]);
  const tasksQuery = isManagement
    ? prisma.counselorTask.findMany({
        where: { instituteId, ...(user.role === "COUNSELOR" ? { OR: [{ assignedToId: user.id }, { assignedToId: null }, { createdById: user.id }] } : {}) },
        orderBy: [{ completedAt: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
        include: { student: { select: { id: true, name: true } }, lead: { select: { id: true, name: true } }, assignedTo: { select: { id: true, name: true } } },
        take: 300,
      })
    : Promise.resolve([]);
  const studentScopeIds = user.role === "TRAINER"
    ? (await prisma.enrollment.findMany({ where: { instituteId, status: "ACTIVE", batchId: { in: ownBatchIds ?? [] } }, select: { studentId: true }, distinct: ["studentId"] }).then((rows) => rows.map((row) => row.studentId)))
    : [];
  const notesQuery = user.role === "OWNER" || user.role === "COUNSELOR"
    ? prisma.studentNote.findMany({ where: { instituteId }, orderBy: { createdAt: "desc" }, take: 300, include: { student: { select: { id: true, name: true } }, author: { select: { name: true } } } })
    : user.role === "TRAINER"
      ? prisma.studentNote.findMany({ where: { instituteId, studentId: { in: studentScopeIds } }, orderBy: { createdAt: "desc" }, take: 200, include: { student: { select: { id: true, name: true } }, author: { select: { name: true } } } })
      : Promise.resolve([]);
  const escalationsQuery = user.role === "OWNER" || user.role === "COUNSELOR"
    ? prisma.studentEscalation.findMany({ where: { instituteId }, orderBy: { createdAt: "desc" }, take: 300, include: { student: { select: { id: true, name: true } }, assignedTo: { select: { id: true, name: true } } } })
    : user.role === "TRAINER"
      ? prisma.studentEscalation.findMany({ where: { instituteId, studentId: { in: studentScopeIds } }, orderBy: { createdAt: "desc" }, take: 200, include: { student: { select: { id: true, name: true } }, assignedTo: { select: { id: true, name: true } } } })
      : Promise.resolve([]);
  const communicationsQuery = user.role === "OWNER" || user.role === "COUNSELOR" || user.role === "ACCOUNTS"
    ? prisma.communication.findMany({ where: { instituteId }, orderBy: { createdAt: "desc" }, take: 300, include: { student: { select: { id: true, name: true } }, createdBy: { select: { name: true } } } })
    : Promise.resolve([]);
  const bankTransactionsQuery = isFinance
    ? prisma.bankTransaction.findMany({ where: { instituteId }, orderBy: { occurredAt: "desc" }, take: 300, include: { payment: { select: { id: true } } } })
    : Promise.resolve([]);
  const remindersQuery = isFinance
    ? prisma.paymentReminder.findMany({
        where: { instituteId }, orderBy: { queuedAt: "desc" }, take: 300,
        include: {
          installment: {
            include: {
              feePlan: {
                include: {
                  enrollment: {
                    include: {
                      student: { select: { id: true, name: true, phone: true, email: true } },
                      batch: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      })
    : Promise.resolve([]);
  const proposalsQuery = user.role === "OWNER"
    ? prisma.actionProposal.findMany({ where: { instituteId }, orderBy: { id: "desc" }, take: 100, include: { request: { select: { intent: true, promptRedacted: true, createdAt: true } }, approvals: { include: { approver: { select: { name: true } } }, orderBy: { decidedAt: "desc" } } } })
    : Promise.resolve([]);
  const auditEventsQuery = user.role === "OWNER"
    ? prisma.auditEvent.findMany({ where: { instituteId }, orderBy: { createdAt: "desc" }, take: 100, include: { actor: { select: { name: true } } } })
    : Promise.resolve([]);
  const syllabusPlansQuery = user.role === "TRAINER" && trainer
    ? prisma.batchSubjectPlan.findMany({
        where: {
          instituteId,
          batchId: { in: ownBatchIds ?? [] },
          batch: { is: { instituteId, status: "ACTIVE", trainerAssignments: { some: { trainerId: trainer.id } } } },
          subject: { is: { status: "ACTIVE" } },
        },
        orderBy: [{ deadline: "asc" }, { batch: { name: "asc" } }, { subject: { name: "asc" } }],
        include: {
          batch: { select: { id: true, name: true, courseId: true, course: { select: { id: true, name: true } } } },
          subject: { select: { id: true, name: true, courseId: true } },
        },
      }).then((plans) => plans.filter((plan) => plan.batch.courseId === plan.subject.courseId))
    : Promise.resolve([]);
  const enrollmentsQuery = prisma.enrollment.findMany({
    where: {
      instituteId,
      status: "ACTIVE",
      ...(student ? { studentId: student.id } : trainer ? { batchId: { in: ownBatchIds ?? [] } } : {}),
    },
    orderBy: { id: "asc" },
    include: {
      student: { select: { id: true, name: true, externalRef: true } },
      batch: { include: { course: { select: { name: true } } } },
      feePlan: { select: { id: true, totalAmount: true, currency: true } },
    },
  });
  const [institute, courses, batches, trainers, counselors, counselorInvites, students, enrollments, sessions, rooms, attendance, recordings, feePlans, leads, tasks, notes, escalations, communications, bankTransactions, reminders, proposals, auditEvents, syllabusPlans] = await Promise.all([
    prisma.institute.findUnique({ where: { id: instituteId }, select: { id: true, name: true, timezone: true } }),
    prisma.course.findMany({
      where: { instituteId, status: "ACTIVE", ...(ownBatchIds ? { batches: { some: { id: { in: ownBatchIds } } } } : {}) },
      orderBy: { name: "asc" },
      select: { id: true, name: true, durationWeeks: true, status: true },
    }),
    prisma.batch.findMany({
      where: batchWhere,
      orderBy: { startDate: "desc" },
      include: {
        course: { select: { id: true, name: true } },
        trainerAssignments: { include: { trainer: { include: { user: { select: { id: true, name: true } } } } } },
        _count: { select: { enrollments: true, sessions: true } },
      },
    }),
    trainersQuery,
    counselorsQuery,
    counselorInvitesQuery,
    studentsQuery,
    enrollmentsQuery,
    sessionsQuery,
    isManagement
      ? prisma.room.findMany({ where: { instituteId }, orderBy: { name: "asc" }, select: { id: true, name: true, capacity: true } })
      : Promise.resolve([]),
    attendanceQuery,
    recordingsQuery,
    feePlansQuery,
    leadsQuery,
    tasksQuery,
    notesQuery,
    escalationsQuery,
    communicationsQuery,
    bankTransactionsQuery,
    remindersQuery,
    proposalsQuery,
    auditEventsQuery,
    syllabusPlansQuery,
  ]);

  return jsonSafe({ institute, role: user.role, courses, batches, trainers, counselors, counselorInvites, students, enrollments, sessions, rooms, attendance, recordings, feePlans, leads, tasks, notes, escalations, communications, bankTransactions, reminders, proposals, auditEvents, syllabusPlans });
}

export async function mutateWorkspace(user: AppUser, method: "POST" | "PATCH" | "DELETE", rawBody: unknown) {
  const body = object(rawBody);
  const resource = requiredString(body, "resource", 40);
  const id = method === "POST" ? undefined : requiredId(body, "id");
  const data = object(body.data ?? {});

  return prisma.$transaction(async (tx) => {
    if (method === "POST") {
      switch (resource) {
        case "counselor": {
          requireRole(user, ["OWNER"]);
          const name = requiredString(data, "name", 200);
          const email = requiredString(data, "email", 254).toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new OperationError("Enter a valid counselor email address.");

          const existingUser = await tx.user.findUnique({
            where: { email },
            include: { roles: { select: { role: true } } },
          });
          if (existingUser) {
            if (existingUser.instituteId !== user.instituteId) {
              throw new OperationError("This email is already associated with another institute.", 409);
            }
            if (existingUser.status !== "ACTIVE") throw new OperationError("Reactivate this account before assigning it as a counselor.", 409);
            if (existingUser.roles.some(({ role }) => role === "COUNSELOR")) {
              throw new OperationError("This person is already a counselor in your institute.", 409);
            }

            await tx.userRole.create({ data: { userId: existingUser.id, role: "COUNSELOR" } });
            await logChange(tx, user, "ASSIGN_ROLE", "user", existingUser.id, { role: "COUNSELOR", hasEmail: true });
            return jsonSafe({ id: existingUser.id, name: existingUser.name, email: existingUser.email, status: "ACTIVE" });
          }

          const existingInvite = await tx.registrationInvite.findUnique({
            where: { instituteId_email: { instituteId: user.instituteId, email } },
          });
          if (existingInvite) {
            if (existingInvite.role !== "COUNSELOR") {
              throw new OperationError("This email already has a pending invite for a different portal role.", 409);
            }
            const inviteIsCurrent = existingInvite.status === "PENDING" && (!existingInvite.expiresAt || existingInvite.expiresAt > new Date());
            if (inviteIsCurrent) {
              throw new OperationError("A counselor invite has already been sent to this email.", 409);
            }

            const invitation = await tx.registrationInvite.update({
              where: { id: existingInvite.id },
              data: { name, status: "PENDING", expiresAt: null, acceptedAt: null, createdAt: new Date() },
            });
            await logChange(tx, user, "REINVITE", "registration_invite", invitation.id, { role: "COUNSELOR", hasEmail: true });
            return jsonSafe({ id: invitation.id, name, email, status: "INVITED" });
          }

          const invitation = await tx.registrationInvite.create({
            data: { instituteId: user.instituteId, email, name, role: "COUNSELOR" },
          });
          await logChange(tx, user, "INVITE", "registration_invite", invitation.id, { role: "COUNSELOR", hasEmail: true });
          return jsonSafe({ id: invitation.id, name, email, status: "INVITED" });
        }
        case "course": {
          requireRole(user, ["OWNER"]);
          const name = requiredString(data, "name");
          const durationWeeks = wholeNumber(data, "durationWeeks", 1);
          const course = await tx.course.create({ data: { instituteId: user.instituteId, name, durationWeeks } });
          await logChange(tx, user, "CREATE", "course", course.id, { name, durationWeeks });
          return jsonSafe(course);
        }
        case "batch": {
          requireRole(user, ["OWNER"]);
          const courseId = requiredId(data, "courseId");
          await requireInstituteRecord(tx.course, courseId, user.instituteId, "Course");
          const name = requiredString(data, "name");
          const startDate = dateValue(data, "startDate");
          const endDate = dateValue(data, "endDate");
          if (endDate < startDate) throw new OperationError("Batch end date must be on or after its start date.");
          const mode = oneOf(data.mode, "mode", ["CLASSROOM", "ONLINE", "HYBRID"] as const);
          const onlineSeatLimit = data.onlineSeatLimit === null || data.onlineSeatLimit === undefined || data.onlineSeatLimit === "" ? null : wholeNumber(data, "onlineSeatLimit", 1);
          const preferredWindows = Array.isArray(data.preferredWindows) ? data.preferredWindows : [];
          const batch = await tx.batch.create({ data: { instituteId: user.instituteId, courseId, name, startDate, endDate, mode, onlineSeatLimit, preferredWindows: preferredWindows as Prisma.InputJsonValue } });
          await logChange(tx, user, "CREATE", "batch", batch.id, { name, courseId, mode });
          return jsonSafe(batch);
        }
        case "student": {
          requireRole(user, ["OWNER", "COUNSELOR"]);
          const name = requiredString(data, "name");
          const email = optionalString(data, "email", 254)?.toLowerCase() ?? null;
          if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new OperationError("Enter a valid student email address.");
          const externalRef = optionalString(data, "externalRef", 80);
          const phone = optionalString(data, "phone", 32);
          const guardianPhone = optionalString(data, "guardianPhone", 32);
          if (data.trainerId && !data.batchId) throw new OperationError("Choose a batch when assigning a trainer.");
          const linkedUser = email ? await tx.user.findFirst({
            where: { instituteId: user.instituteId, email: { equals: email, mode: "insensitive" }, emailVerified: true, status: "ACTIVE", roles: { some: { role: "STUDENT" } } },
            select: { id: true },
          }) : null;
          const linkedProfile = linkedUser ? await tx.student.findUnique({ where: { userId: linkedUser.id } }) : null;
          const rosterProfile = !linkedProfile && email
            ? await tx.student.findFirst({ where: { instituteId: user.instituteId, email: { equals: email, mode: "insensitive" }, userId: null } })
            : null;
          const existingStudent = linkedProfile ?? rosterProfile;
          const student = existingStudent
            ? await tx.student.update({
                where: { id: existingStudent.id },
                data: {
                  userId: linkedUser?.id ?? existingStudent.userId,
                  name,
                  email,
                  externalRef: externalRef ?? existingStudent.externalRef,
                  phone,
                  guardianPhone,
                  status: "ACTIVE",
                },
              })
            : await tx.student.create({ data: { instituteId: user.instituteId, userId: linkedUser?.id ?? null, name, email, externalRef, phone, guardianPhone } });
          if (email && !linkedUser) {
            const existingAccount = await tx.user.findUnique({ where: { email }, select: { id: true } });
            const existingInvite = await tx.registrationInvite.findUnique({
              where: { instituteId_email: { instituteId: user.instituteId, email } },
              select: { id: true },
            });
            if (!existingAccount && !existingInvite) {
              await tx.registrationInvite.create({
                data: { instituteId: user.instituteId, email, role: "STUDENT" },
              });
            }
          }
          await logChange(tx, user, existingStudent ? "UPSERT" : "CREATE", "student", student.id, { hasEmail: Boolean(email), hasExternalRef: Boolean(externalRef) });
          if (data.batchId) {
            const batchId = requiredId(data, "batchId");
            const batch = await requireInstituteRecord(tx.batch, batchId, user.instituteId, "Batch");
            if (batch.status !== "ACTIVE") throw new OperationError("Students cannot be enrolled into an inactive batch.");
            if (batch.onlineSeatLimit && (batch.mode === "ONLINE" || batch.mode === "HYBRID")) {
              const enrolled = await tx.enrollment.count({ where: { instituteId: user.instituteId, batchId, status: "ACTIVE" } });
              const existingEnrollment = await tx.enrollment.findUnique({ where: { studentId_batchId: { studentId: student.id, batchId } } });
              if (!existingEnrollment && enrolled >= batch.onlineSeatLimit) throw new OperationError("This batch has reached its online seat limit.", 409);
            }
            const trainerId = data.trainerId ? requiredId(data, "trainerId") : null;
            if (trainerId) {
              await requireInstituteRecord(tx.trainer, trainerId, user.instituteId, "Trainer");
              await tx.trainerBatchAssignment.upsert({ where: { trainerId_batchId: { trainerId, batchId } }, create: { trainerId, batchId }, update: {} });
              await logChange(tx, user, "UPSERT", "trainer_assignment", trainerId, { trainerId, batchId, source: "student_enrollment" });
            }
            const enrollment = await tx.enrollment.upsert({
              where: { studentId_batchId: { studentId: student.id, batchId } },
              create: { instituteId: user.instituteId, studentId: student.id, batchId },
              update: { instituteId: user.instituteId, status: "ACTIVE" },
            });
            await logChange(tx, user, "UPSERT", "enrollment", enrollment.id, { studentId: student.id, batchId });
          }
          return jsonSafe(student);
        }
        case "enrollment": {
          requireRole(user, ["OWNER", "COUNSELOR"]);
          const studentId = requiredId(data, "studentId");
          const batchId = requiredId(data, "batchId");
          const student = await requireInstituteRecord(tx.student, studentId, user.instituteId, "Student");
          if (student.status !== "ACTIVE") throw new OperationError("Reactivate this student before enrolling them.", 409);
          const batch = await requireInstituteRecord(tx.batch, batchId, user.instituteId, "Batch");
          if (batch.status !== "ACTIVE") throw new OperationError("Students cannot be enrolled into an inactive batch.");
          const existingEnrollment = await tx.enrollment.findUnique({ where: { studentId_batchId: { studentId, batchId } } });
          if (batch.onlineSeatLimit && (batch.mode === "ONLINE" || batch.mode === "HYBRID") && existingEnrollment?.status !== "ACTIVE") {
            const enrolled = await tx.enrollment.count({ where: { instituteId: user.instituteId, batchId, status: "ACTIVE" } });
            if (enrolled >= batch.onlineSeatLimit) throw new OperationError("This batch has reached its online seat limit.", 409);
          }
          const enrollment = await tx.enrollment.upsert({
            where: { studentId_batchId: { studentId, batchId } },
            create: { instituteId: user.instituteId, studentId, batchId },
            update: { instituteId: user.instituteId, status: "ACTIVE" },
          });
          if (data.trainerId) {
            const trainerId = requiredId(data, "trainerId");
            await requireInstituteRecord(tx.trainer, trainerId, user.instituteId, "Trainer");
            await tx.trainerBatchAssignment.upsert({
              where: { trainerId_batchId: { trainerId, batchId } },
              create: { trainerId, batchId },
              update: {},
            });
            await logChange(tx, user, "UPSERT", "trainer_assignment", trainerId, { trainerId, batchId, source: "enrollment" });
          }
          await logChange(tx, user, "UPSERT", "enrollment", enrollment.id, { studentId, batchId, status: enrollment.status });
          return jsonSafe(enrollment);
        }
        case "trainerAssignment": {
          requireRole(user, ["OWNER", "COUNSELOR"]);
          const trainerId = requiredId(data, "trainerId");
          const batchId = requiredId(data, "batchId");
          await requireInstituteRecord(tx.trainer, trainerId, user.instituteId, "Trainer");
          const batch = await requireInstituteRecord(tx.batch, batchId, user.instituteId, "Batch");
          if (batch.status !== "ACTIVE") throw new OperationError("Assign trainers only to active batches.", 409);
          const assignment = await tx.trainerBatchAssignment.upsert({
            where: { trainerId_batchId: { trainerId, batchId } },
            create: { trainerId, batchId },
            update: {},
          });
          await logChange(tx, user, "UPSERT", "trainer_assignment", trainerId, { trainerId, batchId });
          return jsonSafe(assignment);
        }
        case "session": {
          requireRole(user, ["OWNER", "COUNSELOR"]);
          const batchId = requiredId(data, "batchId");
          const trainerId = requiredId(data, "trainerId");
          const roomId = optionalString(data, "roomId", 64);
          const startsAt = dateValue(data, "startsAt");
          const endsAt = dateValue(data, "endsAt");
          if (user.role === "COUNSELOR") {
            const institute = await tx.institute.findUnique({ where: { id: user.instituteId }, select: { timezone: true } });
            validateCounselorSessionWindow(startsAt, endsAt, institute?.timezone ?? "Asia/Kolkata");
          }
          const batch = await requireInstituteRecord(tx.batch, batchId, user.instituteId, "Batch");
          if (batch.status !== "ACTIVE") throw new OperationError("Schedule sessions only in active batches.", 409);
          const mode = oneOf(data.mode, "mode", ["CLASSROOM", "ONLINE", "HYBRID"] as const);
          if (user.role === "COUNSELOR" && mode !== batch.mode) {
            throw new OperationError("Use the delivery mode configured for this batch.");
          }
          await requireInstituteRecord(tx.trainer, trainerId, user.instituteId, "Trainer");
          if (roomId) await requireInstituteRecord(tx.room, roomId, user.instituteId, "Room");
          const assigned = await tx.trainerBatchAssignment.findUnique({ where: { trainerId_batchId: { trainerId, batchId } } });
          if (!assigned) throw new OperationError("Assign this trainer to the batch before scheduling a session.");
          await checkSessionConflict(tx, user.instituteId, { trainerId, roomId, startsAt, endsAt });
          if (user.role === "COUNSELOR" && mode !== "ONLINE" && !roomId) {
            throw new OperationError("Choose a classroom for an in-person or hybrid lecture.");
          }
          if (roomId) {
            const [room, enrollmentCount] = await Promise.all([
              tx.room.findFirst({ where: { id: roomId, instituteId: user.instituteId }, select: { capacity: true } }),
              tx.enrollment.count({ where: { instituteId: user.instituteId, batchId, status: "ACTIVE" } }),
            ]);
            if (room && room.capacity < enrollmentCount) throw new OperationError("The selected room is smaller than the active batch roster.", 409);
          }
          const session = await tx.session.create({ data: { instituteId: user.instituteId, batchId, trainerId, roomId, mode, startsAt, endsAt } });
          await logChange(tx, user, "CREATE", "session", session.id, { batchId, trainerId, roomId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() });
          return jsonSafe(session);
        }
        case "attendance": {
          requireRole(user, ["TRAINER"]);
          const sessionId = requiredId(data, "sessionId");
          const studentId = requiredId(data, "studentId");
          const { session } = await assertTrainerOwnsSession(tx, user, sessionId);
          if (!session.batch.enrollments.some((enrollment) => enrollment.studentId === studentId)) {
            throw new OperationError("That student is not actively enrolled in this session's batch.", 403);
          }
          const status = oneOf(data.status, "status", ["PRESENT", "LATE", "ABSENT", "EXCUSED"] as const);
          const minutesPresent = wholeNumber(data, "minutesPresent", 0);
          const modality = oneOf(data.modality ?? (session.mode === "ONLINE" ? "ONLINE" : "CLASSROOM"), "modality", ["CLASSROOM", "ONLINE"] as const);
          const existing = await tx.attendanceSummary.findUnique({ where: { sessionId_studentId: { sessionId, studentId } } });
          const summary = await tx.attendanceSummary.upsert({
            where: { sessionId_studentId: { sessionId, studentId } },
            create: { sessionId, studentId, status, minutesPresent },
            update: { status, minutesPresent },
          });
          await tx.attendanceEvent.create({ data: { instituteId: user.instituteId, sessionId, studentId, modality, eventType: existing ? "CORRECTION" : "CHECK_IN", occurredAt: new Date(), source: "trainer_portal" } });
          await logChange(tx, user, existing ? "UPDATE" : "CREATE", "attendance", summary.id, { sessionId, studentId, status, minutesPresent });
          return jsonSafe(summary);
        }
        case "recording": {
          requireRole(user, ["OWNER", "TRAINER"]);
          const sessionId = requiredId(data, "sessionId");
          const url = requiredString(data, "url", 2048);
          if (!/^https?:\/\//i.test(url)) throw new OperationError("Recording URL must start with https:// or http://.");
          if (user.role === "TRAINER") await assertTrainerOwnsSession(tx, user, sessionId);
          else await requireInstituteRecord(tx.session, sessionId, user.instituteId, "Session");
          const recording = await tx.recording.create({ data: { instituteId: user.instituteId, sessionId, url, status: "AVAILABLE", availableAt: new Date() } });
          await logChange(tx, user, "CREATE", "recording", recording.id, { sessionId, status: recording.status });
          return jsonSafe(recording);
        }
        case "feePlan": {
          requireRole(user, ["OWNER", "ACCOUNTS"]);
          const enrollmentId = requiredId(data, "enrollmentId");
          await requireInstituteRecord(tx.enrollment, enrollmentId, user.instituteId, "Enrollment");
          if (await tx.feePlan.findUnique({ where: { enrollmentId } })) {
            throw new OperationError("A fee plan already exists for this enrollment.", 409);
          }
          const totalAmount = positiveNumber(data, "totalAmount");
          const currency = (optionalString(data, "currency", 3) ?? "INR").toUpperCase();
          if (!/^[A-Z]{3}$/.test(currency)) throw new OperationError("Currency must be a three-letter ISO code.");
          const rawInstallments = Array.isArray(data.installments) ? data.installments : [];
          if (!rawInstallments.length || rawInstallments.length > 24) throw new OperationError("Add between 1 and 24 installments.");
          const installments = rawInstallments.map((raw, index) => {
            const item = object(raw);
            return { sequenceNo: wholeNumber({ sequenceNo: item.sequenceNo ?? index + 1 }, "sequenceNo", 1), amount: positiveNumber(item, "amount"), dueAt: dateValue(item, "dueAt") };
          });
          const sum = installments.reduce((total, item) => total + item.amount, 0);
          if (Math.abs(sum - totalAmount) > 0.01) throw new OperationError("Installment amounts must add up to the fee plan total.");
          const plan = await tx.feePlan.create({ data: { instituteId: user.instituteId, enrollmentId, totalAmount, currency, installments: { create: installments.map((item) => ({ ...item, instituteId: user.instituteId })) } }, include: { installments: true } });
          await logChange(tx, user, "CREATE", "fee_plan", plan.id, { enrollmentId, totalAmount, currency, installmentCount: installments.length });
          return jsonSafe(plan);
        }
        case "payment": {
          requireRole(user, ["OWNER", "ACCOUNTS"]);
          const installmentId = requiredId(data, "installmentId");
          const installment = await requireInstituteRecord(tx.installment, installmentId, user.instituteId, "Installment");
          const amount = positiveNumber(data, "amount");
          const source = oneOf(data.source, "source", ["CASH", "UPI", "BANK_TRANSFER", "CARD", "OTHER"] as const);
          const paid = await tx.payment.aggregate({ where: { installmentId, status: "COMPLETED" }, _sum: { amount: true } });
          const refunded = await tx.payment.aggregate({ where: { installmentId, status: "REFUNDED" }, _sum: { amount: true } });
          const balance = Number(installment.amount) - Number(paid._sum.amount ?? 0) + Number(refunded._sum.amount ?? 0);
          if (amount - balance > 0.01) throw new OperationError("Payment exceeds the remaining installment balance.", 409);
          const payment = await tx.payment.create({ data: { instituteId: user.instituteId, installmentId, amount, source, reference: optionalString(data, "reference", 120), status: "COMPLETED", paidAt: dateValue({ paidAt: data.paidAt ?? new Date().toISOString() }, "paidAt") } });
          const newPaid = Number(paid._sum.amount ?? 0) + amount - Number(refunded._sum.amount ?? 0);
          await tx.installment.update({ where: { id: installmentId }, data: { status: newPaid >= Number(installment.amount) ? "PAID" : "PARTIALLY_PAID" } });
          await logChange(tx, user, "CREATE", "payment", payment.id, { installmentId, amount, source, status: payment.status });
          return jsonSafe(payment);
        }
        case "lead": {
          requireRole(user, ["OWNER", "COUNSELOR"]);
          const name = requiredString(data, "name");
          const email = optionalString(data, "email", 254)?.toLowerCase() ?? null;
          if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new OperationError("Enter a valid email address.");
          const assignedCounselorId = optionalString(data, "assignedCounselorId", 64);
          if (assignedCounselorId) await requireCounselor(tx, assignedCounselorId, user.instituteId);
          const lead = await tx.admissionLead.create({ data: {
            instituteId: user.instituteId,
            createdById: user.id,
            assignedCounselorId: assignedCounselorId ?? (user.role === "COUNSELOR" ? user.id : null),
            name, email, phone: optionalString(data, "phone", 32),
            guardianName: optionalString(data, "guardianName", 200),
            guardianPhone: optionalString(data, "guardianPhone", 32),
            targetTrack: requiredString(data, "targetTrack"),
            source: optionalString(data, "source", 80) ?? "PORTAL",
            notes: optionalString(data, "notes", 2000),
          } });
          await logChange(tx, user, "CREATE", "admission_lead", lead.id, { stage: lead.stage, targetTrack: lead.targetTrack });
          return jsonSafe(lead);
        }
        case "counselorTask": {
          requireRole(user, ["OWNER", "COUNSELOR"]);
          const studentId = optionalString(data, "studentId", 64);
          const leadId = optionalString(data, "leadId", 64);
          if (!studentId && !leadId) throw new OperationError("Link the task to a student or an admission lead.");
          if (studentId) await requireInstituteRecord(tx.student, studentId, user.instituteId, "Student");
          if (leadId) await requireInstituteRecord(tx.admissionLead, leadId, user.instituteId, "Admission lead");
          const assignedToId = optionalString(data, "assignedToId", 64) ?? (user.role === "COUNSELOR" ? user.id : null);
          if (assignedToId) await requireCounselor(tx, assignedToId, user.instituteId);
          const task = await tx.counselorTask.create({ data: {
            instituteId: user.instituteId, createdById: user.id, assignedToId, studentId, leadId,
            title: requiredString(data, "title"), dueAt: data.dueAt ? dateValue(data, "dueAt") : null,
            priority: oneOf(data.priority ?? "MEDIUM", "priority", ["LOW", "MEDIUM", "HIGH"] as const),
          } });
          await logChange(tx, user, "CREATE", "counselor_task", task.id, { priority: task.priority, dueAt: task.dueAt?.toISOString() ?? null });
          return jsonSafe(task);
        }
        case "studentNote": {
          requireRole(user, ["OWNER", "COUNSELOR", "TRAINER"]);
          const studentId = requiredId(data, "studentId");
          await requireInstituteRecord(tx.student, studentId, user.instituteId, "Student");
          if (user.role === "TRAINER") await assertTrainerOwnsStudent(tx, user, studentId);
          const note = await tx.studentNote.create({ data: {
            instituteId: user.instituteId, studentId, authorId: user.id,
            noteType: oneOf(data.noteType ?? "GENERAL", "noteType", ["GENERAL", "PHONE_CALL", "EMAIL", "WHATSAPP", "MEETING"] as const),
            body: requiredString(data, "body", 4000),
          } });
          await logChange(tx, user, "CREATE", "student_note", note.id, { studentId, noteType: note.noteType });
          return jsonSafe(note);
        }
        case "escalation": {
          requireRole(user, ["OWNER", "COUNSELOR", "TRAINER"]);
          const studentId = requiredId(data, "studentId");
          await requireInstituteRecord(tx.student, studentId, user.instituteId, "Student");
          if (user.role === "TRAINER") await assertTrainerOwnsStudent(tx, user, studentId);
          const assignedToId = optionalString(data, "assignedToId", 64);
          if (assignedToId) await requireCounselor(tx, assignedToId, user.instituteId);
          const escalation = await tx.studentEscalation.create({ data: {
            instituteId: user.instituteId, studentId, createdById: user.id, assignedToId,
            reason: requiredString(data, "reason"), details: optionalString(data, "details", 3000),
          } });
          await logChange(tx, user, "CREATE", "student_escalation", escalation.id, { studentId, status: escalation.status });
          return jsonSafe(escalation);
        }
        case "communication": {
          requireRole(user, ["OWNER", "COUNSELOR", "ACCOUNTS"]);
          const studentId = optionalString(data, "studentId", 64);
          const channel = oneOf(data.channel, "channel", ["WHATSAPP", "EMAIL"] as const);
          if (studentId) await requireInstituteRecord(tx.student, studentId, user.instituteId, "Student");
          const recipientAddress = requiredString(data, "recipientAddress", 254);
          if (channel === "EMAIL" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientAddress)) throw new OperationError("Enter a valid recipient email address.");
          if (channel === "WHATSAPP" && recipientAddress.replace(/\D/g, "").length < 10) throw new OperationError("Enter a valid WhatsApp number with at least 10 digits.");
          const status = oneOf(data.status ?? "DRAFT", "status", ["DRAFT", "QUEUED"] as const);
          const communication = await tx.communication.create({ data: {
            instituteId: user.instituteId, studentId, createdById: user.id,
            recipientName: requiredString(data, "recipientName"), recipientAddress, channel,
            template: optionalString(data, "template", 120), message: requiredString(data, "message", 4000),
            status, queuedAt: status === "QUEUED" ? new Date() : null,
          } });
          await logChange(tx, user, status === "QUEUED" ? "QUEUE" : "CREATE", "communication", communication.id, { channel, status });
          return jsonSafe(communication);
        }
        case "bankTransaction": {
          requireRole(user, ["OWNER", "ACCOUNTS"]);
          const source = oneOf(data.source, "source", ["CASH", "UPI", "BANK_TRANSFER", "CARD", "OTHER"] as const);
          const transaction = await tx.bankTransaction.create({ data: {
            instituteId: user.instituteId, importedById: user.id,
            reference: requiredString(data, "reference", 120), amount: positiveNumber(data, "amount"),
            occurredAt: dateValue(data, "occurredAt"), senderName: optionalString(data, "senderName", 200), source,
          } });
          await logChange(tx, user, "IMPORT", "bank_transaction", transaction.id, { reference: transaction.reference, amount: Number(transaction.amount), status: transaction.status });
          return jsonSafe(transaction);
        }
        case "paymentReminder": {
          requireRole(user, ["OWNER", "ACCOUNTS"]);
          const installmentId = requiredId(data, "installmentId");
          const installment = await tx.installment.findFirst({ where: { id: installmentId, instituteId: user.instituteId }, include: { feePlan: { include: { enrollment: { include: { student: true, batch: true } } } } } });
          if (!installment) throw new OperationError("Installment was not found in your institute.", 404);
          const channel = oneOf(data.channel ?? "WHATSAPP", "channel", ["WHATSAPP", "EMAIL"] as const);
          const learner = installment.feePlan.enrollment.student;
          const address = channel === "EMAIL" ? learner.email : learner.phone;
          if (!address) throw new OperationError(`This learner has no ${channel === "EMAIL" ? "email" : "phone number"} on file.`);
          const reminder = await tx.paymentReminder.create({ data: { instituteId: user.instituteId, installmentId, createdById: user.id, channel } });
          const communication = await tx.communication.create({ data: {
            instituteId: user.instituteId, studentId: learner.id, createdById: user.id,
            recipientName: learner.name, recipientAddress: address, channel, status: "QUEUED", queuedAt: new Date(),
            template: "PAYMENT_REMINDER",
            message: `Reminder: installment ${installment.sequenceNo} for ${installment.feePlan.enrollment.batch.name} is ${installment.status.toLowerCase()} for ${installment.feePlan.currency} ${Number(installment.amount).toFixed(2)}. Please contact the institute for payment details.`,
          } });
          await logChange(tx, user, "QUEUE", "payment_reminder", reminder.id, { installmentId, channel, communicationId: communication.id });
          await logChange(tx, user, "QUEUE", "communication", communication.id, { channel, status: communication.status });
          return jsonSafe({ reminder, communication });
        }
        default:
          throw new OperationError("That record type cannot be created from this workspace.", 404);
      }
    }

    if (!id) throw new OperationError("Record ID is required.");
    if (method === "DELETE" && resource === "trainerAssignment") {
      requireRole(user, ["OWNER", "COUNSELOR"]);
      const trainerId = requiredId(data, "trainerId");
      const batchId = requiredId(data, "batchId");
      await requireInstituteRecord(tx.trainer, trainerId, user.instituteId, "Trainer");
      await requireInstituteRecord(tx.batch, batchId, user.instituteId, "Batch");
      const futureSessions = await tx.session.count({ where: { instituteId: user.instituteId, trainerId, batchId, status: "SCHEDULED", startsAt: { gte: new Date() } } });
      if (futureSessions) throw new OperationError("Reassign or cancel future sessions before removing this trainer assignment.", 409);
      await tx.trainerBatchAssignment.delete({ where: { trainerId_batchId: { trainerId, batchId } } }).catch(() => { throw new OperationError("Trainer assignment was not found.", 404); });
      await logChange(tx, user, "DELETE", "trainer_assignment", trainerId, { trainerId, batchId });
      return { id, deleted: true };
    }

    const remove = method === "DELETE";
    switch (resource) {
      case "course": {
        requireRole(user, ["OWNER"]);
        const course = await requireInstituteRecord(tx.course, id, user.instituteId, "Course");
        const status = remove ? "INACTIVE" : oneOf(data.status ?? course.status, "status", ["ACTIVE", "INACTIVE", "ARCHIVED"] as const);
        if (status !== "ACTIVE") {
          const hasActiveBatch = await tx.batch.count({ where: { instituteId: user.instituteId, courseId: id, status: "ACTIVE" } });
          if (hasActiveBatch) throw new OperationError("Deactivate its active batches before archiving this course.", 409);
        }
        const updated = await tx.course.update({ where: { id }, data: { status, ...(!remove && data.name ? { name: requiredString(data, "name") } : {}), ...(!remove && data.durationWeeks ? { durationWeeks: wholeNumber(data, "durationWeeks", 1) } : {}) } });
        await logChange(tx, user, remove ? "ARCHIVE" : "UPDATE", "course", id, { status: updated.status });
        return jsonSafe(updated);
      }
      case "batch": {
        requireRole(user, ["OWNER"]);
        const batch = await requireInstituteRecord(tx.batch, id, user.instituteId, "Batch");
        const status = remove ? "INACTIVE" : oneOf(data.status ?? batch.status, "status", ["ACTIVE", "INACTIVE", "ARCHIVED"] as const);
        if (status !== "ACTIVE") {
          const activeEnrollments = await tx.enrollment.findMany({ where: { instituteId: user.instituteId, batchId: id, status: "ACTIVE" }, select: { id: true } });
          for (const enrollment of activeEnrollments) {
            await tx.enrollment.update({ where: { id: enrollment.id }, data: { status: "INACTIVE" } });
            await logChange(tx, user, "ARCHIVE", "enrollment", enrollment.id, { batchId: id, reason: "batch_deactivated" });
          }
          const futureSessions = await tx.session.findMany({ where: { instituteId: user.instituteId, batchId: id, status: "SCHEDULED", startsAt: { gte: new Date() } }, select: { id: true, scheduleVersion: true } });
          for (const session of futureSessions) {
            const updatedSession = await tx.session.update({ where: { id: session.id }, data: { status: "CANCELLED", scheduleVersion: { increment: 1 } } });
            await logChange(tx, user, "CANCEL", "session", session.id, { status: updatedSession.status, scheduleVersion: updatedSession.scheduleVersion, reason: "batch_deactivated" });
          }
        }
        const courseId = !remove && data.courseId ? requiredId(data, "courseId") : batch.courseId;
        if (courseId !== batch.courseId) await requireInstituteRecord(tx.course, courseId, user.instituteId, "Course");
        const updated = await tx.batch.update({ where: { id }, data: { status, ...(!remove && data.name ? { name: requiredString(data, "name") } : {}), courseId } });
        await logChange(tx, user, remove ? "ARCHIVE" : "UPDATE", "batch", id, { status: updated.status });
        return jsonSafe(updated);
      }
      case "student": {
        requireRole(user, ["OWNER", "COUNSELOR"]);
        const student = await requireInstituteRecord(tx.student, id, user.instituteId, "Student");
        const status = remove ? "INACTIVE" : oneOf(data.status ?? student.status, "status", ["ACTIVE", "INACTIVE", "ARCHIVED"] as const);
        const email = !remove && "email" in data ? optionalString(data, "email", 254)?.toLowerCase() ?? null : undefined;
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new OperationError("Enter a valid student email address.");
        const updated = await tx.student.update({ where: { id }, data: { status, ...(!remove && data.name ? { name: requiredString(data, "name") } : {}), ...(email !== undefined ? { email } : {}), ...(!remove && "phone" in data ? { phone: optionalString(data, "phone", 32) } : {}), ...(!remove && "guardianPhone" in data ? { guardianPhone: optionalString(data, "guardianPhone", 32) } : {}) } });
        if (status !== "ACTIVE") {
          const activeEnrollments = await tx.enrollment.findMany({ where: { instituteId: user.instituteId, studentId: id, status: "ACTIVE" }, select: { id: true, batchId: true } });
          for (const enrollment of activeEnrollments) {
            await tx.enrollment.update({ where: { id: enrollment.id }, data: { status: "INACTIVE" } });
            await logChange(tx, user, "ARCHIVE", "enrollment", enrollment.id, { studentId: id, batchId: enrollment.batchId, reason: "student_deactivated" });
          }
        }
        await logChange(tx, user, remove ? "ARCHIVE" : "UPDATE", "student", id, { status: updated.status });
        return jsonSafe(updated);
      }
      case "enrollment": {
        requireRole(user, ["OWNER", "COUNSELOR"]);
        const enrollment = await requireInstituteRecord(tx.enrollment, id, user.instituteId, "Enrollment");
        const status = remove ? "INACTIVE" : oneOf(data.status ?? enrollment.status, "status", ["ACTIVE", "INACTIVE", "ARCHIVED"] as const);
        if (status === "ACTIVE") {
          const [student, batch] = await Promise.all([
            requireInstituteRecord(tx.student, enrollment.studentId, user.instituteId, "Student"),
            requireInstituteRecord(tx.batch, enrollment.batchId, user.instituteId, "Batch"),
          ]);
          if (student.status !== "ACTIVE" || batch.status !== "ACTIVE") throw new OperationError("Reactivate the student and batch before restoring this enrollment.", 409);
        }
        const updated = await tx.enrollment.update({ where: { id }, data: { status } });
        await logChange(tx, user, remove ? "ARCHIVE" : "UPDATE", "enrollment", id, { status: updated.status });
        return jsonSafe(updated);
      }
      case "session": {
        requireRole(user, ["OWNER"]);
        const session = await requireInstituteRecord(tx.session, id, user.instituteId, "Session");
        if (remove || data.status === "CANCELLED") {
          const updated = await tx.session.update({ where: { id }, data: { status: "CANCELLED", scheduleVersion: { increment: 1 } } });
          await logChange(tx, user, "CANCEL", "session", id, { status: updated.status, scheduleVersion: updated.scheduleVersion });
          return jsonSafe(updated);
        }
        const batchId = data.batchId ? requiredId(data, "batchId") : session.batchId;
        const trainerId = data.trainerId ? requiredId(data, "trainerId") : session.trainerId;
        const roomId = "roomId" in data ? optionalString(data, "roomId", 64) : session.roomId;
        if (batchId !== session.batchId || trainerId !== session.trainerId) {
          const batch = await requireInstituteRecord(tx.batch, batchId, user.instituteId, "Batch");
          if (batch.status !== "ACTIVE") throw new OperationError("Move sessions only to active batches.", 409);
          await requireInstituteRecord(tx.trainer, trainerId, user.instituteId, "Trainer");
          const assignment = await tx.trainerBatchAssignment.findUnique({ where: { trainerId_batchId: { trainerId, batchId } } });
          if (!assignment) throw new OperationError("Assign the trainer to the batch before moving this session.");
        }
        if (roomId) await requireInstituteRecord(tx.room, roomId, user.instituteId, "Room");
        const startsAt = data.startsAt ? dateValue(data, "startsAt") : session.startsAt;
        const endsAt = data.endsAt ? dateValue(data, "endsAt") : session.endsAt;
        await checkSessionConflict(tx, user.instituteId, { trainerId, roomId, startsAt, endsAt, excludeId: id });
        const updated = await tx.session.update({ where: { id }, data: { batchId, trainerId, roomId, startsAt, endsAt, ...(data.mode ? { mode: oneOf(data.mode, "mode", ["CLASSROOM", "ONLINE", "HYBRID"] as const) } : {}), scheduleVersion: { increment: 1 } } });
        await logChange(tx, user, "UPDATE", "session", id, { batchId, trainerId, roomId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), scheduleVersion: updated.scheduleVersion });
        return jsonSafe(updated);
      }
      case "attendance": {
        requireRole(user, ["TRAINER"]);
        const summary = await requireRecord(await tx.attendanceSummary.findFirst({ where: { id, session: { is: { instituteId: user.instituteId } } }, include: { session: { select: { id: true } } } }), "Attendance record");
        await assertTrainerOwnsSession(tx, user, summary.session.id);
        const updated = await tx.attendanceSummary.update({ where: { id }, data: { status: oneOf(data.status, "status", ["PRESENT", "LATE", "ABSENT", "EXCUSED"] as const), ...(data.minutesPresent !== undefined ? { minutesPresent: wholeNumber(data, "minutesPresent", 0) } : {}) } });
        await tx.attendanceEvent.create({ data: { instituteId: user.instituteId, sessionId: summary.session.id, studentId: updated.studentId, modality: oneOf(data.modality ?? "CLASSROOM", "modality", ["CLASSROOM", "ONLINE"] as const), eventType: "CORRECTION", occurredAt: new Date(), source: "trainer_portal_correction" } });
        await logChange(tx, user, "CORRECTION", "attendance", id, { status: updated.status, minutesPresent: updated.minutesPresent });
        return jsonSafe(updated);
      }
      case "syllabusProgress": {
        requireRole(user, ["TRAINER"]);
        if (method !== "PATCH") throw new OperationError("Syllabus progress can only be updated.", 405);
        const trainer = await tx.trainer.findFirst({ where: { userId: user.id, instituteId: user.instituteId }, select: { id: true } });
        if (!trainer) throw new OperationError("Your trainer profile is not linked yet.", 403);
        const plan = await tx.batchSubjectPlan.findFirst({
          where: {
            id,
            instituteId: user.instituteId,
            batch: { is: { instituteId: user.instituteId, status: "ACTIVE", trainerAssignments: { some: { trainerId: trainer.id } } } },
            subject: { is: { status: "ACTIVE" } },
          },
          include: {
            batch: { select: { id: true, name: true, courseId: true } },
            subject: { select: { id: true, name: true, courseId: true } },
          },
        });
        if (!plan || plan.batch.courseId !== plan.subject.courseId) {
          throw new OperationError("Syllabus plan was not found in one of your assigned courses.", 404);
        }
        const completedMinutes = wholeNumber(data, "completedMinutes", 0);
        if (completedMinutes > plan.requiredMinutes) {
          throw new OperationError(`Completed minutes cannot exceed the course target of ${plan.requiredMinutes}.`);
        }
        const updated = await tx.batchSubjectPlan.update({ where: { id: plan.id }, data: { completedMinutes } });
        await logChange(tx, user, "UPDATE", "batch_subject_plan", plan.id, {
          batchId: plan.batch.id,
          batchName: plan.batch.name,
          subjectId: plan.subject.id,
          subjectName: plan.subject.name,
          completedMinutes,
          requiredMinutes: plan.requiredMinutes,
          completionPercent: Math.round((completedMinutes / Math.max(1, plan.requiredMinutes)) * 100),
        });
        return jsonSafe(updated);
      }
      case "recording": {
        requireRole(user, ["OWNER", "TRAINER"]);
        const recording = await requireInstituteRecord(tx.recording, id, user.instituteId, "Recording");
        if (user.role === "TRAINER") await assertTrainerOwnsSession(tx, user, recording.sessionId);
        const status = remove ? "UNAVAILABLE" : oneOf(data.status ?? recording.status, "status", ["PROCESSING", "AVAILABLE", "UNAVAILABLE"] as const);
        const url = !remove && data.url ? requiredString(data, "url", 2048) : recording.url;
        if (!/^https?:\/\//i.test(url)) throw new OperationError("Recording URL must start with https:// or http://.");
        const updated = await tx.recording.update({ where: { id }, data: { status, url, availableAt: status === "AVAILABLE" ? (data.availableAt ? dateValue(data, "availableAt") : recording.availableAt ?? new Date()) : null } });
        await logChange(tx, user, remove ? "UNPUBLISH" : "UPDATE", "recording", id, { status: updated.status, sessionId: updated.sessionId });
        return jsonSafe(updated);
      }
      case "installment": {
        requireRole(user, ["OWNER", "ACCOUNTS"]);
        const installment = await requireInstituteRecord(tx.installment, id, user.instituteId, "Installment");
        const status = remove ? "WAIVED" : oneOf(data.status ?? installment.status, "status", ["UPCOMING", "DUE", "OVERDUE", "WAIVED"] as const);
        if (status === "WAIVED" && (await tx.payment.count({ where: { installmentId: id, status: "COMPLETED" } })) > 0) throw new OperationError("Refund completed payments before waiving this installment.", 409);
        const updated = await tx.installment.update({ where: { id }, data: { status, ...(!remove && data.dueAt ? { dueAt: dateValue(data, "dueAt") } : {}) } });
        await logChange(tx, user, status === "WAIVED" ? "WAIVE" : "UPDATE", "installment", id, { status: updated.status });
        return jsonSafe(updated);
      }
      case "payment": {
        requireRole(user, ["OWNER", "ACCOUNTS"]);
        const payment = await requireInstituteRecord(tx.payment, id, user.instituteId, "Payment");
        const status = remove ? "REFUNDED" : oneOf(data.status ?? payment.status, "status", ["COMPLETED", "REFUNDED"] as const);
        const updated = await tx.payment.update({ where: { id }, data: { status } });
        const totals = await tx.payment.aggregate({ where: { installmentId: payment.installmentId, status: "COMPLETED" }, _sum: { amount: true } });
        const refunded = await tx.payment.aggregate({ where: { installmentId: payment.installmentId, status: "REFUNDED" }, _sum: { amount: true } });
        const installment = await tx.installment.findUniqueOrThrow({ where: { id: payment.installmentId } });
        const netPaid = Number(totals._sum.amount ?? 0) - Number(refunded._sum.amount ?? 0);
        await tx.installment.update({ where: { id: installment.id }, data: { status: netPaid <= 0 ? "DUE" : netPaid >= Number(installment.amount) ? "PAID" : "PARTIALLY_PAID" } });
        await logChange(tx, user, status === "REFUNDED" ? "REFUND" : "UPDATE", "payment", id, { status: updated.status, installmentId: payment.installmentId });
        return jsonSafe(updated);
      }
      case "lead": {
        requireRole(user, ["OWNER", "COUNSELOR"]);
        const lead = await requireInstituteRecord(tx.admissionLead, id, user.instituteId, "Admission lead");
        const assignedCounselorId = "assignedCounselorId" in data ? optionalString(data, "assignedCounselorId", 64) : lead.assignedCounselorId;
        if (assignedCounselorId) await requireCounselor(tx, assignedCounselorId, user.instituteId);
        const stage = oneOf(data.stage ?? lead.stage, "stage", ["NEW", "CONTACTED", "DEMO_ATTENDED", "READY_TO_ENROLL", "ENROLLED", "LOST"] as const);
        const updated = await tx.admissionLead.update({ where: { id }, data: {
          stage,
          assignedCounselorId,
          ...("notes" in data ? { notes: optionalString(data, "notes", 2000) } : {}),
        } });
        await logChange(tx, user, "UPDATE", "admission_lead", id, { stage: updated.stage, assignedCounselorId: updated.assignedCounselorId });
        return jsonSafe(updated);
      }
      case "counselorTask": {
        requireRole(user, ["OWNER", "COUNSELOR"]);
        const task = await requireInstituteRecord(tx.counselorTask, id, user.instituteId, "Counselor task");
        if (user.role === "COUNSELOR" && task.assignedToId && task.assignedToId !== user.id && task.createdById !== user.id) {
          throw new OperationError("You can update only tasks assigned to or created by you.", 403);
        }
        const completed = data.completed === true;
        const updated = await tx.counselorTask.update({ where: { id }, data: {
          ...(data.title ? { title: requiredString(data, "title") } : {}),
          ...(data.dueAt !== undefined ? { dueAt: data.dueAt ? dateValue(data, "dueAt") : null } : {}),
          ...(data.priority ? { priority: oneOf(data.priority, "priority", ["LOW", "MEDIUM", "HIGH"] as const) } : {}),
          ...(data.completed !== undefined ? { completedAt: completed ? new Date() : null } : {}),
        } });
        await logChange(tx, user, data.completed !== undefined ? (completed ? "COMPLETE" : "REOPEN") : "UPDATE", "counselor_task", id, { completed: Boolean(updated.completedAt), priority: updated.priority });
        return jsonSafe(updated);
      }
      case "studentNote": {
        throw new OperationError("Student notes are append-only and cannot be edited or deleted.", 405);
      }
      case "escalation": {
        requireRole(user, ["OWNER", "COUNSELOR"]);
        const escalation = await requireInstituteRecord(tx.studentEscalation, id, user.instituteId, "Student escalation");
        const status = oneOf(data.status ?? escalation.status, "status", ["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"] as const);
        const assignedToId = "assignedToId" in data ? optionalString(data, "assignedToId", 64) : escalation.assignedToId;
        if (assignedToId) await requireCounselor(tx, assignedToId, user.instituteId);
        const updated = await tx.studentEscalation.update({ where: { id }, data: {
          status, assignedToId,
          ...(status === "RESOLVED" || status === "CLOSED" ? { resolvedAt: escalation.resolvedAt ?? new Date() } : { resolvedAt: null }),
        } });
        await logChange(tx, user, "UPDATE", "student_escalation", id, { status: updated.status, assignedToId: updated.assignedToId });
        return jsonSafe(updated);
      }
      case "communication": {
        requireRole(user, ["OWNER", "COUNSELOR", "ACCOUNTS"]);
        const communication = await requireInstituteRecord(tx.communication, id, user.instituteId, "Communication");
        if (communication.status === "SENT" || communication.status === "DELIVERED" || communication.status === "READ") {
          throw new OperationError("A message already handed to the provider cannot be edited here.", 409);
        }
        const status = oneOf(data.status ?? communication.status, "status", ["DRAFT", "QUEUED"] as const);
        const updated = await tx.communication.update({ where: { id }, data: {
          status,
          ...(data.message ? { message: requiredString(data, "message", 4000) } : {}),
          queuedAt: status === "QUEUED" ? communication.queuedAt ?? new Date() : null,
        } });
        await logChange(tx, user, status === "QUEUED" ? "QUEUE" : "UPDATE", "communication", id, { status });
        return jsonSafe(updated);
      }
      case "bankTransaction": {
        requireRole(user, ["OWNER", "ACCOUNTS"]);
        const transaction = await requireInstituteRecord(tx.bankTransaction, id, user.instituteId, "Bank transaction");
        if (transaction.status === "MATCHED") throw new OperationError("A reconciled transaction cannot be matched or ignored again.", 409);
        const action = oneOf(data.action, "action", ["MATCH", "IGNORE"] as const);
        if (action === "IGNORE") {
          const updated = await tx.bankTransaction.update({ where: { id }, data: { status: "IGNORED" } });
          await logChange(tx, user, "IGNORE", "bank_transaction", id, { status: updated.status });
          return jsonSafe(updated);
        }
        const installmentId = requiredId(data, "installmentId");
        const installment = await requireInstituteRecord(tx.installment, installmentId, user.instituteId, "Installment");
        const paid = await tx.payment.aggregate({ where: { installmentId, status: "COMPLETED" }, _sum: { amount: true } });
        const refunded = await tx.payment.aggregate({ where: { installmentId, status: "REFUNDED" }, _sum: { amount: true } });
        const balance = Number(installment.amount) - Number(paid._sum.amount ?? 0) + Number(refunded._sum.amount ?? 0);
        if (Number(transaction.amount) - balance > 0.01) throw new OperationError("The bank transaction exceeds this installment's remaining balance.", 409);
        const payment = await tx.payment.create({ data: {
          instituteId: user.instituteId, installmentId, amount: transaction.amount,
          paidAt: transaction.occurredAt, reference: transaction.reference,
          source: transaction.source, status: "COMPLETED",
        } });
        const updated = await tx.bankTransaction.update({ where: { id }, data: { paymentId: payment.id, status: "MATCHED" } });
        const netPaid = Number(paid._sum.amount ?? 0) + Number(transaction.amount) - Number(refunded._sum.amount ?? 0);
        await tx.installment.update({ where: { id: installmentId }, data: { status: netPaid >= Number(installment.amount) ? "PAID" : "PARTIALLY_PAID" } });
        await logChange(tx, user, "MATCH", "bank_transaction", id, { paymentId: payment.id, installmentId, amount: Number(transaction.amount) });
        await logChange(tx, user, "CREATE", "payment", payment.id, { installmentId, source: transaction.source, status: payment.status });
        return jsonSafe(updated);
      }
      case "paymentReminder": {
        throw new OperationError("Payment reminders are immutable queue records. Create a new reminder instead.", 405);
      }
      case "actionProposal": {
        requireRole(user, ["OWNER"]);
        const proposal = await requireInstituteRecord(tx.actionProposal, id, user.instituteId, "Action proposal");
        if (proposal.status !== "PENDING") throw new OperationError("This proposal has already been decided.", 409);
        if (proposal.expiresAt && proposal.expiresAt <= new Date()) throw new OperationError("This proposal has expired and cannot be approved.", 409);
        const decision = oneOf(data.decision, "decision", ["APPROVED", "REJECTED"] as const);
        await tx.actionApproval.create({ data: { proposalId: id, approverId: user.id, decision } });
        const status = decision === "APPROVED" ? "APPROVED" : "REJECTED";
        const updated = await tx.actionProposal.update({ where: { id }, data: { status } });
        await logChange(tx, user, decision, "action_proposal", id, { actionType: proposal.actionType, status });
        return jsonSafe(updated);
      }
      default:
        throw new OperationError("That record type cannot be updated from this workspace.", 404);
    }
  });
}

export function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, item: unknown) => {
    if (item && typeof item === "object" && "toNumber" in item && typeof item.toNumber === "function") return item.toNumber();
    if (typeof item === "bigint") return item.toString();
    return item;
  })) as T;
}
