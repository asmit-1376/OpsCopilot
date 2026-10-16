import Link from "next/link";

export default function OwnerDashboard() {
  return <main className="shell"><div className="topline"><Link className="brand" href="/">OPSPILOT</Link><span className="status"><span className="dot" />Owner workspace</span></div><div className="eyebrow">Institute dashboard</div><h1>Good morning, Owner.</h1><p className="lead">Your institute overview will bring together students, batches, attendance, collections and timetable health.</p><section className="panel"><h2>Phase 1 foundation</h2><p className="muted">Role-specific routes are ready. Connect this dashboard to the Prisma data model as the next phase adds seed data and operational APIs.</p></section></main>;
}
