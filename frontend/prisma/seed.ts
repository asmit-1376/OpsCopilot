import type { Batch as BatchRecord, Enrollment as EnrollmentRecord } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../prisma";

const instituteName = "OpsCopilot Demo Institute";
const at = (value: string) => new Date(value);
const trainerSeedPassword = process.env.SEED_TRAINER_PASSWORD ?? "TrainerDemo#2026";
const legacyTrainerEmails = [
  "amit.kulkarni@demo.opscopilot.invalid",
  "neha.rao@demo.opscopilot.invalid",
  "sameer.deshmukh@demo.opscopilot.invalid",
];

function seededCompletionMinutes(seed: string, requiredMinutes: number) {
  let hash = 2_166_136_261;
  for (const character of seed) hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619);
  const completionRatio = 0.22 + ((hash >>> 0) % 5_300) / 10_000;
  return Math.floor((requiredMinutes * completionRatio) / 60) * 60;
}

function seededAttendance(seed: string) {
  let hash = 2_166_136_261;
  for (const character of seed) hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619);
  const bucket = (hash >>> 0) % 100;
  if (bucket < 76) return { status: "PRESENT" as const, minutesPresent: 120 };
  if (bucket < 89) return { status: "LATE" as const, minutesPresent: 90 };
  if (bucket < 94) return { status: "EXCUSED" as const, minutesPresent: 0 };
  return { status: "ABSENT" as const, minutesPresent: 0 };
}

async function ensureTrainer(instituteId: string, name: string, email: string, skills: string[]) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.instituteId !== instituteId) {
    throw new Error(`Seed trainer ${email} already belongs to another institute; no records were changed.`);
  }
  const user = existing ?? await prisma.user.create({
    data: {
      instituteId,
      name,
      email,
      emailVerified: true,
      hasLoggedIn: true,
      requestedRole: "TRAINER",
      status: "ACTIVE",
    },
  });
  if (existing) {
    await prisma.user.update({
      where: { id: user.id },
      data: { name, emailVerified: true, hasLoggedIn: true, requestedRole: "TRAINER", status: "ACTIVE" },
    });
  }
  await prisma.userRole.upsert({
    where: { userId_role: { userId: user.id, role: "TRAINER" } },
    create: { userId: user.id, role: "TRAINER" },
    update: {},
  });
  const password = await hashPassword(trainerSeedPassword);
  await prisma.account.upsert({
    where: { providerId_accountId: { providerId: "credential", accountId: user.id } },
    create: { userId: user.id, providerId: "credential", accountId: user.id, password },
    update: { password },
  });
  const trainer = await prisma.trainer.upsert({
    where: { userId: user.id },
    create: { instituteId, userId: user.id, skills },
    update: { skills },
  });
  await prisma.trainerAvailability.deleteMany({ where: { trainerId: trainer.id } });
  await prisma.trainerAvailability.createMany({
    data: Array.from({ length: 5 }, (_, index) => ({
      trainerId: trainer.id,
      dayOfWeek: index + 1,
      startTime: at("1970-01-01T09:00:00+05:30"),
      endTime: at("1970-01-01T18:00:00+05:30"),
      available: true,
    })),
  });
  return trainer;
}

async function replaceLegacyDemoTrainers(instituteId: string, replacements: Array<{ email: string; trainerId: string }>) {
  const legacyUsers = await prisma.user.findMany({
    where: { instituteId, email: { in: legacyTrainerEmails } },
    include: { trainer: { select: { id: true } } },
  });
  for (const legacyUser of legacyUsers) {
    const legacyTrainerId = legacyUser.trainer?.id;
    const replacement = replacements[legacyTrainerEmails.indexOf(legacyUser.email)];
    if (!legacyTrainerId || !replacement) continue;
    await prisma.session.updateMany({ where: { instituteId, trainerId: legacyTrainerId }, data: { trainerId: replacement.trainerId } });
    await prisma.trainer.delete({ where: { id: legacyTrainerId } });
    await prisma.user.delete({ where: { id: legacyUser.id } });
  }
}

