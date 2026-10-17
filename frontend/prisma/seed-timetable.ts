import { prisma } from "../prisma";

const instituteName = "OpsCopilot Demo Institute";
const weekdayWindows = [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, start: "09:00", end: "13:00" }));
const legacyDemoStarts = new Map([
  ["FS-09", new Date("2026-10-19T09:30:00+05:30").getTime()],
  ["CLOUD-02", new Date("2026-10-20T13:00:00+05:30").getTime()],
  ["AI-03", new Date("2026-10-21T13:00:00+05:30").getTime()],
]);

function dateKey(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addDays(key: string, count: number) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + count));
  return date.toISOString().slice(0, 10);
}

function zonedDateTime(key: string, hour: number, timezone: string) {
  const [year, month, day] = key.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day, hour);
  let instant = new Date(target);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = formatter.formatToParts(instant);
    const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);
    const represented = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
    instant = new Date(instant.getTime() + target - represented);
  }
  return instant;
}

function nextMonday(timezone: string) {
  const today = dateKey(new Date(), timezone);
  const [year, month, day] = today.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  return addDays(today, (8 - weekday) % 7);
}

function timeMinutes(value: Date) {
  return value.getUTCHours() * 60 + value.getUTCMinutes();
}

function trainerAvailable(
  windows: { dayOfWeek: number; startTime: Date; endTime: Date; available: boolean }[],
  dayOfWeek: number,
  startHour: number,
) {
  const dayWindows = windows.filter((window) => window.dayOfWeek === dayOfWeek);
  return !dayWindows.length || dayWindows.some((window) =>
    window.available && timeMinutes(window.startTime) <= startHour * 60 && timeMinutes(window.endTime) >= (startHour + 1) * 60,
  );
}

async function ensureWeekdayAvailability(trainerId: string) {
  const availability = await prisma.trainerAvailability.findMany({ where: { trainerId } });
  const byDay = new Set(availability.map(({ dayOfWeek }) => dayOfWeek));
  const additions = weekdayWindows
    .filter(({ dayOfWeek }) => !byDay.has(dayOfWeek))
    .map(({ dayOfWeek }) => ({
      trainerId,
      dayOfWeek,
      startTime: new Date("1970-01-01T09:00:00.000Z"),
      endTime: new Date("1970-01-01T13:00:00.000Z"),
      available: true,
    }));
  if (additions.length) await prisma.trainerAvailability.createMany({ data: additions });
  return [...availability, ...additions];
}

async function hasResourceConflict(input: {
  instituteId: string;
  trainerId: string;
  roomId: string | null;
  startsAt: Date;
  endsAt: Date;
  excludeId?: string;
}) {
  const conflict = await prisma.session.findFirst({
    where: {
      instituteId: input.instituteId,
      status: "SCHEDULED",
      startsAt: { lt: input.endsAt },
      endsAt: { gt: input.startsAt },
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      OR: [{ trainerId: input.trainerId }, ...(input.roomId ? [{ roomId: input.roomId }] : [])],
    },
    select: { id: true },
  });
  return Boolean(conflict);
}

async function publishSeedChange(instituteId: string, actorId: string | null, session: {
  id: string;
  batchId: string;
  trainerId: string;
  subjectId: string | null;
  startsAt: Date;
  endsAt: Date;
}, eventType: "CREATE" | "UPDATE") {
  await prisma.realtimeEvent.create({
    data: {
      instituteId,
      actorId,
      eventType,
      objectType: "session",
      objectId: session.id,
      payload: {
        batchId: session.batchId,
        trainerId: session.trainerId,
        subjectId: session.subjectId,
        startsAt: session.startsAt.toISOString(),
        endsAt: session.endsAt.toISOString(),
        source: "demo_timetable_seed",
      },
    },
  });
}

