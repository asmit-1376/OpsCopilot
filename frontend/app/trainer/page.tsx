import Link from "next/link";

export default function TrainerDashboard() {
  return <main className="shell"><div className="topline"><Link className="brand" href="/">OPSPILOT</Link><span className="status"><span className="dot" />Trainer workspace</span></div><div className="eyebrow">Teaching workspace</div><h1>Your classes, at a glance.</h1><p className="lead">Your workspace will show assigned batches, today's classes, attendance tasks and available recordings.</p><section className="panel"><h2>Phase 1 foundation</h2><p className="muted">This route is ready for trainer-specific batch and timetable views. Fee data is not part of the trainer dashboard.</p></section></main>;
}
