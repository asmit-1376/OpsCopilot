import Link from "next/link";

export default function CounselorDashboard() {
  return <main className="shell"><div className="topline"><Link className="brand" href="/">OPSPILOT</Link><span className="status"><span className="dot" />Counselor workspace</span></div><div className="eyebrow">Student engagement</div><h1>Stay close to every learner.</h1><p className="lead">Your workspace will highlight student follow-ups, enrollment activity and attendance patterns for counseling.</p><section className="panel"><h2>Phase 1 foundation</h2><p className="muted">This route is ready for counselor-specific student and follow-up views.</p></section></main>;
}
