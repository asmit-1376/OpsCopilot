import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { getAuthenticatedUser } from "@/auth/authorization";
import { prisma } from "@/prisma";
import StudentDashboard, { type StudentDashboardData, type StudentSection } from "./dashboard";

const sections: StudentSection[] = ["overview", "timetable", "attendance", "recordings", "fees"];

export default async function StudentPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const [user, params] = await Promise.all([getAuthenticatedUser(), searchParams]);
  if (!user || user.role !== "STUDENT") redirect("/login");

  const requestedSection = params.section as StudentSection | undefined;
  const activeSection = requestedSection && sections.includes(requestedSection) ? requestedSection : "overview";

  try {
  const student = await prisma.student.findFirst({
    where: { userId: user.id, instituteId: user.instituteId, status: "ACTIVE" },
    include: {
      institute: { select: { name: true, timezone: true } },
      enrollments: {
        where: { instituteId: user.instituteId, status: "ACTIVE" },
        include: {
          batch: { include: { course: true } },
          feePlan: {
            include: {
              installments: {
                orderBy: { sequenceNo: "asc" },
                include: {
                  payments: {
                    where: { status: { in: ["COMPLETED", "REFUNDED"] } },
                    orderBy: { paidAt: "desc" },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  let dashboardData: StudentDashboardData | null = null;

  if (student) {
    const batchIds = student.enrollments.map(({ batchId }) => batchId);
    const now = new Date();
    const recordingWhere: Prisma.RecordingWhereInput = {
      instituteId: user.instituteId,
      status: "AVAILABLE",
      OR: [{ availableAt: null }, { availableAt: { lte: now } }],
      session: { is: { instituteId: user.instituteId, batchId: { in: batchIds } } },
    };
    const [sessions, attendance, recordings, attendanceStats, recordingsTotal] = batchIds.length
      ? await Promise.all([
          prisma.session.findMany({
            where: {
              instituteId: user.instituteId,
              batchId: { in: batchIds },
              status: "SCHEDULED",
              startsAt: { gte: now },
            },
            orderBy: { startsAt: "asc" },
            take: 30,
            include: {
              batch: { include: { course: true } },
              trainer: { include: { user: { select: { name: true } } } },
              room: { select: { name: true } },
            },
          }),
          prisma.attendanceSummary.findMany({
            where: {
              studentId: student.id,
              session: { is: { instituteId: user.instituteId, batchId: { in: batchIds } } },
            },
            orderBy: { session: { startsAt: "desc" } },
            take: 100,
            include: {
              session: {
                include: {
                  batch: { include: { course: true } },
                  trainer: { include: { user: { select: { name: true } } } },
                  room: { select: { name: true } },
                },
              },
            },
          }),
          prisma.recording.findMany({
            where: recordingWhere,
            orderBy: { availableAt: "desc" },
            take: 30,
            include: {
              session: {
                include: {
                  batch: { include: { course: true } },
                  trainer: { include: { user: { select: { name: true } } } },
                },
              },
            },
          }),
          prisma.attendanceSummary.groupBy({
            by: ["status"],
            where: {
              studentId: student.id,
              session: { is: { instituteId: user.instituteId, batchId: { in: batchIds } } },
            },
            _count: { _all: true },
          }),
          prisma.recording.count({ where: recordingWhere }),
        ])
      : [[], [], [], [], 0];

    const installments = student.enrollments.flatMap((enrollment) =>
      (enrollment.feePlan?.installments ?? []).map((installment) => {
        const amount = installment.amount.toNumber();
        const paidAmount = installment.payments.reduce(
          (total, payment) => total + payment.amount.toNumber() * (payment.status === "REFUNDED" ? -1 : 1),
          0,
        );
        const netPaidAmount = Math.max(paidAmount, 0);
        const status: StudentDashboardData["installments"][number]["status"] =
          installment.status === "WAIVED"
            ? "WAIVED"
            : netPaidAmount >= amount ||
                (installment.status === "PAID" && !installment.payments.some(({ status }) => status === "REFUNDED"))
              ? "PAID"
              : installment.status === "OVERDUE" || installment.dueAt < now
                ? "OVERDUE"
                : netPaidAmount > 0
                  ? "PARTIALLY_PAID"
                  : installment.status === "DUE"
                    ? "DUE"
                    : "UPCOMING";

        return {
          id: installment.id,
          title: `${enrollment.batch.course.name} · Installment ${installment.sequenceNo}`,
          amount,
          paidAmount: netPaidAmount,
          dueAt: installment.dueAt.toISOString(),
          status,
          reference: installment.payments.find(({ status, reference }) => status === "COMPLETED" && reference)?.reference ?? null,
          currency: enrollment.feePlan?.currency ?? "INR",
        };
      }),
    );

    const attendanceTotal = attendanceStats.reduce((total, group) => total + group._count._all, 0);
    const attendedCount = attendanceStats
      .filter(({ status }) => status === "PRESENT" || status === "LATE")
      .reduce((total, group) => total + group._count._all, 0);
    const feeTotalsByCurrency = new Map<string, { total: number; paid: number; waived: number }>();
    for (const enrollment of student.enrollments) {
      if (!enrollment.feePlan) continue;
      const currency = enrollment.feePlan.currency;
      const current = feeTotalsByCurrency.get(currency) ?? { total: 0, paid: 0, waived: 0 };
      current.total += enrollment.feePlan.totalAmount.toNumber();
      feeTotalsByCurrency.set(currency, current);
    }
    for (const installment of installments) {
      const current = feeTotalsByCurrency.get(installment.currency);
      if (current) {
        current.paid += installment.paidAmount;
        if (installment.status === "WAIVED") current.waived += installment.amount;
      }
    }

    dashboardData = {
      studentName: student.name || user.name,
      studentId: student.externalRef,
      instituteName: student.institute.name,
      timezone: student.institute.timezone,
      batches: student.enrollments.map(({ batch }) => ({
        name: batch.name,
        course: batch.course.name,
      })),
      feeTotals: [...feeTotalsByCurrency.entries()].map(([currency, totals]) => ({
        currency,
        total: totals.total,
        paid: totals.paid,
        balance: Math.max(totals.total - totals.paid - totals.waived, 0),
      })),
      attendanceRate: attendanceTotal ? (attendedCount / attendanceTotal) * 100 : null,
      attendanceAttended: attendedCount,
      attendanceTotal,
      attendance: attendance.map(({ id, status, session }) => ({
        id,
        date: session.startsAt.toISOString(),
        course: session.batch.course.name,
        batch: session.batch.name,
        trainer: session.trainer.user.name,
        room: session.room?.name ?? null,
        mode: session.mode,
        status,
      })),
      sessions: sessions.map((session) => ({
        id: session.id,
        startsAt: session.startsAt.toISOString(),
        endsAt: session.endsAt.toISOString(),
        course: session.batch.course.name,
        batch: session.batch.name,
        trainer: session.trainer.user.name,
        room: session.room?.name ?? null,
        mode: session.mode,
      })),
      recordings: recordings.map((recording) => ({
        id: recording.id,
        url: recording.url,
        availableAt: recording.availableAt?.toISOString() ?? null,
        course: recording.session.batch.course.name,
        trainer: recording.session.trainer.user.name,
      })),
      recordingsTotal,
      installments: installments.sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
    };
  }

  return <StudentDashboard data={dashboardData} activeSection={activeSection} />;
  } catch {
    return <StudentDashboard data={null} activeSection={activeSection} dataUnavailable />;
  }
}