async function main() {
  const institute = await prisma.institute.findFirst({ where: { name: instituteName }, select: { id: true, timezone: true } });
  if (!institute) throw new Error(`Institute "${instituteName}" was not found. Run the regular database seed first.`);

  const weekStart = nextMonday(institute.timezone);
  const seededWeeks = 4;
  const days = Array.from({ length: seededWeeks }, (_, weekIndex) =>
    Array.from({ length: 5 }, (_, weekdayIndex) => addDays(weekStart, weekIndex * 7 + weekdayIndex)),
  ).flat();
  const weekEnd = zonedDateTime(addDays(weekStart, seededWeeks * 7), 0, institute.timezone);
  const weekStartAt = zonedDateTime(weekStart, 0, institute.timezone);

  const [counselor, batches, rooms] = await Promise.all([
    prisma.user.findFirst({ where: { instituteId: institute.id, status: "ACTIVE", roles: { some: { role: "COUNSELOR" } } }, select: { id: true } }),
    prisma.batch.findMany({
      where: { instituteId: institute.id, status: "ACTIVE", course: { is: { status: "ACTIVE" } } },
      orderBy: [{ startDate: "asc" }, { name: "asc" }],
      include: {
        course: { include: { subjects: { where: { status: "ACTIVE" }, include: { trainerEligibility: { where: { active: true }, select: { trainerId: true, proficiencyLevel: true } } } } } },
        trainerAssignments: { include: { trainer: { include: { user: { select: { id: true, name: true, status: true } }, subjectEligibility: { where: { active: true }, select: { subjectId: true, proficiencyLevel: true } } } } } },
        subjectPlans: { include: { subject: true }, orderBy: { deadline: "asc" } },
      },
    }),
    prisma.room.findMany({ where: { instituteId: institute.id }, orderBy: [{ capacity: "asc" }, { name: "asc" }] }),
  ]);

  const activeSessions = await prisma.session.findMany({
    where: { instituteId: institute.id, status: { not: "CANCELLED" }, startsAt: { gte: weekStartAt, lt: weekEnd } },
    select: { id: true, batchId: true, trainerId: true, roomId: true, subjectId: true, startsAt: true, endsAt: true, status: true },
  });
  const legacyWeek = weekStart === "2026-10-19";
  const trainerIds = [...new Set(batches.flatMap((batch) => batch.trainerAssignments.map(({ trainer }) => trainer.id)))];
  const availabilityRows = new Map<string, Awaited<ReturnType<typeof ensureWeekdayAvailability>>>();
  for (const trainerId of trainerIds) availabilityRows.set(trainerId, await ensureWeekdayAvailability(trainerId));

  let created = 0;
  let updated = 0;
  let preserved = 0;
  let skipped = 0;

  for (const [batchIndex, batch] of batches.entries()) {
    const activeTrainers = batch.trainerAssignments
      .map(({ trainer }) => trainer)
      .filter((trainer) => trainer.user.status === "ACTIVE");
    const subjects = batch.course.subjects;
    const subject = batch.subjectPlans.find((plan) => subjects.some(({ id }) => id === plan.subjectId))?.subject
      ?? subjects.find((item) => activeTrainers.some((trainer) => trainer.subjectEligibility.some((entry) => entry.subjectId === item.id)))
      ?? subjects[0];

    if (!activeTrainers.length || !subject) {
      console.warn(`Skipped ${batch.name}: it needs an active assigned trainer and an active course subject.`);
      skipped += days.length;
      continue;
    }

    const qualifiedTrainers = activeTrainers.filter((trainer) => trainer.subjectEligibility.some((entry) => entry.subjectId === subject.id));
    const trainers = qualifiedTrainers.length ? qualifiedTrainers : activeTrainers.filter((trainer) =>
      !trainer.subjectEligibility.length && trainer.skills.some((skill) => skill.trim().toLocaleLowerCase() === subject.name.trim().toLocaleLowerCase()),
    );
    if (!trainers.length) {
      console.warn(`Skipped ${batch.name}: no assigned trainer is eligible for ${subject.name}.`);
      skipped += days.length;
      continue;
    }

    const activeEnrollmentCount = await prisma.enrollment.count({ where: { instituteId: institute.id, batchId: batch.id, status: "ACTIVE" } });
    const eligibleRooms = batch.mode === "ONLINE" ? [null] : rooms.filter((room) => room.capacity >= activeEnrollmentCount);
    if (!eligibleRooms.length) {
      console.warn(`Skipped ${batch.name}: there is no room large enough for its active learners.`);
      skipped += days.length;
      continue;
    }

    await prisma.batch.update({
      where: { id: batch.id },
      data: { sessionsPerWeek: 5, sessionDurationMinutes: 60, preferredWindows: weekdayWindows },
    });

    const batchSessions = activeSessions.filter((session) => session.batchId === batch.id);
    for (const [dayIndex, day] of days.entries()) {
      const onDay = batchSessions.filter((session) => dateKey(session.startsAt, institute.timezone) === day);
      let legacy = legacyWeek
        ? onDay.find((session) => session.startsAt.getTime() === legacyDemoStarts.get(batch.name))
        : undefined;
      if (onDay.length && !legacy) {
        preserved += 1;
        continue;
      }

      const preferredHour = 9 + (batchIndex % 4);
      const hours = Array.from({ length: 4 }, (_, offset) => 9 + ((preferredHour - 9 + offset) % 4));
      let saved = false;
      for (const hour of hours) {
        const startsAt = zonedDateTime(day, hour, institute.timezone);
        const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
        if (legacy && await hasResourceConflict({ instituteId: institute.id, trainerId: legacy.trainerId, roomId: legacy.roomId, startsAt, endsAt, excludeId: legacy.id })) continue;

        for (const trainer of trainers) {
          const availability = availabilityRows.get(trainer.id) ?? [];
          if (!trainerAvailable(availability, (dayIndex % 5) + 1, hour)) continue;
          const candidateRooms = batch.mode === "ONLINE"
            ? [null]
            : eligibleRooms.filter((room) => !legacy || room?.id === legacy.roomId).concat(eligibleRooms.filter((room) => legacy && room?.id !== legacy.roomId));
          for (const room of candidateRooms) {
            const roomId = room?.id ?? null;
            if (await hasResourceConflict({ instituteId: institute.id, trainerId: trainer.id, roomId, startsAt, endsAt, ...(legacy ? { excludeId: legacy.id } : {}) })) continue;
            const exception = await prisma.trainerAvailabilityException.findFirst({
              where: { instituteId: institute.id, trainerId: trainer.id, active: true, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
              select: { id: true },
            });
            if (exception) continue;

            if (legacy) {
              const session = await prisma.session.update({
                where: { id: legacy.id },
                data: { trainerId: trainer.id, roomId, subjectId: subject.id, mode: batch.mode, startsAt, endsAt, scheduleVersion: { increment: 1 } },
                select: { id: true, batchId: true, trainerId: true, subjectId: true, startsAt: true, endsAt: true },
              });
              await publishSeedChange(institute.id, counselor?.id ?? null, session, "UPDATE");
              legacy = undefined;
              updated += 1;
            } else {
              const session = await prisma.session.create({
                data: { instituteId: institute.id, batchId: batch.id, trainerId: trainer.id, roomId, subjectId: subject.id, mode: batch.mode, startsAt, endsAt },
                select: { id: true, batchId: true, trainerId: true, subjectId: true, startsAt: true, endsAt: true },
              });
              activeSessions.push({ ...session, roomId, status: "SCHEDULED" });
              batchSessions.push({ ...session, roomId, status: "SCHEDULED" });
              await publishSeedChange(institute.id, counselor?.id ?? null, session, "CREATE");
              created += 1;
            }
            saved = true;
            break;
          }
          if (saved) break;
        }
        if (saved) break;
      }
      if (!saved) {
        console.warn(`No free one-hour weekday slot found for ${batch.name} on ${day}.`);
        skipped += 1;
      }
    }
  }

  console.log(`Timetable weeks ${days[0]}–${days[days.length - 1]} (${institute.timezone}): ${created} sessions created, ${updated} legacy demo sessions updated, ${preserved} existing batch-days preserved, ${skipped} sessions skipped.`);
}

main()
  .catch((error: unknown) => {
    console.error("Unable to seed the demo timetable.", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