async function ensureRoleUser(instituteId: string, name: string, email: string, role: "OWNER" | "COUNSELOR" | "ACCOUNTS") {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.instituteId !== instituteId) {
    throw new Error(`Seed staff ${email} already belongs to another institute; no records were changed.`);
  }
  const user = existing ?? await prisma.user.create({
    data: { instituteId, name, email, emailVerified: false, requestedRole: role, status: "ACTIVE" },
  });
  await prisma.userRole.upsert({
    where: { userId_role: { userId: user.id, role } },
    create: { userId: user.id, role },
    update: {},
  });
  return user;
}

async function ensureRoom(instituteId: string, name: string, capacity: number, capabilities: string[]) {
  return prisma.room.upsert({
    where: { instituteId_name: { instituteId, name } },
    create: { instituteId, name, capacity, capabilities },
    update: {},
  });
}

async function ensureSession(input: {
  instituteId: string;
  batchId: string;
  trainerId: string;
  roomId?: string | null;
  mode: "CLASSROOM" | "ONLINE" | "HYBRID";
  status?: "SCHEDULED" | "COMPLETED";
  startsAt: Date;
  endsAt: Date;
}) {
  const existing = await prisma.session.findFirst({
    where: { instituteId: input.instituteId, batchId: input.batchId, startsAt: input.startsAt },
  });
  if (existing) return existing;
  return prisma.session.create({
    data: {
      instituteId: input.instituteId,
      batchId: input.batchId,
      trainerId: input.trainerId,
      roomId: input.roomId ?? null,
      mode: input.mode,
      status: input.status ?? "SCHEDULED",
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    },
  });
}

async function ensureFeePlan(enrollmentId: string, instituteId: string, externalRef: string) {
  const existing = await prisma.feePlan.findUnique({ where: { enrollmentId } });
  if (existing) return existing;

  const plan = await prisma.feePlan.create({
    data: {
      instituteId,
      enrollmentId,
      totalAmount: 65_000,
      currency: "INR",
      installments: {
        create: [
          {
            instituteId,
            sequenceNo: 1,
            amount: 25_000,
            dueAt: at("2026-08-15T00:00:00+05:30"),
            status: "PAID",
            payments: { create: { instituteId, amount: 25_000, paidAt: at("2026-08-15T10:00:00+05:30"), reference: `DEMO-${externalRef}-1`, source: "UPI", status: "COMPLETED" } },
          },
          {
            instituteId,
            sequenceNo: 2,
            amount: 25_000,
            dueAt: at("2026-10-15T00:00:00+05:30"),
            status: "PAID",
            payments: { create: { instituteId, amount: 25_000, paidAt: at("2026-10-15T10:00:00+05:30"), reference: `DEMO-${externalRef}-2`, source: "BANK_TRANSFER", status: "COMPLETED" } },
          },
          { instituteId, sequenceNo: 3, amount: 15_000, dueAt: at("2026-11-15T00:00:00+05:30"), status: "UPCOMING" },
        ],
      },
    },
    include: { installments: true },
  });

  return plan;
}

