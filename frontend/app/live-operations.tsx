"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import type { Role } from "@prisma/client";
import { authClient } from "@/auth/auth-client";
import CopilotLauncher from "@/app/copilot/copilot-launcher";
import styles from "./live-operations.module.css";

type IdName = { id: string; name: string };
type Enrollment = {
  id: string;
  student: IdName & { externalRef?: string | null };
  batch: IdName & { course: IdName };
  feePlan?: { id: string; totalAmount: number; currency: string } | null;
};
type Trainer = { id: string; user: IdName & { email?: string }; batchAssignments?: { batch: IdName }[] };
type Counselor = IdName & { email: string; hasLoggedIn: boolean };
type CounselorInvite = { id: string; name: string | null; email: string; createdAt: string };
type Student = IdName & { email?: string | null; externalRef?: string | null; phone?: string | null; enrollments?: Enrollment[] };
type Batch = IdName & { status: string; mode: "CLASSROOM" | "ONLINE" | "HYBRID"; course: IdName; _count?: { enrollments: number; sessions: number }; trainerAssignments?: { trainer: Trainer }[] };
type Session = { id: string; startsAt: string; endsAt: string; status: string; batch: Batch; trainer: Trainer; room?: { name: string } | null; subject?: { name: string } | null; _count?: { attendanceSummaries: number; recordings: number } };
type SyllabusPlan = {
  id: string;
  requiredMinutes: number;
  completedMinutes: number;
  deadline: string;
  batch: IdName & { course: IdName };
  subject: IdName;
};
type Attendance = { id: string; status: string; minutesPresent: number; student: IdName; session: { id: string; batch: IdName } };
type Recording = { id: string; url: string; status: string; session: Session };
type Payment = { id: string; amount: number; reference?: string | null; status: string; source: string };
type Installment = { id: string; sequenceNo: number; amount: number; dueAt: string; status: string; payments: Payment[] };
type FeePlan = { id: string; totalAmount: number; currency: string; enrollment: Enrollment; installments: Installment[] };
type Lead = { id: string; name: string; email?: string | null; phone?: string | null; targetTrack: string; source: string; stage: string; notes?: string | null; assignedCounselor?: IdName | null };
type Task = { id: string; title: string; priority: string; dueAt?: string | null; completedAt?: string | null; student?: IdName | null; lead?: IdName | null; assignedTo?: IdName | null };
type StudentNote = { id: string; body: string; noteType: string; createdAt: string; student: IdName; author?: { name: string } | null };
type Escalation = { id: string; reason: string; details?: string | null; status: string; student: IdName; assignedTo?: IdName | null };
type Communication = { id: string; recipientName: string; recipientAddress: string; channel: string; message: string; status: string; createdAt: string; student?: IdName | null };
type BankTransaction = { id: string; reference: string; amount: number; occurredAt: string; senderName?: string | null; source: string; status: string };
type Reminder = { id: string; status: string; channel: string; queuedAt: string; installment: { sequenceNo: number; amount: number; feePlan: { enrollment: { student: IdName; batch: IdName } } } };
type Proposal = { id: string; status: string; actionType: string; payload: unknown; expiresAt?: string | null; request?: { intent: string; promptRedacted: string } | null };
type AuditEvent = { id: string; eventType: string; objectType: string; objectId: string; createdAt: string; actor?: { name: string } | null };
type TrainerNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  sessionId?: string | null;
  planId?: string | null;
  readAt?: string | null;
  createdAt: string;
};
type Workspace = {
  institute?: { name: string; timezone: string } | null;
  role: Role;
  courses: (IdName & { durationWeeks: number; status: string })[];
  batches: Batch[];
  trainers: Trainer[];
  counselors: Counselor[];
  counselorInvites: CounselorInvite[];
  students: Student[];
  enrollments: Enrollment[];
  sessions: Session[];
  rooms: { id: string; name: string; capacity: number }[];
  attendance: Attendance[];
  recordings: Recording[];
  feePlans: FeePlan[];
  leads: Lead[];
  tasks: Task[];
  notes: StudentNote[];
  escalations: Escalation[];
  communications: Communication[];
  bankTransactions: BankTransaction[];
  reminders: Reminder[];
  proposals: Proposal[];
  auditEvents: AuditEvent[];
  syllabusPlans: SyllabusPlan[];
};

const EMPTY_SESSIONS: Session[] = [];

function value(form: HTMLFormElement, key: string) {
  return String(new FormData(form).get(key) ?? "").trim();
}

