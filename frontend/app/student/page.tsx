import Link from "next/link";

export default function StudentDashboard() {
  return <main className="shell"><div className="topline"><Link className="brand" href="/">OPSPILOT</Link><span className="status"><span className="dot" />Student workspace</span></div><div className="eyebrow">My learning</div><h1>Keep your learning on track.</h1><p className="lead">Your workspace will show your upcoming sessions, attendance, recordings and course progress.</p><section className="panel"><h2>Phase 1 foundation</h2><p className="muted">This route is ready for a personal student view. Student sign-in and record-level access will be connected in a later phase.</p></section></main>;
}
