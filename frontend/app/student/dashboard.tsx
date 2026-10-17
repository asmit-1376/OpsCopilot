"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/auth/auth-client";
import styles from "./dashboard.module.css";

export type StudentSection = "overview" | "timetable" | "attendance" | "recordings" | "fees";

type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";
type InstallmentStatus = "PAID" | "DUE" | "UPCOMING" | "OVERDUE" | "PARTIALLY_PAID" | "WAIVED";

export interface StudentDashboardData {
  studentName: string;
  studentId: string | null;
  instituteName: string;
  timezone: string;
  batches: Array<{ name: string; course: string }>;
  feeTotals: Array<{ currency: string; total: number; paid: number; balance: number }>;
  attendanceRate: number | null;
  attendanceAttended: number;
  attendanceTotal: number;
  attendance: Array<{
    id: string;
    date: string;
    course: string;
    batch: string;
    trainer: string;
    room: string | null;
    mode: string;
    status: AttendanceStatus;
  }>;
  sessions: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    course: string;
    batch: string;
    trainer: string;
    room: string | null;
    mode: string;
  }>;
  recordings: Array<{
    id: string;
    url: string;
    availableAt: string | null;
    course: string;
    trainer: string;
  }>;
  recordingsTotal: number;
  installments: Array<{
    id: string;
    title: string;
    amount: number;
    paidAmount: number;
    dueAt: string;
    status: InstallmentStatus;
    reference: string | null;
    currency: string;
  }>;
}

const tabs: Array<{ id: StudentSection; label: string }> = [
  { id: "overview", label: "Learning desk" },
  { id: "timetable", label: "Timetable" },
  { id: "attendance", label: "Attendance" },
  { id: "recordings", label: "Recordings" },
  { id: "fees", label: "Fees & receipts" },
];

function dateTime(value: string, timezone: string, includeDate = true) {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: timezone,
      ...(includeDate ? { weekday: "short", day: "numeric", month: "short", year: "numeric" } : {}),
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat("en-IN", {
      ...(includeDate ? { weekday: "short", day: "numeric", month: "short", year: "numeric" } : {}),
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  }
}

function dateOnly(value: string, timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: timezone,
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
  }
}

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
  }
}

function safeRecordingUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function Status({ value }: { value: string }) {
  const tone = value === "PRESENT" || value === "PAID" ? "success" : value === "OVERDUE" || value === "ABSENT" ? "danger" : "neutral";
  return <span className={`${styles.status} ${styles[tone]}`}>{value.replaceAll("_", " ")}</span>;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className={styles.emptyState}>{children}</div>;
}