function dateLabel(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function openWorkspaceOption(id: string) {
  const target = document.getElementById(id);
  const option = target instanceof HTMLDetailsElement ? target : target?.closest("details");
  if (option instanceof HTMLDetailsElement) {
    const ancestors: HTMLDetailsElement[] = [];
    let parent = option.parentElement?.closest("details");
    while (parent instanceof HTMLDetailsElement) {
      ancestors.unshift(parent);
      parent = parent.parentElement?.closest("details") ?? null;
    }
    ancestors.forEach((ancestor) => { ancestor.open = true; });
    option.open = true;
    option.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function dateKey(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function workWeekDateKeys(today: string) {
  const [year, month, day] = today.split("-").map(Number);
  const monday = new Date(Date.UTC(year, month - 1, day));
  const offset = (monday.getUTCDay() + 6) % 7;
  monday.setUTCDate(monday.getUTCDate() - offset);
  if (offset >= 5) monday.setUTCDate(monday.getUTCDate() + 7);
  return Array.from({ length: 5 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

function timetableDayLabel(key: string, timezone: string, includeDay = true) {
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    ...(includeDay ? { weekday: "short" as const } : {}),
    day: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function timetableTimeLabel(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function CurrentTimetable({ sessions, timezone }: { sessions: Session[]; timezone: string }) {
  const [view, setView] = useState<"today" | "week">("week");
  const today = dateKey(new Date(), timezone);
  const days = workWeekDateKeys(today);
  const scheduled = sessions
    .filter((session) => session.status !== "CANCELLED" && days.includes(dateKey(new Date(session.startsAt), timezone)))
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  const visible = view === "today"
    ? scheduled.filter((session) => dateKey(new Date(session.startsAt), timezone) === today)
    : scheduled;

  return <section id="published-timetable" className={styles.timetableCard} aria-labelledby="current-timetable-title">
    <div className={styles.timetableHeader}>
      <div><p className={styles.eyebrow}>PUBLISHED SCHEDULE</p><h2 id="current-timetable-title">Current timetable</h2><p>{timetableDayLabel(days[0], timezone, false)} – {timetableDayLabel(days[4], timezone, false)}</p></div>
      <div className={styles.timetableToggle} role="group" aria-label="Timetable view">
        <button type="button" aria-pressed={view === "today"} className={view === "today" ? styles.timetableActive : ""} onClick={() => setView("today")}>Today</button>
        <button type="button" aria-pressed={view === "week"} className={view === "week" ? styles.timetableActive : ""} onClick={() => setView("week")}>This week</button>
      </div>
    </div>
    {visible.length ? <div className={styles.timetableList}>
      {visible.map((session) => <article key={session.id} className={styles.timetableSession}>
        <div className={styles.timetableWhen}><strong>{timetableDayLabel(dateKey(new Date(session.startsAt), timezone), timezone)}</strong><span>{timetableTimeLabel(session.startsAt, timezone)} – {timetableTimeLabel(session.endsAt, timezone)}</span></div>
        <div className={styles.timetableDetails}><strong>{session.subject?.name ?? session.batch.course.name} · {session.batch.name}</strong><span>{session.trainer.user.name} · {session.room?.name ?? "Online"}</span></div>
        <span className={`${styles.timetableStatus} ${session.status === "COMPLETED" ? styles.timetableCompleted : ""}`}>{session.status}</span>
      </article>)}
    </div> : <p className={styles.empty}>{view === "today" ? "No classes are scheduled for today." : "No classes are scheduled for this week."}</p>}
  </section>;
}

function isoDateTime(value: string) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "";
  return parsed.toISOString();
}

async function readApiResponse(response: Response) {
  const body = await response.text();
  if (!body.trim()) {
    throw new Error(`The server returned an empty response (HTTP ${response.status}).`);
  }

  let result: unknown;
  try {
    result = JSON.parse(body);
  } catch {
    throw new Error(`The server returned an invalid response (HTTP ${response.status}).`);
  }

  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("The server returned an unexpected response.");
  }
  return result as Record<string, unknown>;
}

export default function LiveOperations({ role }: { role: Role }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [notifications, setNotifications] = useState<TrainerNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [attendanceSessionId, setAttendanceSessionId] = useState("");
  const [scheduleBatchId, setScheduleBatchId] = useState("");
  const [bankMatchInstallmentId, setBankMatchInstallmentId] = useState("");
  const [pendingEnrollmentRemoval, setPendingEnrollmentRemoval] = useState<{
    studentName: string;
    enrollments: { id: string; courseName: string; batchName: string }[];
    selectedId: string;
  } | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/operations", { cache: "no-store" });
    const result = await readApiResponse(response);
    if (!response.ok) {
      throw new Error(typeof result.error === "string" ? result.error : "Could not load live institute data.");
    }
    setWorkspace(result as Workspace);
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (role !== "TRAINER") return;
    const response = await fetch("/api/notifications", { cache: "no-store" });
    const result = await readApiResponse(response);
    if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Could not load notifications.");
    setNotifications(Array.isArray(result.data) ? result.data as TrainerNotification[] : []);
  }, [role]);

  useEffect(() => {
    let active = true;
    const initialLoad = window.setTimeout(() => {
      void Promise.all([refresh(), refreshNotifications()]).catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Database is unavailable.");
      });
    }, 0);
    const source = new EventSource("/api/events");
    source.addEventListener("ready", () => {
      if (!active) return;
      setLive(true);
      void refresh().catch(() => setError("Live data could not refresh. Reconnecting…"));
      void refreshNotifications().catch(() => undefined);
    });
    source.addEventListener("change", () => {
      if (!active) return;
      void refresh().catch(() => setError("Live data could not refresh. Reconnecting…"));
      void refreshNotifications().catch(() => undefined);
    });
    source.addEventListener("unavailable", () => { if (active) setLive(false); });
    source.onerror = () => { if (active) setLive(false); };
    return () => {
      active = false;
      window.clearTimeout(initialLoad);
      source.close();
    };
  }, [refresh, refreshNotifications]);

  const mutate = useCallback(async (method: "POST" | "PATCH" | "DELETE", resource: string, data: Record<string, unknown>, id?: string) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/operations", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resource, id, data }),
      });
      const result = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(typeof result.error === "string" ? result.error : "The change could not be saved.");
      }
      await refresh();
      const saved = result.data && typeof result.data === "object" ? result.data as Record<string, unknown> : {};
      setMessage(resource === "enrollment" && method === "DELETE"
        ? "Enrollment removed. The student remains in the institute and any other enrollments are unchanged."
        : resource === "syllabusProgress"
        ? "Syllabus progress saved. The timetable solver will use it when building the next draft."
        : resource === "counselor"
        ? saved.status === "INVITED"
          ? "Counselor invite created. They can set a password and verify their email to activate their portal."
          : "Counselor access added. Their portal is available after sign-in."
        : "Saved to the institute database. Other open portals will update automatically.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The change could not be saved.");
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const enrollments = workspace?.enrollments ?? [];
  const batches = workspace?.batches ?? [];
  const trainers = workspace?.trainers ?? [];
  const students = workspace?.students ?? [];
  const sessions = workspace?.sessions ?? EMPTY_SESSIONS;
  const scheduleBatch = batches.find((batch) => batch.id === scheduleBatchId);
  const scheduleTrainers = scheduleBatch?.trainerAssignments?.map(({ trainer }) => trainer) ?? [];
  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === attendanceSessionId) ?? sessions[0],
    [attendanceSessionId, sessions],
  );
  const sessionStudents = selectedSession
    ? students.filter((student) => student.enrollments?.some(({ batch }) => batch.id === selectedSession.batch.id))
    : [];

  function onCreateCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void mutate("POST", "course", { name: value(form, "name"), durationWeeks: value(form, "durationWeeks") });
    form.reset();
  }

  function onCreateCounselor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void mutate("POST", "counselor", { name: value(form, "name"), email: value(form, "email") });
    form.reset();
  }

  function onCreateBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void mutate("POST", "batch", {
      courseId: value(form, "courseId"), name: value(form, "name"),
      startDate: value(form, "startDate"), endDate: value(form, "endDate"),
      mode: value(form, "mode"), onlineSeatLimit: value(form, "onlineSeatLimit") || null,
    });
    form.reset();
  }

  function onAssignTrainer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void mutate("POST", "trainerAssignment", { trainerId: value(form, "trainerId"), batchId: value(form, "batchId") });
    form.reset();
  }

  function onCreateSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void mutate("POST", "session", {
      batchId: value(form, "batchId"), trainerId: value(form, "trainerId"),
      roomId: value(form, "roomId") || null, mode: value(form, "mode"),
      startsAt: isoDateTime(value(form, "startsAt")), endsAt: isoDateTime(value(form, "endsAt")),
    });
    form.reset();
  }

  function onCreateCounselorSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const startsAt = isoDateTime(value(form, "startsAt"));
    if (!scheduleBatch || !startsAt) return;
    const endsAt = new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString();
    void mutate("POST", "session", {
      batchId: scheduleBatch.id,
      trainerId: value(form, "trainerId"),
      roomId: value(form, "roomId") || null,
      mode: scheduleBatch.mode,
      startsAt,
      endsAt,
    });
    form.reset();
    setScheduleBatchId("");
  }

  function onRescheduleSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void mutate("PATCH", "session", {
      startsAt: isoDateTime(value(form, "startsAt")), endsAt: isoDateTime(value(form, "endsAt")),
    }, value(form, "sessionId"));
  }

  function onAddStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void mutate("POST", "student", {
      name: value(form, "name"), email: value(form, "email"), externalRef: value(form, "externalRef") || null,
      phone: value(form, "phone") || null, batchId: value(form, "batchId"), trainerId: value(form, "trainerId") || null,
    });
    form.reset();
  }

  function onEnroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void mutate("POST", "enrollment", { studentId: value(form, "studentId"), batchId: value(form, "batchId"), trainerId: value(form, "trainerId") || null });
    form.reset();
  }

  function onAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const sessionId = value(form, "sessionId");
    void mutate("POST", "attendance", {
      sessionId, studentId: value(form, "studentId"), status: value(form, "status"),
      minutesPresent: value(form, "minutesPresent") || 0,
    });
  }

  function onSyllabusProgress(event: FormEvent<HTMLFormElement>, planId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    void mutate("PATCH", "syllabusProgress", { completedMinutes: value(form, "completedMinutes") }, planId);
  }

  function onRecording(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void mutate("POST", "recording", { sessionId: value(form, "sessionId"), url: value(form, "url") });
    form.reset();
  }

  function onFeePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const totalAmount = value(form, "totalAmount");
    void mutate("POST", "feePlan", {
      enrollmentId: value(form, "enrollmentId"), totalAmount,
      installments: [{ sequenceNo: 1, amount: totalAmount, dueAt: value(form, "dueAt") }],
    });
    form.reset();
  }

  function onPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void mutate("POST", "payment", {
      installmentId: value(form, "installmentId"), amount: value(form, "amount"),
      source: value(form, "source"), reference: value(form, "reference") || null,
    });
    form.reset();
  }

  function onCreateLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void mutate("POST", "lead", {
      name: value(form, "name"), email: value(form, "email") || null, phone: value(form, "phone") || null,
      guardianName: value(form, "guardianName") || null, guardianPhone: value(form, "guardianPhone") || null,
      targetTrack: value(form, "targetTrack"), source: value(form, "source") || "PORTAL", notes: value(form, "notes") || null,
    });
    form.reset();
  }

  function onCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void mutate("POST", "counselorTask", {
      title: value(form, "title"), studentId: value(form, "studentId") || null, leadId: value(form, "leadId") || null,
      dueAt: value(form, "dueAt") ? isoDateTime(value(form, "dueAt")) : null, priority: value(form, "priority"),
    });
    form.reset();
  }

  function onCreateNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void mutate("POST", "studentNote", { studentId: value(form, "studentId"), noteType: value(form, "noteType"), body: value(form, "body") });
    form.reset();
  }

  function onCreateEscalation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void mutate("POST", "escalation", { studentId: value(form, "studentId"), reason: value(form, "reason"), details: value(form, "details") || null });
    form.reset();
  }

  function onCreateCommunication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void mutate("POST", "communication", {
      studentId: value(form, "studentId") || null, recipientName: value(form, "recipientName"),
      recipientAddress: value(form, "recipientAddress"), channel: value(form, "channel"),
      message: value(form, "message"), status: value(form, "status"),
    });
    form.reset();
  }

  function onImportBankTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void mutate("POST", "bankTransaction", {
      reference: value(form, "reference"), amount: value(form, "amount"), occurredAt: isoDateTime(value(form, "occurredAt")),
      senderName: value(form, "senderName") || null, source: value(form, "source"),
    });
    form.reset();
  }

  function onQueueReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void mutate("POST", "paymentReminder", { installmentId: value(form, "installmentId"), channel: value(form, "channel") });
  }

  const formClass = styles.form;
  const fieldClass = styles.field;
  const submitClass = styles.submit;
  const batchOptions = batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name} · {batch.course.name}</option>);
  const trainerOptions = trainers.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.user.name}</option>);
  const studentOptions = students.map((student) => <option key={student.id} value={student.id}>{student.name}{student.externalRef ? ` · ${student.externalRef}` : ""}</option>);
  const installmentOptions = workspace?.feePlans.flatMap((plan) => plan.installments.filter(({ status }) => status !== "WAIVED").map((installment) => <option key={installment.id} value={installment.id}>{plan.enrollment.student.name} · {plan.enrollment.batch.name} · #{installment.sequenceNo} · {plan.currency} {installment.amount} ({installment.status})</option>)) ?? [];

  async function signOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setSignOutError("");
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Sign out failed. Please try again.");
      window.location.replace("/login");
    } catch {
      setSignOutError("Unable to sign out right now. Please try again.");
      setIsSigningOut(false);
    }
  }

  function requestEnrollmentRemoval(student: Student) {
    const studentEnrollments = (student.enrollments ?? []).map((enrollment) => ({
      id: enrollment.id,
      courseName: enrollment.batch.course.name,
      batchName: enrollment.batch.name,
    }));
    if (!studentEnrollments.length) return;
    setPendingEnrollmentRemoval({
      studentName: student.name,
      enrollments: studentEnrollments,
      selectedId: studentEnrollments[0].id,
    });
  }

  function removePendingEnrollment() {
    if (!pendingEnrollmentRemoval) return;
    const enrollmentId = pendingEnrollmentRemoval.selectedId;
    setPendingEnrollmentRemoval(null);
    void mutate("DELETE", "enrollment", {}, enrollmentId);
  }

  async function markNotificationRead(notificationId: string) {
    const response = await fetch(`/api/notifications/${notificationId}`, { method: "PATCH" });
    if (response.ok) await refreshNotifications();
  }

  async function markAllNotificationsRead() {
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "READ_ALL" }),
    });
    if (response.ok) await refreshNotifications();
  }

  return (
    <section className={styles.workspace} aria-label="Live institute operations">
      <aside className={styles.sidebar}>
        <Link className={styles.sidebarBrand} href={role === "OWNER" ? "/owner" : role === "COUNSELOR" ? "/counselor" : role === "TRAINER" ? "/trainer" : "/accounts"}>
          <span className={styles.sidebarMark} aria-hidden="true">O</span>
          <span><strong>{workspace?.institute?.name ?? "Institute"}</strong><small>{role.toLowerCase()} workspace</small></span>
        </Link>
        <p className={styles.sidebarLabel}>WORKSPACE</p>
        <nav className={styles.sidebarNav} aria-label="Workspace navigation">
          <a className={styles.sidebarActive} href="#workspace-dashboard">Dashboard</a>
          {(role === "OWNER" || role === "COUNSELOR" || role === "TRAINER") && <button type="button" onClick={() => window.dispatchEvent(new Event("ops-copilot:open"))}>Copilot</button>}
          {(role === "OWNER" || role === "COUNSELOR") && <Link href="/timetable-solver">Timetable solver</Link>}
          {role === "TRAINER" && <button type="button" onClick={() => openWorkspaceOption("sessions-option")}>My classes</button>}
          {(role === "OWNER" || role === "COUNSELOR") && <button type="button" onClick={() => openWorkspaceOption("published-timetable")}>Published timetable</button>}
        </nav>
        <div className={styles.sidebarFooter}>
          <span className={`${styles.connection} ${live ? styles.connected : ""}`}><i />{live ? "Live sync on" : "Connecting…"}</span>
        </div>
      </aside>
      <div className={styles.workspaceContent} id="workspace-dashboard">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>{role === "OWNER" ? "OWNER WORKSPACE" : role === "COUNSELOR" ? "COUNSELOR WORKSPACE" : role === "TRAINER" ? "TRAINER WORKSPACE" : "ACCOUNTS WORKSPACE"}</p>
          <h1>{role === "OWNER" ? "Owner dashboard" : role === "COUNSELOR" ? "Counselor dashboard" : role === "TRAINER" ? "Trainer dashboard" : "Accounts dashboard"}</h1>
          <p>Use a quick action or choose a section to open its tools and records.</p>
        </div>
        <div className={styles.headingActions}>
          {role === "TRAINER" && <div className={styles.notificationCenter}>
            <button
              className={styles.notificationBell}
              type="button"
              aria-label={`Notifications${notifications.some((item) => !item.readAt) ? `, ${notifications.filter((item) => !item.readAt).length} unread` : ""}`}
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen((open) => !open)}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                <path d="M10 21h4" />
              </svg>
              {notifications.some((item) => !item.readAt) && <i className={styles.notificationDot} />}
            </button>
            {notificationsOpen && <section className={styles.notificationPanel} aria-label="Trainer notifications">
              <header>
                <strong>Notifications</strong>
                {notifications.some((item) => !item.readAt) && <button type="button" onClick={() => void markAllNotificationsRead()}>Mark all read</button>}
              </header>
              <div className={styles.notificationList}>
                {notifications.length ? notifications.map((notification) => <button
                  type="button"
                  key={notification.id}
                  className={notification.readAt ? styles.notificationRead : styles.notificationUnread}
                  onClick={() => void markNotificationRead(notification.id)}
                >
                  <strong>{notification.title}</strong>
                  <span>{notification.message}</span>
                  <small>{dateLabel(notification.createdAt)}</small>
                </button>) : <p>No notifications yet.</p>}
              </div>
            </section>}
          </div>}
          {(role === "COUNSELOR" || role === "OWNER") && <Link className={styles.signOut} href="/timetable-solver">Timetable solver</Link>}
          <button className={styles.signOut} type="button" onClick={() => void signOut()} disabled={isSigningOut}>
            {isSigningOut && <span className={styles.spinner} aria-hidden="true" />}
            {isSigningOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>

      {signOutError && <p className={styles.error} role="alert">{signOutError}</p>}
      {isSigningOut && <p className={styles.signingOut} role="status" aria-live="polite">Signing you out securely…</p>}
      {message && <p className={styles.success} role="status">{message}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {!workspace && !error && <p className={styles.loading}>Loading your institute records…</p>}

      {workspace && <>
        <div className={styles.quickActions} aria-label="Quick actions">
          {role === "OWNER" && <>
            <button type="button" className={styles.quickAction} onClick={() => openWorkspaceOption("institute-setup")}><span>＋</span><strong>Set up institute</strong><small>Add a counselor, course, or batch</small></button>
            <Link className={`${styles.quickAction} ${styles.quickActionPrimary}`} href="/timetable-solver"><span>▦</span><strong>Plan timetable</strong><small>Draft and review a safe schedule</small></Link>
          </>}
          {role === "COUNSELOR" && <>
            <button type="button" className={`${styles.quickAction} ${styles.quickActionPrimary}`} onClick={() => openWorkspaceOption("learner-timetable-tools")}><span>＋</span><strong>Add learner</strong><small>Create a profile and enroll in a batch</small></button>
            <Link className={styles.quickAction} href="/timetable-solver"><span>▦</span><strong>Timetable solver</strong><small>Draft and publish schedule updates</small></Link>
          </>}
          {role === "TRAINER" && <>
            <button type="button" className={`${styles.quickAction} ${styles.quickActionPrimary}`} onClick={() => openWorkspaceOption("trainer-class-tools")}><span>✓</span><strong>Record attendance</strong><small>Choose one of your assigned sessions</small></button>
            <button type="button" className={styles.quickAction} onClick={() => openWorkspaceOption("trainer-syllabus")}><span>↗</span><strong>Update syllabus</strong><small>Save course completion progress</small></button>
          </>}
          {role === "ACCOUNTS" && <button type="button" className={`${styles.quickAction} ${styles.quickActionPrimary}`} onClick={() => openWorkspaceOption("finance-tools")}><span>₹</span><strong>Manage payments</strong><small>Record and reconcile payments</small></button>}
        </div>
        <details className={styles.actionDrawer} name="staff-dashboard-options">
          <summary><span>Institute overview</span><small>Counts and published timetable for your workspace</small></summary>
          <div className={styles.overviewContent}>
            <div className={styles.metrics}>
              <div><strong>{workspace.courses.length}</strong><span>Courses</span></div>
              <div><strong>{batches.length}</strong><span>Active batches</span></div>
              <div><strong>{students.length}</strong><span>Students in your scope</span></div>
              <div><strong>{sessions.length}</strong><span>Sessions</span></div>
              {role === "OWNER" || role === "ACCOUNTS" ? <div><strong>{workspace.feePlans.length}</strong><span>Fee plans</span></div> : null}
            </div>
            {(role === "OWNER" || role === "COUNSELOR") && <CurrentTimetable sessions={sessions} timezone={workspace.institute?.timezone ?? "Asia/Kolkata"} />}
          </div>
        </details>

        <details className={`${styles.actionDrawer} ${styles.actionGroup}`} name="staff-dashboard-groups">
          <summary><span>Workspace tools</span><small>Open a role-specific action group for setup, teaching, learners, or finance</small></summary>
          <div className={styles.actionOptions}>
        {role === "OWNER" && <details id="institute-setup" className={styles.actionDrawer} name="staff-dashboard-options">
          <summary><span>Institute setup</span><small>Create counselors, courses, batches, and schedule changes</small></summary>
          <div className={styles.forms}>
          <form className={formClass} onSubmit={onCreateCounselor}>
            <h2>Add counselor</h2>
            <label className={fieldClass}>Full name<input name="name" required maxLength={200} /></label>
            <label className={fieldClass}>Institute email<input name="email" type="email" required maxLength={254} /></label>
            <button className={submitClass} disabled={busy}>Create counselor access</button>
            <small>New counselors receive an invite flow to set a password and verify their email.</small>
          </form>
          <section className={styles.listCard} aria-label="Counselor directory">
            <div className={styles.listHeader}><h2>Counselors</h2><span>{workspace.counselors.length} active · {workspace.counselorInvites.length} invited</span></div>
            {[...workspace.counselors.map((counselor) => ({ id: counselor.id, name: counselor.name, email: counselor.email, status: counselor.hasLoggedIn ? "Ready to sign in" : "Setup pending" })), ...workspace.counselorInvites.map((invite) => ({ id: invite.id, name: invite.name ?? "Counselor", email: invite.email, status: "Invite pending" }))].map((counselor) => <div key={counselor.id} className={styles.row}>
              <div><strong>{counselor.name}</strong><small>{counselor.email}</small></div>
              <span className={styles.badge}>{counselor.status}</span>
            </div>)}
            {!workspace.counselors.length && !workspace.counselorInvites.length && <p className={styles.empty}>No counselors added yet.</p>}
          </section>
          <form className={formClass} onSubmit={onCreateCourse}>
            <h2>Create course</h2>
            <label className={fieldClass}>Course name<input name="name" required maxLength={200} /></label>
            <label className={fieldClass}>Duration (weeks)<input name="durationWeeks" type="number" min="1" required /></label>
            <button className={submitClass} disabled={busy}>Save course</button>
          </form>
          <form className={formClass} onSubmit={onCreateBatch}>
            <h2>Create batch</h2>
            <label className={fieldClass}>Course<select name="courseId" required defaultValue=""><option value="" disabled>Select course</option>{workspace.courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
            <label className={fieldClass}>Batch name<input name="name" required maxLength={200} /></label>
            <div className={styles.twoFields}><label className={fieldClass}>Starts<input name="startDate" type="date" required /></label><label className={fieldClass}>Ends<input name="endDate" type="date" required /></label></div>
            <div className={styles.twoFields}><label className={fieldClass}>Mode<select name="mode"><option>CLASSROOM</option><option>ONLINE</option><option>HYBRID</option></select></label><label className={fieldClass}>Online seat limit<input name="onlineSeatLimit" type="number" min="1" /></label></div>
            <button className={submitClass} disabled={busy || !workspace.courses.length}>Save batch</button>
          </form>
          <form className={formClass} onSubmit={onCreateSession}>
            <h2>Schedule session</h2>
            <label className={fieldClass}>Batch<select name="batchId" required defaultValue=""><option value="" disabled>Select batch</option>{batchOptions}</select></label>
            <label className={fieldClass}>Assigned trainer<select name="trainerId" required defaultValue=""><option value="" disabled>Select trainer</option>{trainerOptions}</select></label>
            <label className={fieldClass}>Room<select name="roomId" defaultValue=""><option value="">No room / online</option>{workspace.rooms.map((room) => <option key={room.id} value={room.id}>{room.name} · capacity {room.capacity}</option>)}</select></label>
            <div className={styles.twoFields}><label className={fieldClass}>Mode<select name="mode"><option>CLASSROOM</option><option>ONLINE</option><option>HYBRID</option></select></label><label className={fieldClass}>Starts<input name="startsAt" type="datetime-local" required /></label></div>
            <label className={fieldClass}>Ends<input name="endsAt" type="datetime-local" required /></label>
            <button className={submitClass} disabled={busy || !batches.length || !trainers.length}>Schedule session</button>
          </form>
          <form className={formClass} onSubmit={onRescheduleSession}>
            <h2>Reschedule session</h2>
            <label className={fieldClass}>Session<select name="sessionId" required defaultValue=""><option value="" disabled>Select session</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.batch.name} · {dateLabel(session.startsAt)}</option>)}</select></label>
            <div className={styles.twoFields}><label className={fieldClass}>New start<input name="startsAt" type="datetime-local" required /></label><label className={fieldClass}>New end<input name="endsAt" type="datetime-local" required /></label></div>
            <button className={submitClass} disabled={busy || !sessions.length}>Save timetable change</button>
          </form>
          </div>
        </details>}

        {(role === "OWNER" || role === "COUNSELOR") && <details id="learner-timetable-tools" className={styles.actionDrawer} name="staff-dashboard-options">
          <summary><span>{role === "COUNSELOR" ? "Learner & timetable tools" : "Teaching operations"}</span><small>Assign trainers, schedule classes, and manage enrollment</small></summary>
          <div className={styles.forms}>
          <form className={formClass} onSubmit={onAssignTrainer}>
            <h2>Assign trainer to batch</h2>
            <label className={fieldClass}>Batch<select name="batchId" required defaultValue=""><option value="" disabled>Select batch</option>{batchOptions}</select></label>
            <label className={fieldClass}>Trainer<select name="trainerId" required defaultValue=""><option value="" disabled>Select trainer</option>{trainerOptions}</select></label>
            <button className={submitClass} disabled={busy || !batches.length || !trainers.length}>Save assignment</button>
            {!trainers.length && <small>Trainer accounts need to be activated and linked before assignment.</small>}
          </form>
          {role === "COUNSELOR" && <form className={formClass} onSubmit={onCreateCounselorSession}>
            <h2>Add timetable session</h2>
            <small>One-hour lectures, Monday–Friday, starting from 9:00 AM through 12:00 PM.</small>
            <label className={fieldClass}>Batch<select name="batchId" required value={scheduleBatchId} onChange={(event) => setScheduleBatchId(event.target.value)}><option value="">Select batch</option>{batchOptions}</select></label>
            <label className={fieldClass}>Assigned trainer<select name="trainerId" required defaultValue="" disabled={!scheduleBatch || !scheduleTrainers.length}><option value="">Select assigned trainer</option>{scheduleTrainers.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.user.name}</option>)}</select></label>
            {scheduleBatch && scheduleBatch.mode !== "ONLINE" && <label className={fieldClass}>Room<select name="roomId" required defaultValue="" disabled={!workspace.rooms.length}><option value="">Select room</option>{workspace.rooms.map((room) => <option key={room.id} value={room.id}>{room.name} · capacity {room.capacity}</option>)}</select></label>}
            <label className={fieldClass}>Date and start time<input name="startsAt" type="datetime-local" step="3600" required /></label>
            <button className={submitClass} disabled={busy || !scheduleBatch || !scheduleTrainers.length}>Add timetable session</button>
          </form>}
          {role === "COUNSELOR" && <form className={formClass} onSubmit={onAddStudent}>
            <h2>Add and enroll learner</h2>
            <label className={fieldClass}>Full name<input name="name" required maxLength={200} /></label>
            <label className={fieldClass}>Student email<input name="email" type="email" required maxLength={254} /></label>
            <div className={styles.twoFields}><label className={fieldClass}>Student ID<input name="externalRef" maxLength={80} /></label><label className={fieldClass}>Phone<input name="phone" type="tel" maxLength={32} /></label></div>
            <label className={fieldClass}>Enroll in batch<select name="batchId" required defaultValue=""><option value="" disabled>Select batch</option>{batchOptions}</select></label>
            <label className={fieldClass}>Assign trainer (optional)<select name="trainerId" defaultValue=""><option value="">Use existing batch trainer</option>{trainerOptions}</select></label>
            <button className={submitClass} disabled={busy || !batches.length}>Create profile and enroll</button>
          </form>}
          </div>
        </details>}

        {role === "COUNSELOR" && enrollments.length > 0 && <details className={styles.actionDrawer} name="staff-dashboard-options">
          <summary><span>Enroll an existing learner</span><small>Add a saved learner to another batch</small></summary>
          <form className={`${formClass} ${styles.inlineForm}`} onSubmit={onEnroll}>
          <h2>Enroll an existing learner</h2>
          <label className={fieldClass}>Student<select name="studentId" required defaultValue=""><option value="" disabled>Select learner</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name}{student.externalRef ? ` · ${student.externalRef}` : ""}</option>)}</select></label>
          <label className={fieldClass}>Batch<select name="batchId" required defaultValue=""><option value="" disabled>Select batch</option>{batchOptions}</select></label>
          <label className={fieldClass}>Trainer (optional)<select name="trainerId" defaultValue=""><option value="">Keep current batch assignment</option>{trainerOptions}</select></label>
          <button className={submitClass} disabled={busy}>Enroll learner</button>
          </form>
        </details>}

        {role === "TRAINER" && <details id="trainer-class-tools" className={styles.actionDrawer} name="staff-dashboard-options">
          <summary><span>Class delivery tools</span><small>Record attendance or publish a session recording</small></summary>
          <div className={styles.forms}>
          <form className={formClass} onSubmit={onAttendance}>
            <h2>Record attendance</h2>
            <label className={fieldClass}>Assigned session<select name="sessionId" required value={attendanceSessionId || selectedSession?.id || ""} onChange={(event) => setAttendanceSessionId(event.target.value)}><option value="" disabled>Select session</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.batch.name} · {dateLabel(session.startsAt)}</option>)}</select></label>
            <label className={fieldClass}>Enrolled learner<select name="studentId" required defaultValue=""><option value="" disabled>Select student</option>{sessionStudents.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
            <div className={styles.twoFields}><label className={fieldClass}>Status<select name="status"><option>PRESENT</option><option>LATE</option><option>ABSENT</option><option>EXCUSED</option></select></label><label className={fieldClass}>Minutes present<input name="minutesPresent" type="number" min="0" defaultValue="0" /></label></div>
            <button className={submitClass} disabled={busy || !sessions.length}>Save attendance</button>
          </form>
          <form className={formClass} onSubmit={onRecording}>
            <h2>Publish session recording</h2>
            <label className={fieldClass}>Assigned session<select name="sessionId" required defaultValue=""><option value="" disabled>Select session</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.batch.name} · {dateLabel(session.startsAt)}</option>)}</select></label>
            <label className={fieldClass}>Recording URL<input name="url" type="url" required placeholder="https://…" /></label>
            <button className={submitClass} disabled={busy || !sessions.length}>Publish recording</button>
          </form>
          </div>
        </details>}

        {role === "TRAINER" && <details id="trainer-syllabus" className={styles.actionDrawer} name="staff-dashboard-options">
          <summary><span>Course syllabus progress</span><small>{workspace.syllabusPlans.length} assigned course subjects · update completion</small></summary>
          <section className={`${styles.listCard} ${styles.syllabusCard}`}>
          <div className={styles.listHeader}>
            <div><h2>Course syllabus progress</h2><small>Update only courses in your assigned batches. Saved progress feeds the timetable solver.</small></div>
            <span>{workspace.syllabusPlans.length} subjects</span>
          </div>
          {workspace.syllabusPlans.length ? workspace.syllabusPlans.map((plan) => {
            const percent = Math.min(100, Math.round((plan.completedMinutes / Math.max(1, plan.requiredMinutes)) * 100));
            return <article key={plan.id} className={styles.syllabusRow}>
              <div className={styles.syllabusInfo}>
                <strong>{plan.subject.name} · {plan.batch.name}</strong>
                <small>{plan.batch.course.name} · deadline {new Date(plan.deadline).toLocaleDateString()}</small>
                <progress className={styles.syllabusProgress} value={plan.completedMinutes} max={plan.requiredMinutes} aria-label={`${plan.subject.name} syllabus completion`} />
                <small>{plan.completedMinutes.toLocaleString()} / {plan.requiredMinutes.toLocaleString()} minutes · {percent}% complete</small>
              </div>
              <form key={`${plan.id}:${plan.completedMinutes}`} className={styles.syllabusForm} onSubmit={(event) => onSyllabusProgress(event, plan.id)}>
                <label className={fieldClass}>Minutes completed<input name="completedMinutes" type="number" min="0" max={plan.requiredMinutes} step="1" required defaultValue={plan.completedMinutes} /></label>
                <button className={submitClass} disabled={busy}>Save progress</button>
              </form>
            </article>;
          }) : <p className={styles.empty}>No syllabus plans are configured for your assigned courses yet.</p>}
          </section>
        </details>}

        {(role === "OWNER" || role === "ACCOUNTS") && <details id="finance-tools" className={styles.actionDrawer} name="staff-dashboard-options">
          <summary><span>Finance tools</span><small>Create fee plans, record payments, and reconcile fees</small></summary>
          <div className={styles.forms}>
          <form className={formClass} onSubmit={onFeePlan}>
            <h2>Create fee plan</h2>
            <label className={fieldClass}>Enrollment<select name="enrollmentId" required defaultValue=""><option value="" disabled>Select enrollment</option>{enrollments.map((enrollment) => <option key={enrollment.id} value={enrollment.id}>{enrollment.student.name} · {enrollment.batch.name}{enrollment.feePlan ? " · fee plan exists" : ""}</option>)}</select></label>
            <div className={styles.twoFields}><label className={fieldClass}>Total (INR)<input name="totalAmount" type="number" min="0.01" step="0.01" required /></label><label className={fieldClass}>Due date<input name="dueAt" type="date" required /></label></div>
            <button className={submitClass} disabled={busy || !enrollments.some(({ feePlan }) => !feePlan)}>Create one-installment plan</button>
          </form>
          <form className={formClass} onSubmit={onPayment}>
            <h2>Record payment</h2>
            <label className={fieldClass}>Installment<select name="installmentId" required defaultValue=""><option value="" disabled>Select installment</option>{installmentOptions}</select></label>
            <div className={styles.twoFields}><label className={fieldClass}>Amount<input name="amount" type="number" min="0.01" step="0.01" required /></label><label className={fieldClass}>Method<select name="source"><option>UPI</option><option>CASH</option><option>BANK_TRANSFER</option><option>CARD</option><option>OTHER</option></select></label></div>
            <label className={fieldClass}>Reference<input name="reference" maxLength={120} /></label>
            <button className={submitClass} disabled={busy || !workspace.feePlans.some(({ installments: rows }) => rows.length)}>Save payment</button>
          </form>
          </div>
        </details>}

        {(role === "OWNER" || role === "COUNSELOR") && <details className={styles.actionDrawer} name="staff-dashboard-options">
          <summary><span>Admissions & follow-ups</span><small>Capture leads and assign learner follow-up work</small></summary>
          <div className={styles.forms}>
          <form className={formClass} onSubmit={onCreateLead}>
            <h2>Add admission lead</h2>
            <label className={fieldClass}>Full name<input name="name" required maxLength={200} /></label>
            <div className={styles.twoFields}><label className={fieldClass}>Email<input name="email" type="email" /></label><label className={fieldClass}>Phone<input name="phone" type="tel" /></label></div>
            <label className={fieldClass}>Interested course<input name="targetTrack" required maxLength={200} /></label>
            <div className={styles.twoFields}><label className={fieldClass}>Guardian name<input name="guardianName" /></label><label className={fieldClass}>Guardian phone<input name="guardianPhone" type="tel" /></label></div>
            <label className={fieldClass}>Source<input name="source" placeholder="Referral, website, event…" /></label>
            <label className={fieldClass}>Notes<textarea name="notes" rows={2} maxLength={2000} /></label>
            <button className={submitClass} disabled={busy}>Save lead</button>
          </form>
          <form className={formClass} onSubmit={onCreateTask}>
            <h2>Create follow-up task</h2>
            <label className={fieldClass}>Task<input name="title" required maxLength={200} /></label>
            <label className={fieldClass}>Related student<select name="studentId" defaultValue=""><option value="">Select if this is a student task</option>{studentOptions}</select></label>
            <label className={fieldClass}>Related lead<select name="leadId" defaultValue=""><option value="">Select if this is a lead task</option>{workspace.leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name} · {lead.targetTrack}</option>)}</select></label>
            <div className={styles.twoFields}><label className={fieldClass}>Due<input name="dueAt" type="datetime-local" /></label><label className={fieldClass}>Priority<select name="priority"><option>MEDIUM</option><option>HIGH</option><option>LOW</option></select></label></div>
            <button className={submitClass} disabled={busy || (!students.length && !workspace.leads.length)}>Save task</button>
          </form>
          </div>
        </details>}

        {(role === "OWNER" || role === "COUNSELOR" || role === "TRAINER") && <details className={styles.actionDrawer} name="staff-dashboard-options">
          <summary><span>Learner support</span><small>Add private notes or raise an escalation</small></summary>
          <div className={styles.forms}>
          <form className={formClass} onSubmit={onCreateNote}>
            <h2>Add private student note</h2>
            <label className={fieldClass}>Student<select name="studentId" required defaultValue=""><option value="" disabled>Select learner</option>{studentOptions}</select></label>
            <label className={fieldClass}>Interaction type<select name="noteType"><option>GENERAL</option><option>PHONE_CALL</option><option>EMAIL</option><option>WHATSAPP</option><option>MEETING</option></select></label>
            <label className={fieldClass}>Note<textarea name="body" required rows={3} maxLength={4000} /></label>
            <button className={submitClass} disabled={busy || !students.length}>Save note</button>
          </form>
          <form className={formClass} onSubmit={onCreateEscalation}>
            <h2>Raise learner escalation</h2>
            <label className={fieldClass}>Student<select name="studentId" required defaultValue=""><option value="" disabled>Select learner</option>{studentOptions}</select></label>
            <label className={fieldClass}>Reason<input name="reason" required maxLength={200} placeholder="Attendance, wellbeing, fee concern…" /></label>
            <label className={fieldClass}>Details<textarea name="details" rows={3} maxLength={3000} /></label>
            <button className={submitClass} disabled={busy || !students.length}>Raise escalation</button>
          </form>
          </div>
        </details>}

        {(role === "OWNER" || role === "COUNSELOR" || role === "ACCOUNTS") && <details className={styles.actionDrawer} name="staff-dashboard-options">
          <summary><span>Communication tools</span><small>Prepare messages and payment reminders</small></summary>
          <div className={styles.forms}>
          <form className={formClass} onSubmit={onCreateCommunication}>
            <h2>Prepare institute message</h2>
            <label className={fieldClass}>Linked student (optional)<select name="studentId" defaultValue=""><option value="">No student link</option>{studentOptions}</select></label>
            <div className={styles.twoFields}><label className={fieldClass}>Recipient<input name="recipientName" required maxLength={200} /></label><label className={fieldClass}>Channel<select name="channel"><option>WHATSAPP</option><option>EMAIL</option></select></label></div>
            <label className={fieldClass}>Phone or email<input name="recipientAddress" required maxLength={254} /></label>
            <label className={fieldClass}>Message<textarea name="message" required rows={3} maxLength={4000} /></label>
            <label className={fieldClass}>Save as<select name="status"><option value="DRAFT">Draft only</option><option value="QUEUED">Queue for delivery</option></select></label>
            <button className={submitClass} disabled={busy}>Save communication</button>
          </form>
          {role === "ACCOUNTS" || role === "OWNER" ? <form className={formClass} onSubmit={onQueueReminder}>
            <h2>Queue payment reminder</h2>
            <label className={fieldClass}>Installment<select name="installmentId" required defaultValue=""><option value="" disabled>Select due installment</option>{installmentOptions}</select></label>
            <label className={fieldClass}>Channel<select name="channel"><option>WHATSAPP</option><option>EMAIL</option></select></label>
            <button className={submitClass} disabled={busy || !installmentOptions.length}>Queue reminder</button>
            <small>Queueing records the reminder and message; it does not claim the provider sent it.</small>
          </form> : null}
          </div>
        </details>}

        {(role === "OWNER" || role === "ACCOUNTS") && <details className={styles.actionDrawer} name="staff-dashboard-options">
          <summary><span>Import bank transaction</span><small>Add a transaction to the reconciliation queue</small></summary>
          <form className={`${formClass} ${styles.inlineForm}`} onSubmit={onImportBankTransaction}>
          <h2>Import bank transaction for reconciliation</h2>
          <label className={fieldClass}>Reference<input name="reference" required maxLength={120} /></label>
          <label className={fieldClass}>Amount<input name="amount" type="number" min="0.01" step="0.01" required /></label>
          <label className={fieldClass}>Occurred at<input name="occurredAt" type="datetime-local" required /></label>
          <label className={fieldClass}>Sender name<input name="senderName" maxLength={200} /></label>
          <label className={fieldClass}>Source<select name="source"><option>UPI</option><option>BANK_TRANSFER</option><option>CARD</option><option>CASH</option><option>OTHER</option></select></label>
          <button className={submitClass} disabled={busy}>Import transaction</button>
          </form>
        </details>}

          </div>
        </details>

        <div className={styles.lists}>
          {(role === "OWNER" || role === "COUNSELOR") && <details className={styles.actionDrawer} name="staff-dashboard-options">
            <summary><span>Learners & enrollments</span><small>{students.length} learner profiles in your scope</small></summary>
            <section className={`${styles.listCard} ${styles.learnersCard}`}>
            <div className={styles.listHeader}><h2>Learners and enrollments</h2><span>{students.length}</span></div>
            {students.length ? students.map((student) => <article key={student.id} className={styles.row}>
              <div className={styles.studentEnrollment}>
                <div className={styles.studentIdentity}><strong>{student.name}</strong><small>{student.email || "No email linked"}{student.externalRef ? ` · ${student.externalRef}` : ""}</small></div>
                {student.enrollments?.length ? <div className={styles.enrollmentList}>{student.enrollments.map((enrollment) => <small key={enrollment.id} className={styles.enrollmentItem}>{enrollment.batch.course.name} / {enrollment.batch.name}</small>)}</div> : <small className={styles.noEnrollment}>No active enrollment</small>}
              </div>
              {student.enrollments?.length ? <div className={styles.rowActions}><button type="button" disabled={busy} onClick={() => requestEnrollmentRemoval(student)}>Remove enrollment</button></div> : null}
            </article>) : <p className={styles.empty}>No learners in your institute scope yet.</p>}
            </section>
          </details>}

          <details className={styles.actionDrawer} name="staff-dashboard-options">
            <summary><span>Courses & batches</span><small>{workspace.courses.length} courses · {batches.length} active batches</small></summary>
          <section className={styles.listCard}>
            <div className={styles.listHeader}><h2>Courses and batches</h2><span>{workspace.courses.length} / {batches.length}</span></div>
            {batches.length ? batches.map((batch) => <article key={batch.id} className={styles.row}>
              <div><strong>{batch.name}</strong><small>{batch.course.name} · {batch._count?.enrollments ?? 0} learners · {batch._count?.sessions ?? 0} sessions</small>
                {batch.trainerAssignments?.map(({ trainer }) => <small key={trainer.id}>Trainer: {trainer.user.name}</small>)}
              </div>
              {role === "OWNER" && <button disabled={busy} onClick={() => void mutate("DELETE", "batch", {}, batch.id)}>Deactivate batch</button>}
            </article>) : <p className={styles.empty}>No active batches in your institute scope yet.</p>}
            {(role === "OWNER" || role === "COUNSELOR") && workspace.courses.map((course) => <article key={course.id} className={styles.row}>
              <div><strong>{course.name}</strong><small>{course.durationWeeks} weeks</small></div>
              {role === "OWNER" && <button disabled={busy} onClick={() => void mutate("DELETE", "course", {}, course.id)}>Archive course</button>}
            </article>)}
          </section>
          </details>

          {(role === "TRAINER" || role === "STUDENT" || role === "OWNER" || role === "COUNSELOR") && <details id="sessions-option" className={styles.actionDrawer} name="staff-dashboard-options">
            <summary><span>Sessions & attendance</span><small>{sessions.length} scheduled sessions in your scope</small></summary>
            <section className={styles.listCard}>
            <div className={styles.listHeader}><h2>Sessions and attendance</h2><span>{sessions.length}</span></div>
            {sessions.slice(0, 12).map((session) => <article key={session.id} className={styles.row}>
              <div><strong>{session.batch.course.name} · {session.batch.name}</strong><small>{dateLabel(session.startsAt)} · {session.trainer.user.name}{session.room ? ` · ${session.room.name}` : " · Online"}</small></div>
              <div className={styles.rowActions}><small>{session._count?.attendanceSummaries ?? 0} attendance records</small>{role === "OWNER" && <button disabled={busy} onClick={() => void mutate("DELETE", "session", {}, session.id)}>Cancel</button>}</div>
            </article>)}
            {!sessions.length && <p className={styles.empty}>No sessions available in your scope.</p>}
            {workspace.attendance.slice(0, 8).map((item) => <article key={item.id} className={styles.row}>
              <div><strong>{item.student.name}</strong><small>{item.session.batch.name} · {item.minutesPresent} minutes</small></div><span className={styles.badge}>{item.status}</span>
            </article>)}
            </section>
          </details>}

          <details className={styles.actionDrawer} name="staff-dashboard-options">
            <summary><span>More records & administration</span><small>Recordings, fees, admissions, communications, approvals, and audit history</small></summary>
            <div className={styles.lists}>
          {(role === "OWNER" || role === "COUNSELOR" || role === "TRAINER" || role === "STUDENT") && <section className={styles.listCard}>
            <div className={styles.listHeader}><h2>Class recordings</h2><span>{workspace.recordings.length}</span></div>
            {workspace.recordings.map((recording) => <article key={recording.id} className={styles.row}>
              <div><strong>{recording.session.batch.name}</strong><small>{recording.session.batch.course.name} · {recording.status}</small></div>
              <div className={styles.rowActions}><a href={recording.url} target="_blank" rel="noreferrer">Open</a>{(role === "OWNER" || role === "TRAINER") && <button disabled={busy} onClick={() => void mutate("DELETE", "recording", {}, recording.id)}>Unpublish</button>}</div>
            </article>)}
            {!workspace.recordings.length && <p className={styles.empty}>No recordings available in your scope.</p>}
          </section>}

          {(role === "OWNER" || role === "ACCOUNTS" || role === "STUDENT") && <section className={styles.listCard}>
            <div className={styles.listHeader}><h2>Fees and payments</h2><span>{workspace.feePlans.length} plans</span></div>
            {workspace.feePlans.flatMap((plan) => plan.installments.map((installment) => <article key={installment.id} className={styles.row}>
              <div><strong>{plan.enrollment.student.name} · {plan.enrollment.batch.name}</strong><small>Installment {installment.sequenceNo} · {plan.currency} {installment.amount} · due {dateLabel(installment.dueAt)}</small>
                <small>{installment.payments.length ? installment.payments.map((payment) => `${plan.currency} ${payment.amount} ${payment.status}`).join(" · ") : "No payments recorded"}</small></div>
              <span className={styles.badge}>{installment.status}</span>
            </article>))}
            {!workspace.feePlans.length && <p className={styles.empty}>No fee plans in your scope.</p>}
          </section>}

          {(role === "OWNER" || role === "COUNSELOR") && <section className={styles.listCard}>
            <div className={styles.listHeader}><h2>Admissions pipeline</h2><span>{workspace.leads.length} leads</span></div>
            {workspace.leads.map((lead) => <article key={lead.id} className={styles.row}>
              <div><strong>{lead.name} · {lead.targetTrack}</strong><small>{lead.email || "No email"}{lead.phone ? ` · ${lead.phone}` : ""} · {lead.source}</small><small>Owner: {lead.assignedCounselor?.name ?? "Unassigned"}{lead.notes ? ` · ${lead.notes}` : ""}</small></div>
              <select aria-label={`Update ${lead.name} lead stage`} value={lead.stage} disabled={busy} onChange={(event) => void mutate("PATCH", "lead", { stage: event.target.value }, lead.id)}>
                <option>NEW</option><option>CONTACTED</option><option>DEMO_ATTENDED</option><option>READY_TO_ENROLL</option><option>ENROLLED</option><option>LOST</option>
              </select>
            </article>)}
            {!workspace.leads.length && <p className={styles.empty}>No admission leads have been added.</p>}
          </section>}

          {(role === "OWNER" || role === "COUNSELOR") && <section className={styles.listCard}>
            <div className={styles.listHeader}><h2>Counselor follow-ups</h2><span>{workspace.tasks.length} tasks</span></div>
            {workspace.tasks.map((task) => <article key={task.id} className={styles.row}>
              <div><strong>{task.title}</strong><small>{task.student?.name ?? task.lead?.name ?? "Institute follow-up"} · {task.priority}{task.dueAt ? ` · due ${dateLabel(task.dueAt)}` : ""}</small><small>{task.assignedTo?.name ? `Assigned to ${task.assignedTo.name}` : "Unassigned"}</small></div>
              <button disabled={busy} onClick={() => void mutate("PATCH", "counselorTask", { completed: !task.completedAt }, task.id)}>{task.completedAt ? "Reopen" : "Complete"}</button>
            </article>)}
            {!workspace.tasks.length && <p className={styles.empty}>No follow-up tasks yet.</p>}
          </section>}

          {(role === "OWNER" || role === "COUNSELOR" || role === "TRAINER") && <section className={styles.listCard}>
            <div className={styles.listHeader}><h2>Private learner notes</h2><span>{workspace.notes.length} notes</span></div>
            {workspace.notes.map((note) => <article key={note.id} className={styles.row}>
              <div><strong>{note.student.name} · {note.noteType.replaceAll("_", " ")}</strong><small>{note.body}</small><small>{note.author?.name ?? "Staff"} · {dateLabel(note.createdAt)}</small></div>
            </article>)}
            {!workspace.notes.length && <p className={styles.empty}>No staff notes in your scope.</p>}
          </section>}

          {(role === "OWNER" || role === "COUNSELOR" || role === "TRAINER") && <section className={styles.listCard}>
            <div className={styles.listHeader}><h2>Student escalations</h2><span>{workspace.escalations.length} cases</span></div>
            {workspace.escalations.map((caseItem) => <article key={caseItem.id} className={styles.row}>
              <div><strong>{caseItem.student.name} · {caseItem.reason}</strong><small>{caseItem.details || "No additional details"} · {caseItem.assignedTo?.name ? `Owner: ${caseItem.assignedTo.name}` : "Unassigned"}</small></div>
              {role === "OWNER" || role === "COUNSELOR" ? <select aria-label={`Update escalation for ${caseItem.student.name}`} value={caseItem.status} disabled={busy} onChange={(event) => void mutate("PATCH", "escalation", { status: event.target.value }, caseItem.id)}><option>OPEN</option><option>IN_REVIEW</option><option>RESOLVED</option><option>CLOSED</option></select> : <span className={styles.badge}>{caseItem.status}</span>}
            </article>)}
            {!workspace.escalations.length && <p className={styles.empty}>No escalations have been raised.</p>}
          </section>}

          {(role === "OWNER" || role === "COUNSELOR" || role === "ACCOUNTS") && <section className={styles.listCard}>
            <div className={styles.listHeader}><h2>Communications queue</h2><span>{workspace.communications.length} messages</span></div>
            {workspace.communications.map((item) => <article key={item.id} className={styles.row}>
              <div><strong>{item.recipientName} · {item.channel}</strong><small>{item.message}</small><small>{item.recipientAddress} · {dateLabel(item.createdAt)}</small></div>
              <div className={styles.rowActions}><span className={styles.badge}>{item.status}</span>{item.status === "DRAFT" && <button disabled={busy} onClick={() => void mutate("PATCH", "communication", { status: "QUEUED" }, item.id)}>Queue</button>}</div>
            </article>)}
            {!workspace.communications.length && <p className={styles.empty}>No draft or queued messages.</p>}
          </section>}

          {(role === "OWNER" || role === "ACCOUNTS") && <section className={styles.listCard}>
            <div className={styles.listHeader}><h2>Bank reconciliation</h2><span>{workspace.bankTransactions.filter((item) => item.status === "UNMATCHED").length} unmatched</span></div>
            {workspace.bankTransactions.map((item) => <article key={item.id} className={styles.row}>
              <div><strong>{item.reference} · {item.source} · ₹{item.amount.toLocaleString("en-IN")}</strong><small>{item.senderName || "Unknown sender"} · {dateLabel(item.occurredAt)}</small></div>
              {item.status === "UNMATCHED" ? <div className={styles.rowActions}>
                <select aria-label={`Choose installment for ${item.reference}`} value={bankMatchInstallmentId} disabled={busy} onChange={(event) => setBankMatchInstallmentId(event.target.value)}><option value="">Select installment</option>{installmentOptions}</select>
                <button disabled={busy || !bankMatchInstallmentId} onClick={() => void mutate("PATCH", "bankTransaction", { action: "MATCH", installmentId: bankMatchInstallmentId }, item.id)}>Match</button>
                <button disabled={busy} onClick={() => void mutate("PATCH", "bankTransaction", { action: "IGNORE" }, item.id)}>Ignore</button>
              </div> : <span className={styles.badge}>{item.status}</span>}
            </article>)}
            {!workspace.bankTransactions.length && <p className={styles.empty}>No imported bank transactions to reconcile.</p>}
          </section>}

          {(role === "OWNER" || role === "ACCOUNTS") && <section className={styles.listCard}>
            <div className={styles.listHeader}><h2>Payment reminders</h2><span>{workspace.reminders.length} queued</span></div>
            {workspace.reminders.map((reminder) => <article key={reminder.id} className={styles.row}>
              <div><strong>{reminder.installment.feePlan.enrollment.student.name} · {reminder.installment.feePlan.enrollment.batch.name}</strong><small>Installment {reminder.installment.sequenceNo} · ₹{reminder.installment.amount} · queued {dateLabel(reminder.queuedAt)}</small></div><span className={styles.badge}>{reminder.status}</span>
            </article>)}
            {!workspace.reminders.length && <p className={styles.empty}>No payment reminders are queued.</p>}
          </section>}

          {role === "OWNER" && <section className={styles.listCard}>
            <div className={styles.listHeader}><h2>Copilot action approvals</h2><span>{workspace.proposals.filter((item) => item.status === "PENDING").length} pending</span></div>
            <p className={styles.empty}>Approval records are stored here. Approving does not itself send a message or execute an external action.</p>
            {workspace.proposals.map((proposal) => <article key={proposal.id} className={styles.row}>
              <div><strong>{proposal.actionType} · {proposal.status}</strong><small>{proposal.request?.promptRedacted ?? JSON.stringify(proposal.payload)}</small><small>{proposal.request?.intent ?? "Action request"}{proposal.expiresAt ? ` · expires ${dateLabel(proposal.expiresAt)}` : ""}</small></div>
              {proposal.status === "PENDING" && <div className={styles.rowActions}><button disabled={busy} onClick={() => void mutate("PATCH", "actionProposal", { decision: "APPROVED" }, proposal.id)}>Approve</button><button disabled={busy} onClick={() => void mutate("PATCH", "actionProposal", { decision: "REJECTED" }, proposal.id)}>Reject</button></div>}
            </article>)}
            {!workspace.proposals.length && <p className={styles.empty}>No Copilot proposals have been submitted.</p>}
          </section>}

          {role === "OWNER" && <section className={styles.listCard}>
            <div className={styles.listHeader}><h2>Audit trail</h2><span>{workspace.auditEvents.length} recent changes</span></div>
            {workspace.auditEvents.slice(0, 30).map((event) => <article key={event.id} className={styles.row}>
              <div><strong>{event.eventType} · {event.objectType}</strong><small>{event.actor?.name ?? "System"} · {dateLabel(event.createdAt)}</small></div>
            </article>)}
            {!workspace.auditEvents.length && <p className={styles.empty}>No audited changes yet.</p>}
          </section>}
            </div>
          </details>
        </div>
        <p className={styles.footnote}>Changes are written with an audit entry and institute-scoped live event. Destructive actions are handled as deactivation, cancellation, refund, or unpublish records.</p>
      </>}
      </div>
      {pendingEnrollmentRemoval && <div className={styles.confirmBackdrop}>
        <section className={styles.confirmDialog} role="alertdialog" aria-modal="true" aria-labelledby="remove-enrollment-title" aria-describedby="remove-enrollment-description">
          <h2 id="remove-enrollment-title">Remove course enrollment?</h2>
          {pendingEnrollmentRemoval.enrollments.length > 1 && <label className={styles.confirmCourse}>
            Choose the course enrollment to remove
            <select value={pendingEnrollmentRemoval.selectedId} onChange={(event) => setPendingEnrollmentRemoval((current) => current ? { ...current, selectedId: event.target.value } : current)}>
              {pendingEnrollmentRemoval.enrollments.map((enrollment) => <option key={enrollment.id} value={enrollment.id}>{enrollment.courseName} / {enrollment.batchName}</option>)}
            </select>
          </label>}
          <p id="remove-enrollment-description">If you continue, {pendingEnrollmentRemoval.studentName} will be removed from enrollment in {pendingEnrollmentRemoval.enrollments.find(({ id }) => id === pendingEnrollmentRemoval.selectedId)?.courseName} / {pendingEnrollmentRemoval.enrollments.find(({ id }) => id === pendingEnrollmentRemoval.selectedId)?.batchName}. The student profile and any other course enrollments will remain.</p>
          <div className={styles.confirmActions}>
            <button type="button" disabled={busy} onClick={() => setPendingEnrollmentRemoval(null)}>No, keep enrollment</button>
            <button type="button" disabled={busy} onClick={removePendingEnrollment}>Yes, remove enrollment</button>
          </div>
        </section>
      </div>}
      {(role === "TRAINER" || role === "COUNSELOR" || role === "OWNER") && <CopilotLauncher />}
    </section>
  );
}
