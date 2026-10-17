"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import styles from "./timetable-solver.module.css";

type Change = { id: string; sessionId: string | null; changeType: string; before: Record<string, unknown>; after: Record<string, unknown>; reason: string };
type Plan = { id: string; query: string; status: string; createdAt: string; requestPayload: { scope?: { date?: string; weekStart?: string }; entities?: Record<string, string[]> }; solverResult: { status?: string; statistics?: Record<string, number> }; validationResult: { valid?: boolean }; changes: Change[]; requestedBy: { name: string }; publishedBy?: { name: string } | null };
type Session = { id: string; startsAt: string; endsAt: string; trainerId: string; roomId?: string | null; batch: { name: string; course: { name: string } }; trainer: { user: { name: string } }; room?: { name: string } | null; subject?: { name: string } | null };
type Workspace = { role: "OWNER" | "COUNSELOR"; sessions: Session[]; plans: Plan[]; trainers: Array<{ id: string; name: string }>; subjects: Array<{ id: string; name: string }> };

async function json(response: Response) {
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof value.error === "string" ? value.error : "Timetable request failed.");
  return value;
}

function localDate(value: string) { return new Date(value).toLocaleDateString("en-CA"); }
function label(value: string) { return new Date(value).toLocaleString(undefined, { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }

export default function TimetableSolver() {
  const [data, setData] = useState<Workspace | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [view, setView] = useState<"daily" | "weekly">("daily");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [needsSubject, setNeedsSubject] = useState(false);

  const refresh = useCallback(async () => {
    const value = await json(await fetch("/api/timetable", { cache: "no-store" })) as Workspace;
    setData(value);
    setSelectedPlanId((current) => current || value.plans.find((plan) => plan.status === "DRAFT")?.id || value.plans[0]?.id || "");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh().catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load timetable.")), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const plan = data?.plans.find((item) => item.id === selectedPlanId) ?? null;
  const preview = useMemo(() => {
    if (!data) return [];
    const changes = new Map((plan?.changes ?? []).filter((change) => change.sessionId).map((change) => [change.sessionId as string, change.after]));
    const published = data.sessions.map((session) => {
      const after = changes.get(session.id);
      if (!after) return session;
      const trainer = data.trainers.find((item) => item.id === after.trainerId);
      const subject = data.subjects.find((item) => item.id === after.subjectId);
      return {
        ...session,
        ...after,
        trainer: trainer ? { user: { name: trainer.name } } : session.trainer,
        subject: subject ? { name: subject.name } : after.subjectName ? { name: String(after.subjectName) } : session.subject,
      } as Session;
    });
    const proposed = (plan?.changes ?? []).filter((change) => !change.sessionId && change.changeType === "CREATE").map((change) => {
      const after = change.after;
      return {
        id: change.id,
        startsAt: String(after.startsAt),
        endsAt: String(after.endsAt),
        trainerId: String(after.trainerId),
        roomId: after.roomId ? String(after.roomId) : null,
        batch: { name: String(after.batchName), course: { name: String(after.courseName) } },
        trainer: { user: { name: String(after.trainerName) } },
        room: after.roomName ? { name: String(after.roomName) } : null,
        subject: after.subjectName ? { name: String(after.subjectName) } : null,
      } satisfies Session;
    });
    return [...published, ...proposed].sort((left, right) => {
      const timeDifference = new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
      return timeDifference || left.id.localeCompare(right.id);
    });
  }, [data, plan]);
  const firstProposedDate = plan?.changes.find((change) => change.after.startsAt)?.after.startsAt;
  const targetDate = firstProposedDate ? localDate(String(firstProposedDate)) : plan?.requestPayload.scope?.date ?? localDate(new Date().toISOString());
  const weekStart = new Date(`${plan?.requestPayload.scope?.weekStart ?? targetDate}T00:00:00`);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
  const publishedSessionsThisWeek = data?.sessions.some((session) => {
    const startsAt = new Date(session.startsAt);
    return startsAt >= weekStart && startsAt < weekEnd;
  }) ?? false;
  const visible = preview.filter((session) => view === "daily" ? localDate(session.startsAt) === targetDate : new Date(session.startsAt) >= weekStart && new Date(session.startsAt) < weekEnd);

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const query = String(form.get("query") ?? "").trim();
      const selectedSubject = needsSubject ? String(form.get("subject") ?? "").trim() : "";
      if (needsSubject && !selectedSubject) { setError("Choose the subject whose weekly lecture count should increase."); setBusy(false); return; }
      const clarifiedQuery = selectedSubject ? `${query} for ${selectedSubject}` : query;
      const value = await json(await fetch("/api/timetable", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: clarifiedQuery, retryOfId: plan?.status === "DRAFT" ? plan.id : undefined, retryFeedback: String(form.get("feedback") ?? "") }) })) as { data: Plan };
      setMessage("Validated timetable draft created. No live sessions have changed yet.");
      setNeedsSubject(false);
      await refresh(); setSelectedPlanId(value.data.id);
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : "Could not generate a plan.";
      if (detail.toLowerCase().includes("name the subject")) setNeedsSubject(true);
      setError(detail);
    }
    finally { setBusy(false); }
  }

  async function decide(action: "PUBLISH" | "CANCEL") {
    if (!plan || (action === "PUBLISH" && !window.confirm("Publish this validated timetable and update live sessions?"))) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await json(await fetch(`/api/timetable/plans/${plan.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) }));
      setMessage(action === "PUBLISH" ? "Timetable published and dashboards notified." : "Draft cancelled.");
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update the plan."); }
    finally { setBusy(false); }
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><p>INSTITUTE SCHEDULING</p><h1>Timetable Solver</h1><span>Jev intent parsing · deterministic demand · CP-SAT · independent validation</span></div>
      <Link href={data?.role === "COUNSELOR" ? "/counselor" : "/owner"}>Back to dashboard</Link>
    </header>
    {message && <p className={styles.success}>{message}</p>}{error && <p className={styles.error}>{error}</p>}
    <section className={styles.grid}>
      <form className={styles.card} onSubmit={generate}>
        <h2>Describe the scheduling problem</h2>
        <textarea name="query" required minLength={3} maxLength={4000} defaultValue="Riya Mehta is unavailable on 2026-10-19. Assign another qualified trainer and prioritize FS-09 React syllabus catch-up." />
        {needsSubject && <label>Subject to increase<select name="subject" defaultValue="" required><option value="" disabled>Select a subject</option>{data?.subjects.map((subject) => <option key={subject.id} value={subject.name}>{subject.name}</option>)}</select></label>}
        <label>Retry feedback (optional)<input name="feedback" placeholder="Keep the original room and avoid evening slots" /></label>
        <button disabled={busy}>{busy ? "Solving…" : plan?.status === "DRAFT" ? "Retry as new draft" : "Generate safe draft"}</button>
        <small>The solver never edits live sessions before owner or counselor approval.</small>
      </form>
      <section className={styles.card}>
        <div className={styles.cardTitle}><h2>Plans</h2><span>{data?.plans.length ?? 0}</span></div>
        <select value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)}><option value="">Current timetable</option>{data?.plans.map((item) => <option key={item.id} value={item.id}>{item.status} · {new Date(item.createdAt).toLocaleString()} · {item.requestedBy.name}</option>)}</select>
        {plan && <div className={styles.planMeta}><strong>{plan.solverResult.status ?? "UNKNOWN"} · {plan.changes.length} changes</strong><span>{plan.query}</span><span>Independent validation: {plan.validationResult.valid ? "passed" : "failed"}</span></div>}
        {plan?.status === "DRAFT" && <div className={styles.actions}><button className={styles.secondary} disabled={busy} onClick={() => void decide("CANCEL")}>Cancel draft</button>{(data?.role === "OWNER" || data?.role === "COUNSELOR") && <button disabled={busy} onClick={() => void decide("PUBLISH")}>Approve & publish</button>}</div>}
      </section>
    </section>
    <section className={styles.card}>
      <div className={styles.toolbar}><div><h2>{view === "daily" ? "Daily" : "Weekly"} preview</h2><span>{plan ? "Draft overlay on the published schedule" : "Published schedule"}</span></div><div><button className={view === "daily" ? styles.active : styles.secondary} onClick={() => setView("daily")}>Daily</button><button className={view === "weekly" ? styles.active : styles.secondary} onClick={() => setView("weekly")}>Weekly</button></div></div>
      {plan && !publishedSessionsThisWeek && <p className={styles.emptyWeekNotice}>No published classes are recorded for this target week. This preview shows the draft additions only; classes in other weeks were not removed.</p>}
      <div className={styles.schedule}>{visible.map((session) => { const changed = plan?.changes.some((item) => item.sessionId === session.id || (!item.sessionId && item.id === session.id)); const trainerName = data?.trainers.find((item) => item.id === session.trainerId)?.name ?? session.trainer.user.name; return <article key={session.id} className={changed ? styles.changed : ""}><time>{label(session.startsAt)}</time><div><strong>{session.subject?.name ?? session.batch.course.name} · {session.batch.name}</strong><span>{trainerName} · {session.room?.name ?? "Online"}</span></div>{changed && <b>PROPOSED</b>}</article>; })}{!visible.length && <p>No sessions match this preview.</p>}</div>
      {plan?.changes.map((change) => <p className={styles.reason} key={change.id}>{change.changeType}: {change.reason}</p>)}
    </section>
  </main>;
}