function DashboardOption({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) {
  return <details className={styles.dashboardOption} name="student-dashboard-options">
    <summary><span>{title}</span><small>{detail}</small></summary>
    {children}
  </details>;
}

export default function StudentDashboard({
  data,
  activeSection,
  dataUnavailable = false,
}: {
  data: StudentDashboardData | null;
  activeSection: StudentSection;
  dataUnavailable?: boolean;
}) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function signOut() {
    setIsSigningOut(true);
    setSignOutError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setSignOutError("Could not sign out. Please try again.");
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      setSignOutError("Could not sign out. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  }

  const sectionTitle = tabs.find(({ id }) => id === activeSection)?.label ?? "Learning desk";

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <Link href="/student" className={styles.brand} aria-label="Student portal home">
          <span className={styles.brandMark} aria-hidden="true">O</span>
          <span>
            <strong>{data?.instituteName ?? "Institute portal"}</strong>
            <small>Student portal</small>
          </span>
        </Link>
        <p className={styles.sidebarLabel}>LEARNING</p>

      <nav className={styles.tabs} aria-label="Student portal sections">
        {tabs.map(({ id, label }) => (
          <Link
            key={id}
            href={id === "overview" ? "/student" : `/student?section=${id}`}
            className={`${styles.tab} ${activeSection === id ? styles.activeTab : ""}`}
            aria-current={activeSection === id ? "page" : undefined}
          >
            {label}
            {id === "attendance" && data?.attendanceRate !== null && data?.attendanceRate !== undefined ? (
              <span className={styles.tabCount}>{data.attendanceRate.toFixed(1)}%</span>
            ) : null}
            {id === "recordings" && data?.recordingsTotal ? (
              <span className={styles.tabCount}>{data.recordingsTotal}</span>
            ) : null}
          </Link>
        ))}
      </nav>
        <div className={styles.sidebarAccount}>
          <div className={styles.accountText}>
            <strong>{data?.studentName ?? "Student account"}</strong>
            <span>{data?.studentId ? `ID ${data.studentId}` : "Student ID not assigned"}</span>
          </div>
          <button className={styles.signOut} type="button" onClick={signOut} disabled={isSigningOut}>
            {isSigningOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      <div className={styles.contentShell}>
      {data ? (
        <>
          <div className={styles.scopeNotice}>
            <span className={styles.scopeIcon} aria-hidden="true">✓</span>
            <p>
              Welcome, <strong>{data.studentName}</strong>. This page shows your enrollments and personal learning records.
              {data.batches.length ? ` Current batch${data.batches.length > 1 ? "es" : ""}: ${data.batches.map(({ name }) => name).join(", ")}.` : " You do not have an active batch yet."}
            </p>
          </div>

          <main className={styles.main}>
            <div className={styles.pageHeading}>
              <div>
                <p className={styles.eyebrow}>LEARNING PORTAL</p>
                <h1>{sectionTitle}</h1>
              </div>
              {data.batches.length > 0 && <span className={styles.batchLabel}>{data.batches.map(({ name }) => name).join(" · ")}</span>}
            </div>

            {signOutError && <p className={styles.errorMessage} role="alert">{signOutError}</p>}

            {activeSection === "overview" && <Overview data={data} />}
            {activeSection === "timetable" && <Timetable data={data} />}
            {activeSection === "attendance" && <Attendance data={data} />}
            {activeSection === "recordings" && <Recordings data={data} />}
            {activeSection === "fees" && <Fees data={data} />}
          </main>
        </>
      ) : (
        <main className={styles.main}>
          <div className={styles.missingProfile}>
            <span className={styles.missingIcon} aria-hidden="true">i</span>
            <h1>{dataUnavailable ? "Student data unavailable" : "Student profile not linked"}</h1>
            <p>{dataUnavailable
              ? "We could not load your learning records right now. Please refresh the page in a moment."
              : "Your sign-in is active, but there is no student profile linked to it yet. Contact your institute administrator to finish setting up your account."}</p>
          </div>
        </main>
      )}
      </div>
    </div>
  );
}

function Overview({ data }: { data: StudentDashboardData }) {
  const nextInstallment = data.installments.find(({ status }) => status !== "PAID" && status !== "WAIVED");
  const upcoming = data.sessions[0];
  const feeBalance = data.feeTotals.length === 1
    ? money(data.feeTotals[0].balance, data.feeTotals[0].currency)
    : data.feeTotals.length > 1
      ? `${data.feeTotals.length} currencies`
      : "—";
  const feeDetail = data.feeTotals.length > 1
    ? data.feeTotals.map(({ currency, balance }) => `${currency} ${balance.toLocaleString("en-IN")}`).join(" · ")
    : nextInstallment
      ? `Next due ${dateOnly(nextInstallment.dueAt, data.timezone)}`
      : data.feeTotals.length === 1
        ? "No pending installments"
        : "No fee plan on file";

  return (
    <div className={styles.stack}>
      <DashboardOption title={upcoming ? `Next class · ${upcoming.course}` : "Next class"} detail={upcoming ? `${dateTime(upcoming.startsAt, data.timezone)} · ${upcoming.batch}` : "No upcoming class is scheduled"}>
      <section className={styles.hero} aria-labelledby="next-class-title">
        <div>
          <p className={styles.heroEyebrow}>{upcoming ? "NEXT CLASS" : "CLASS SCHEDULE"}</p>
          {upcoming ? (
            <>
              <p className={styles.heroTime}>{dateTime(upcoming.startsAt, data.timezone)} – {dateTime(upcoming.endsAt, data.timezone, false)}</p>
              <h2 id="next-class-title">{upcoming.course}</h2>
              <p className={styles.heroDetails}>
                {upcoming.batch} <span aria-hidden="true">·</span> {upcoming.trainer}
                {upcoming.room ? <> <span aria-hidden="true">·</span> {upcoming.room}</> : null}
                {upcoming.mode === "ONLINE" ? <> <span aria-hidden="true">·</span> Online session details are not available yet</> : null}
              </p>
            </>
          ) : (
            <>
              <h2 id="next-class-title">No upcoming class scheduled</h2>
              <p className={styles.heroDetails}>Your timetable will show the next session when it is published.</p>
            </>
          )}
        </div>
        <Link href="/student?section=timetable" className={styles.heroLink}>View timetable <span aria-hidden="true">→</span></Link>
      </section>
      </DashboardOption>

      <DashboardOption title="Learning summary" detail={`${data.batches.length} active batches · ${data.attendanceRate === null ? "attendance not recorded" : `${data.attendanceRate.toFixed(1)}% attendance`}`}>
      <section className={styles.metrics} aria-label="Learning summary">
        <Metric label="Attendance" value={data.attendanceRate === null ? "—" : `${data.attendanceRate.toFixed(1)}%`} detail={data.attendanceRate === null ? "No attendance posted" : `${data.attendanceAttended} of ${data.attendanceTotal} sessions present or late`} />
        <Metric label="Active courses" value={String(new Set(data.batches.map(({ course }) => course)).size)} detail={data.batches.length ? data.batches.map(({ course }) => course).join(", ") : "No active enrollment"} />
        <Metric label="Fee balance" value={feeBalance} detail={feeDetail} />
        <Metric label="Recordings" value={String(data.recordingsTotal)} detail="Available to you" />
      </section>
      </DashboardOption>

      <div className={styles.contentGrid}>
        <DashboardOption title="Recent attendance" detail={`${data.attendance.length} records · ${data.attendanceRate === null ? "no rate yet" : `${data.attendanceRate.toFixed(1)}% attendance`}`}>
        <section className={styles.panel} aria-labelledby="recent-attendance-title">
          <div className={styles.panelHeading}>
            <div><h2 id="recent-attendance-title">Recent attendance</h2><p>Your latest recorded sessions</p></div>
            <Link href="/student?section=attendance" className={styles.textLink}>All records <span aria-hidden="true">→</span></Link>
          </div>
          {data.attendance.length ? (
            <div className={styles.tableScroll} tabIndex={0} aria-label="Recent attendance records; horizontally scrollable on small screens">
              <table className={styles.table}>
                <caption className={styles.srOnly}>Your five most recent attendance records</caption>
                <thead><tr><th scope="col">Date</th><th scope="col">Course</th><th scope="col">Trainer</th><th scope="col">Status</th></tr></thead>
                <tbody>{data.attendance.slice(0, 5).map((record) => (
                  <tr key={record.id}><td>{dateOnly(record.date, data.timezone)}</td><td>{record.course}</td><td>{record.trainer}</td><td><Status value={record.status} /></td></tr>
                ))}</tbody>
              </table>
            </div>
          ) : <EmptyState>Attendance records will appear here after your sessions.</EmptyState>}
        </section>
        </DashboardOption>

        <DashboardOption title="Latest recordings" detail={`${data.recordingsTotal} recordings available`}>
        <section className={styles.panel} aria-labelledby="recent-recordings-title">
          <div className={styles.panelHeading}>
            <div><h2 id="recent-recordings-title">Latest recordings</h2><p>Published sessions from your batches</p></div>
            <Link href="/student?section=recordings" className={styles.textLink}>Library <span aria-hidden="true">→</span></Link>
          </div>
          {data.recordings.length ? (
            <ul className={styles.recordingList}>
              {data.recordings.slice(0, 3).map((recording) => {
                const url = safeRecordingUrl(recording.url);
                return <li key={recording.id}>
                  <div><strong>{recording.course}</strong><span>{recording.trainer}{recording.availableAt ? ` · ${dateOnly(recording.availableAt, data.timezone)}` : ""}</span></div>
                  {url ? <a className={styles.smallButton} href={url} target="_blank" rel="noopener noreferrer">Watch <span aria-hidden="true">↗</span></a> : <span className={styles.muted}>Link unavailable</span>}
                </li>;
              })}
            </ul>
          ) : <EmptyState>No recordings have been published to your batches yet.</EmptyState>}
        </section>
        </DashboardOption>
      </div>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className={styles.metric}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function Timetable({ data }: { data: StudentDashboardData }) {
  return <DashboardOption title="Upcoming classes" detail={`${data.sessions.length} scheduled classes`}><section className={styles.panel} aria-labelledby="timetable-title">
    <div className={styles.panelHeading}>
      <div><h2 id="timetable-title">Upcoming classes</h2><p>Scheduled sessions for your active enrollments</p></div>
    </div>
    {data.sessions.length ? <ul className={styles.sessionList}>
      {data.sessions.map((session) => <li key={session.id}>
        <div className={styles.sessionDate}><strong>{dateOnly(session.startsAt, data.timezone)}</strong><span>{dateTime(session.startsAt, data.timezone, false)} – {dateTime(session.endsAt, data.timezone, false)}</span></div>
        <div className={styles.sessionInfo}><strong>{session.course}</strong><span>{session.batch} · {session.trainer}</span></div>
        <div className={styles.sessionPlace}><span>{session.mode.toLowerCase()}</span><span>{session.room ?? (session.mode === "ONLINE" ? "Online" : "Location not set")}</span></div>
      </li>)}</ul> : <EmptyState>No upcoming classes are scheduled for your active batches.</EmptyState>}
  </section></DashboardOption>;
}

function Attendance({ data }: { data: StudentDashboardData }) {
  return <DashboardOption title="Attendance history" detail={data.attendanceRate === null ? "No attendance has been posted" : `${data.attendanceRate.toFixed(1)}% across ${data.attendanceTotal} sessions`}><section className={styles.panel} aria-labelledby="attendance-title">
    <div className={styles.panelHeading}>
      <div><h2 id="attendance-title">Attendance history</h2><p>{data.attendanceRate === null ? "No attendance has been posted yet." : `${data.attendanceRate.toFixed(1)}% attendance across ${data.attendanceTotal} recorded sessions`}</p></div>
    </div>
    {data.attendance.length ? <div className={styles.tableScroll} tabIndex={0} aria-label="Attendance history; horizontally scrollable on small screens">
      <table className={styles.table}>
        <caption className={styles.srOnly}>Attendance history for your enrolled sessions</caption>
        <thead><tr><th scope="col">Session date</th><th scope="col">Course / batch</th><th scope="col">Trainer</th><th scope="col">Status</th><th scope="col">Location</th></tr></thead>
        <tbody>{data.attendance.map((record) => <tr key={record.id}>
          <td>{dateOnly(record.date, data.timezone)}</td><td>{record.course}<small className={styles.cellSub}>{record.batch}</small></td><td>{record.trainer}</td><td><Status value={record.status} /></td><td>{record.room ?? record.mode.toLowerCase()}</td>
        </tr>)}</tbody>
      </table>
      {data.attendance.length >= 100 && <p className={styles.tableNote}>Showing the latest 100 records.</p>}
    </div> : <EmptyState>Your attendance history will appear here after the institute posts session records.</EmptyState>}
  </section></DashboardOption>;
}

function Recordings({ data }: { data: StudentDashboardData }) {
  return <DashboardOption title="Recordings library" detail={`${data.recordingsTotal} recordings available`}><section className={styles.panel} aria-labelledby="recordings-title">
    <div className={styles.panelHeading}>
      <div><h2 id="recordings-title">Recordings library</h2><p>Available recordings for your active batches</p></div>
    </div>
    {data.recordings.length ? <>
      <ul className={styles.recordingGrid}>
      {data.recordings.map((recording) => {
        const url = safeRecordingUrl(recording.url);
        return <li className={styles.recordingCard} key={recording.id}>
          <span className={styles.recordingIcon} aria-hidden="true">▶</span>
          <div><h3>{recording.course}</h3><p>{recording.trainer}</p><p>{recording.availableAt ? `Available ${dateOnly(recording.availableAt, data.timezone)}` : "Available now"}</p></div>
          {url ? <a className={styles.primaryButton} href={url} target="_blank" rel="noopener noreferrer">Watch recording <span aria-hidden="true">↗</span></a> : <span className={styles.muted}>Recording link unavailable</span>}
        </li>;
      })}
      </ul>
      {data.recordingsTotal > data.recordings.length && <p className={styles.tableNote}>Showing the latest {data.recordings.length} of {data.recordingsTotal} recordings.</p>}
    </> : <EmptyState>Recordings will appear here when they are published for one of your enrolled sessions.</EmptyState>}
  </section></DashboardOption>;
}

function Fees({ data }: { data: StudentDashboardData }) {
  return <DashboardOption title="Fees & receipts" detail={`${data.installments.length} installments · payment history`}><section className={styles.panel} aria-labelledby="fees-title">
    <div className={styles.panelHeading}>
      <div><h2 id="fees-title">Fees & receipts</h2><p>Installments and completed payment references for your enrollments</p></div>
      {data.feeTotals.length > 0 && <div className={styles.feeSummary}>
        {data.feeTotals.map(({ currency, total, balance }) => <div key={currency}>
          <span>Total course fee · {currency}</span><strong>{money(total, currency)}</strong><span>Balance {money(balance, currency)}</span>
        </div>)}
      </div>}
    </div>
    {data.installments.length ? <>
      <div className={styles.tableScroll} tabIndex={0} aria-label="Fee installments; horizontally scrollable on small screens">
        <table className={styles.table}>
          <caption className={styles.srOnly}>Fee installments and payment references</caption>
          <thead><tr><th scope="col">Installment</th><th scope="col">Due date</th><th scope="col">Amount</th><th scope="col">Status</th><th scope="col">Receipt reference</th></tr></thead>
          <tbody>{data.installments.map((installment) => <tr key={installment.id}>
            <td>{installment.title}</td><td>{dateOnly(installment.dueAt, data.timezone)}</td><td>{money(installment.amount, installment.currency)}{installment.paidAmount > 0 && installment.paidAmount < installment.amount ? <small className={styles.cellSub}>Paid {money(installment.paidAmount, installment.currency)}</small> : null}</td><td><Status value={installment.status} /></td><td>{installment.reference ?? (installment.status === "PAID" ? "Receipt reference not issued" : "—")}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className={styles.tableNote}>Online payment and downloadable receipts are not connected yet. For payment assistance, contact your institute accounts desk.</p>
    </> : <EmptyState>No fee plan has been added to your active enrollments yet.</EmptyState>}
  </section></DashboardOption>;
}