async function main() {
  const institute = await prisma.institute.findFirst({ where: { name: instituteName } })
    ?? await prisma.institute.create({ data: { name: instituteName, timezone: "Asia/Kolkata" } });

  const [fullStack, cloud, ai] = await Promise.all([
    prisma.course.upsert({ where: { instituteId_name: { instituteId: institute.id, name: "Full Stack Development" } }, create: { instituteId: institute.id, name: "Full Stack Development", durationWeeks: 24 }, update: {} }),
    prisma.course.upsert({ where: { instituteId_name: { instituteId: institute.id, name: "Cloud & DevOps" } }, create: { instituteId: institute.id, name: "Cloud & DevOps", durationWeeks: 16 }, update: {} }),
    prisma.course.upsert({ where: { instituteId_name: { instituteId: institute.id, name: "Applied Generative AI" } }, create: { instituteId: institute.id, name: "Applied Generative AI", durationWeeks: 12 }, update: {} }),
  ]);

  const [riya, kavya, arjun] = await Promise.all([
    ensureTrainer(institute.id, "Riya Mehta", "riya.mehta@demo.opscopilot.invalid", ["React", "Node.js", "Full Stack"]),
    ensureTrainer(institute.id, "Kavya Shah", "kavya.shah@demo.opscopilot.invalid", ["Generative AI", "Python", "Data", "React"]),
    ensureTrainer(institute.id, "Arjun Patil", "arjun.patil@demo.opscopilot.invalid", ["Cloud", "AWS", "DevOps", "React"]),
  ]);
  await replaceLegacyDemoTrainers(institute.id, [
    { email: legacyTrainerEmails[0], trainerId: riya.id },
    { email: legacyTrainerEmails[1], trainerId: kavya.id },
    { email: legacyTrainerEmails[2], trainerId: arjun.id },
  ]);
  await ensureRoleUser(institute.id, "Demo Owner", "owner@demo.opscopilot.invalid", "OWNER");
  const [counselorUser, accountsUser] = await Promise.all([
    ensureRoleUser(institute.id, "Demo Counselor", "counselor@demo.opscopilot.invalid", "COUNSELOR"),
    ensureRoleUser(institute.id, "Demo Accounts", "accounts@demo.opscopilot.invalid", "ACCOUNTS"),
  ]);

  const [lab101, lab102, onlineRoom] = await Promise.all([
    ensureRoom(institute.id, "Lab 101", 32, ["CLASSROOM", "PROJECTOR"]),
    ensureRoom(institute.id, "Lab 102", 28, ["CLASSROOM", "PROJECTOR"]),
    ensureRoom(institute.id, "Online Room", 100, ["ONLINE", "RECORDING"]),
  ]);

  const batchSpecs = [
    { course: fullStack, name: "FS-09", trainer: riya, room: lab101, mode: "HYBRID" as const, limit: 32 },
    { course: cloud, name: "CLOUD-02", trainer: arjun, room: lab102, mode: "CLASSROOM" as const, limit: null },
    { course: ai, name: "AI-03", trainer: kavya, room: onlineRoom, mode: "ONLINE" as const, limit: 100 },
  ];
  const batches: Array<{
    course: typeof fullStack;
    name: string;
    trainer: typeof riya;
    room: typeof lab101;
    mode: "CLASSROOM" | "ONLINE" | "HYBRID";
    limit: number | null;
    record: BatchRecord;
  }> = [];
  for (const spec of batchSpecs) {
    const batch = await prisma.batch.upsert({
      where: { instituteId_name: { instituteId: institute.id, name: spec.name } },
      create: {
        instituteId: institute.id,
        courseId: spec.course.id,
        name: spec.name,
        startDate: at("2026-10-01T00:00:00+05:30"),
        endDate: at("2027-03-31T23:59:59+05:30"),
        preferredWindows: [{ dayOfWeek: 1, start: "09:30", end: "11:30" }, { dayOfWeek: 3, start: "09:30", end: "11:30" }],
        mode: spec.mode,
        onlineSeatLimit: spec.limit,
      },
      update: {},
    });
    await prisma.trainerBatchAssignment.upsert({
      where: { trainerId_batchId: { trainerId: spec.trainer.id, batchId: batch.id } },
      create: { trainerId: spec.trainer.id, batchId: batch.id },
      update: {},
    });
    batches.push({ ...spec, record: batch });
  }

  const [reactSubject, cloudSubject, aiSubject] = await Promise.all([
    prisma.subject.upsert({ where: { courseId_name: { courseId: fullStack.id, name: "React" } }, create: { instituteId: institute.id, courseId: fullStack.id, name: "React" }, update: {} }),
    prisma.subject.upsert({ where: { courseId_name: { courseId: cloud.id, name: "AWS & DevOps" } }, create: { instituteId: institute.id, courseId: cloud.id, name: "AWS & DevOps" }, update: {} }),
    prisma.subject.upsert({ where: { courseId_name: { courseId: ai.id, name: "Generative AI" } }, create: { instituteId: institute.id, courseId: ai.id, name: "Generative AI" }, update: {} }),
  ]);
  await Promise.all([
    prisma.trainerSubjectEligibility.upsert({ where: { trainerId_subjectId: { trainerId: riya.id, subjectId: reactSubject.id } }, create: { trainerId: riya.id, subjectId: reactSubject.id, proficiencyLevel: 5 }, update: { active: true, proficiencyLevel: 5 } }),
    prisma.trainerSubjectEligibility.upsert({ where: { trainerId_subjectId: { trainerId: arjun.id, subjectId: reactSubject.id } }, create: { trainerId: arjun.id, subjectId: reactSubject.id, proficiencyLevel: 4 }, update: { active: true, proficiencyLevel: 4 } }),
    prisma.trainerSubjectEligibility.upsert({ where: { trainerId_subjectId: { trainerId: kavya.id, subjectId: reactSubject.id } }, create: { trainerId: kavya.id, subjectId: reactSubject.id, proficiencyLevel: 3 }, update: { active: true, proficiencyLevel: 3 } }),
    prisma.trainerSubjectEligibility.upsert({ where: { trainerId_subjectId: { trainerId: arjun.id, subjectId: cloudSubject.id } }, create: { trainerId: arjun.id, subjectId: cloudSubject.id, proficiencyLevel: 5 }, update: { active: true, proficiencyLevel: 5 } }),
    prisma.trainerSubjectEligibility.upsert({ where: { trainerId_subjectId: { trainerId: kavya.id, subjectId: aiSubject.id } }, create: { trainerId: kavya.id, subjectId: aiSubject.id, proficiencyLevel: 5 }, update: { active: true, proficiencyLevel: 5 } }),
  ]);
  await Promise.all([
    prisma.batchSubjectPlan.upsert({ where: { batchId_subjectId: { batchId: batches[0].record.id, subjectId: reactSubject.id } }, create: { instituteId: institute.id, batchId: batches[0].record.id, subjectId: reactSubject.id, requiredMinutes: 2400, completedMinutes: seededCompletionMinutes("FS-09:React", 2400), deadline: at("2026-11-30T00:00:00+05:30"), minimumSessionsPerWeek: 2, maximumSessionsPerWeek: 5 }, update: {} }),
    prisma.batchSubjectPlan.upsert({ where: { batchId_subjectId: { batchId: batches[1].record.id, subjectId: cloudSubject.id } }, create: { instituteId: institute.id, batchId: batches[1].record.id, subjectId: cloudSubject.id, requiredMinutes: 1920, completedMinutes: seededCompletionMinutes("CLOUD-02:AWS & DevOps", 1920), deadline: at("2026-12-15T00:00:00+05:30") }, update: {} }),
    prisma.batchSubjectPlan.upsert({ where: { batchId_subjectId: { batchId: batches[2].record.id, subjectId: aiSubject.id } }, create: { instituteId: institute.id, batchId: batches[2].record.id, subjectId: aiSubject.id, requiredMinutes: 1440, completedMinutes: seededCompletionMinutes("AI-03:Generative AI", 1440), deadline: at("2026-12-01T00:00:00+05:30") }, update: {} }),
  ]);

  const studentSpecs = [
    ["Sneha Joshi", "STU-2026-089", "sneha.joshi@demo.opscopilot.invalid"],
    ["Rohan Deshmukh", "STU-2026-092", "rohan.deshmukh@demo.opscopilot.invalid"],
    ["Priya Nair", "STU-2026-103", "priya.nair@demo.opscopilot.invalid"],
    ["Kunal Sharma", "STU-2026-112", "kunal.sharma@demo.opscopilot.invalid"],
    ["Ananya Sen", "STU-2026-118", "ananya.sen@demo.opscopilot.invalid"],
    ["Vikas Shinde", "STU-2026-121", "vikas.shinde@demo.opscopilot.invalid"],
    ["Harshita Shinde", "STU-2026-127", "harshita.shinde@demo.opscopilot.invalid"],
    ["Nikhil Kadam", "STU-2026-132", "nikhil.kadam@demo.opscopilot.invalid"],
    ["Rahul Verma", "STU-2026-139", "rahul.verma@demo.opscopilot.invalid"],
    ["Aarav Kulkarni", "STU-2026-144", "aarav.kulkarni@demo.opscopilot.invalid"],
    ["Meera Patil", "STU-2026-151", "meera.patil@demo.opscopilot.invalid"],
    ["Ishaan Rao", "STU-2026-156", "ishaan.rao@demo.opscopilot.invalid"],
  ] as const;
  const students = [];
  for (const [name, externalRef, email] of studentSpecs) {
    const student = await prisma.student.upsert({
      where: { instituteId_externalRef: { instituteId: institute.id, externalRef } },
      create: { instituteId: institute.id, name, externalRef, email, phone: "+91 90000 00000", guardianPhone: "+91 91111 11111" },
      update: {},
    });
    students.push(student);
  }

  const linkedStudentUser = await prisma.user.findFirst({
    where: { instituteId: institute.id, status: "ACTIVE", roles: { some: { role: "STUDENT" } } },
    include: { student: true },
    orderBy: { createdAt: "asc" },
  });
  if (linkedStudentUser) {
    const linkedStudent = linkedStudentUser.student
      ? await prisma.student.update({ where: { id: linkedStudentUser.student.id }, data: { externalRef: linkedStudentUser.student.externalRef ?? `LIVE-${linkedStudentUser.id.slice(0, 8).toUpperCase()}`, email: linkedStudentUser.email } })
      : await prisma.student.create({ data: { instituteId: institute.id, userId: linkedStudentUser.id, name: linkedStudentUser.name, email: linkedStudentUser.email, externalRef: `LIVE-${linkedStudentUser.id.slice(0, 8).toUpperCase()}` } });
    students.unshift(linkedStudent);
  }

  const enrollments: Array<{ student: (typeof students)[number]; batch: BatchRecord; enrollment: EnrollmentRecord }> = [];
  for (const [index, student] of students.entries()) {
    const chosen = index % 4 === 0 ? [batches[0].record, batches[1].record] : [batches[index % batches.length].record];
    for (const batch of chosen) {
      const enrollment = await prisma.enrollment.upsert({
        where: { studentId_batchId: { studentId: student.id, batchId: batch.id } },
        create: { instituteId: institute.id, studentId: student.id, batchId: batch.id },
        update: {},
      });
      enrollments.push({ student, batch, enrollment });
      await ensureFeePlan(enrollment.id, institute.id, student.externalRef ?? student.id.slice(0, 8));
    }
  }

  const sessions = await Promise.all([
    ensureSession({ instituteId: institute.id, batchId: batches[0].record.id, trainerId: riya.id, roomId: lab101.id, mode: "HYBRID", status: "COMPLETED", startsAt: at("2026-10-16T09:30:00+05:30"), endsAt: at("2026-10-16T11:30:00+05:30") }),
    ensureSession({ instituteId: institute.id, batchId: batches[0].record.id, trainerId: riya.id, roomId: lab101.id, mode: "HYBRID", startsAt: at("2026-10-19T09:30:00+05:30"), endsAt: at("2026-10-19T11:30:00+05:30") }),
    ensureSession({ instituteId: institute.id, batchId: batches[1].record.id, trainerId: arjun.id, roomId: lab102.id, mode: "CLASSROOM", startsAt: at("2026-10-20T13:00:00+05:30"), endsAt: at("2026-10-20T15:00:00+05:30") }),
    ensureSession({ instituteId: institute.id, batchId: batches[2].record.id, trainerId: kavya.id, roomId: onlineRoom.id, mode: "ONLINE", startsAt: at("2026-10-21T13:00:00+05:30"), endsAt: at("2026-10-21T15:00:00+05:30") }),
  ]);
  await Promise.all([
    prisma.session.update({ where: { id: sessions[0].id }, data: { subjectId: reactSubject.id } }),
    prisma.session.update({ where: { id: sessions[1].id }, data: { subjectId: reactSubject.id } }),
    prisma.session.update({ where: { id: sessions[2].id }, data: { subjectId: cloudSubject.id } }),
    prisma.session.update({ where: { id: sessions[3].id }, data: { subjectId: aiSubject.id } }),
  ]);

  const fsStudents = students.filter((student) => enrollments.some(({ student: enrolled, batch }) => enrolled.id === student.id && batch.id === batches[0].record.id));
  const attendanceSessions = [
    await Promise.all([
      ensureSession({ instituteId: institute.id, batchId: batches[0].record.id, trainerId: riya.id, roomId: lab101.id, mode: "HYBRID", status: "COMPLETED", startsAt: at("2026-10-12T09:30:00+05:30"), endsAt: at("2026-10-12T11:30:00+05:30") }),
      ensureSession({ instituteId: institute.id, batchId: batches[0].record.id, trainerId: riya.id, roomId: lab101.id, mode: "HYBRID", status: "COMPLETED", startsAt: at("2026-10-13T09:30:00+05:30"), endsAt: at("2026-10-13T11:30:00+05:30") }),
      ensureSession({ instituteId: institute.id, batchId: batches[0].record.id, trainerId: riya.id, roomId: lab101.id, mode: "HYBRID", status: "COMPLETED", startsAt: at("2026-10-14T09:30:00+05:30"), endsAt: at("2026-10-14T11:30:00+05:30") }),
      sessions[0],
    ]),
    await Promise.all([
      ensureSession({ instituteId: institute.id, batchId: batches[1].record.id, trainerId: arjun.id, roomId: lab102.id, mode: "CLASSROOM", status: "COMPLETED", startsAt: at("2026-10-12T12:00:00+05:30"), endsAt: at("2026-10-12T14:00:00+05:30") }),
      ensureSession({ instituteId: institute.id, batchId: batches[1].record.id, trainerId: arjun.id, roomId: lab102.id, mode: "CLASSROOM", status: "COMPLETED", startsAt: at("2026-10-13T12:00:00+05:30"), endsAt: at("2026-10-13T14:00:00+05:30") }),
      ensureSession({ instituteId: institute.id, batchId: batches[1].record.id, trainerId: arjun.id, roomId: lab102.id, mode: "CLASSROOM", status: "COMPLETED", startsAt: at("2026-10-14T12:00:00+05:30"), endsAt: at("2026-10-14T14:00:00+05:30") }),
      ensureSession({ instituteId: institute.id, batchId: batches[1].record.id, trainerId: arjun.id, roomId: lab102.id, mode: "CLASSROOM", status: "COMPLETED", startsAt: at("2026-10-15T12:00:00+05:30"), endsAt: at("2026-10-15T14:00:00+05:30") }),
    ]),
    await Promise.all([
      ensureSession({ instituteId: institute.id, batchId: batches[2].record.id, trainerId: kavya.id, roomId: onlineRoom.id, mode: "ONLINE", status: "COMPLETED", startsAt: at("2026-10-12T14:30:00+05:30"), endsAt: at("2026-10-12T16:30:00+05:30") }),
      ensureSession({ instituteId: institute.id, batchId: batches[2].record.id, trainerId: kavya.id, roomId: onlineRoom.id, mode: "ONLINE", status: "COMPLETED", startsAt: at("2026-10-13T14:30:00+05:30"), endsAt: at("2026-10-13T16:30:00+05:30") }),
      ensureSession({ instituteId: institute.id, batchId: batches[2].record.id, trainerId: kavya.id, roomId: onlineRoom.id, mode: "ONLINE", status: "COMPLETED", startsAt: at("2026-10-14T14:30:00+05:30"), endsAt: at("2026-10-14T16:30:00+05:30") }),
      ensureSession({ instituteId: institute.id, batchId: batches[2].record.id, trainerId: kavya.id, roomId: onlineRoom.id, mode: "ONLINE", status: "COMPLETED", startsAt: at("2026-10-15T14:30:00+05:30"), endsAt: at("2026-10-15T16:30:00+05:30") }),
    ]),
  ];
  await Promise.all([
    ...attendanceSessions.flatMap((courseSessions, index) => courseSessions.map((session) => prisma.session.update({ where: { id: session.id }, data: { subjectId: [reactSubject, cloudSubject, aiSubject][index].id } }))),
  ]);
  for (const [batchIndex, batch] of batches.entries()) {
    const courseStudents = enrollments
      .filter(({ batch: enrollmentBatch }) => enrollmentBatch.id === batch.record.id)
      .map(({ student }) => student);
    const courseSessions = attendanceSessions[batchIndex];
    for (const student of courseStudents) {
      for (const session of courseSessions) {
        const attendance = seededAttendance(`${batch.record.id}:${student.id}:${session.id}:attendance-v1`);
        await prisma.attendanceSummary.upsert({
          where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } },
          create: { sessionId: session.id, studentId: student.id, ...attendance },
          update: {},
        });
      }
    }
  }

  for (const [index, session] of sessions.entries()) {
    const url = `https://example.com/demo-recordings/session-${index + 1}`;
    const exists = await prisma.recording.findFirst({ where: { instituteId: institute.id, sessionId: session.id, url } });
    if (!exists) await prisma.recording.create({ data: { instituteId: institute.id, sessionId: session.id, url, status: "AVAILABLE", availableAt: new Date() } });
  }

  const demoLeadEmail = "kavya.shah@prospect.opscopilot.invalid";
  const lead = await prisma.admissionLead.upsert({
    where: { instituteId_email: { instituteId: institute.id, email: demoLeadEmail } },
    create: {
      instituteId: institute.id, createdById: counselorUser.id, assignedCounselorId: counselorUser.id,
      name: "Kavya Shah", email: demoLeadEmail, phone: "+91 92222 00111", guardianName: "Nilesh Shah",
      guardianPhone: "+91 93333 00111", targetTrack: "Applied Generative AI", source: "Website",
      stage: "DEMO_ATTENDED", notes: "Attended the Saturday orientation; follow up on course schedule.",
    },
    update: {},
  });
  const followUpTask = await prisma.counselorTask.findFirst({ where: { instituteId: institute.id, leadId: lead.id, title: "Call after AI course orientation" } });
  if (!followUpTask) await prisma.counselorTask.create({
    data: { instituteId: institute.id, assignedToId: counselorUser.id, createdById: counselorUser.id, leadId: lead.id, title: "Call after AI course orientation", dueAt: at("2026-10-20T15:00:00+05:30"), priority: "HIGH" },
  });

  const focusStudent = fsStudents[0] ?? students[0];
  const noteBody = "Asked for the next project clinic schedule; share the published timetable after confirming with the trainer.";
  const existingNote = await prisma.studentNote.findFirst({ where: { instituteId: institute.id, studentId: focusStudent.id, body: noteBody } });
  if (!existingNote) await prisma.studentNote.create({
    data: { instituteId: institute.id, studentId: focusStudent.id, authorId: counselorUser.id, noteType: "PHONE_CALL", body: noteBody },
  });

  const escalation = await prisma.studentEscalation.findFirst({ where: { instituteId: institute.id, studentId: focusStudent.id, reason: "Attendance support" } });
  if (!escalation) await prisma.studentEscalation.create({
    data: { instituteId: institute.id, studentId: focusStudent.id, createdById: riya.userId, assignedToId: counselorUser.id, reason: "Attendance support", details: "One late arrival this week; check whether the learner needs a schedule adjustment." },
  });

  const followUpMessage = await prisma.communication.findFirst({ where: { instituteId: institute.id, template: "DEMO_FOLLOW_UP", recipientAddress: focusStudent.phone ?? "" } });
  if (!followUpMessage) await prisma.communication.create({
    data: {
      instituteId: institute.id, studentId: focusStudent.id, createdById: counselorUser.id,
      recipientName: focusStudent.name, recipientAddress: focusStudent.phone ?? "+91 90000 00000",
      channel: "WHATSAPP", template: "DEMO_FOLLOW_UP", status: "QUEUED", queuedAt: new Date(),
      message: "Demo message record: please confirm the next class schedule with the institute.",
    },
  });

  await prisma.bankTransaction.upsert({
    where: { instituteId_reference: { instituteId: institute.id, reference: "DEMO-BANK-UNMATCHED-001" } },
    create: { instituteId: institute.id, importedById: accountsUser.id, reference: "DEMO-BANK-UNMATCHED-001", amount: 15000, occurredAt: at("2026-10-17T10:30:00+05:30"), senderName: focusStudent.name, source: "UPI" },
    update: {},
  });

  const reminderInstallment = await prisma.installment.findFirst({
    where: { instituteId: institute.id, status: "UPCOMING", feePlan: { is: { enrollment: { is: { studentId: focusStudent.id } } } } },
    orderBy: { sequenceNo: "asc" },
  });
  if (reminderInstallment) {
    const reminderExists = await prisma.paymentReminder.findFirst({ where: { instituteId: institute.id, installmentId: reminderInstallment.id } });
    if (!reminderExists) {
      await prisma.paymentReminder.create({ data: { instituteId: institute.id, installmentId: reminderInstallment.id, createdById: accountsUser.id, channel: "WHATSAPP" } });
      const paymentMessage = await prisma.communication.findFirst({ where: { instituteId: institute.id, studentId: focusStudent.id, template: "PAYMENT_REMINDER" } });
      if (!paymentMessage) await prisma.communication.create({
        data: {
          instituteId: institute.id, studentId: focusStudent.id, createdById: accountsUser.id,
          recipientName: focusStudent.name, recipientAddress: focusStudent.phone ?? "+91 90000 00000",
          channel: "WHATSAPP", template: "PAYMENT_REMINDER", status: "QUEUED", queuedAt: new Date(),
          message: `Reminder: installment ${reminderInstallment.sequenceNo} is upcoming. Please contact the institute for payment details.`,
        },
      });
    }
  }

  console.log(`Seeded linked courses, batches, staff, trainers, ${students.length} students, admissions, follow-ups, sessions, attendance, recordings, fees, communication queue, and reconciliation data for ${institute.name}.`);
  console.log("Trainer demo logins:");
  console.log(`  Riya Mehta  | riya.mehta@demo.opscopilot.invalid  | ${trainerSeedPassword}`);
  console.log(`  Arjun Patil | arjun.patil@demo.opscopilot.invalid | ${trainerSeedPassword}`);
  console.log(`  Kavya Shah  | kavya.shah@demo.opscopilot.invalid  | ${trainerSeedPassword}`);
}

main()
  .catch((error: unknown) => {
    console.error("Unable to seed the demo institute.", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
