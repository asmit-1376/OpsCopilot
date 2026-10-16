import Link from "next/link";

const roles = [
  { href: "/owner", title: "Owner", detail: "Institute overview, approvals, schedule and audit" },
  { href: "/counselor", title: "Counselor", detail: "Student follow-ups, engagement and attendance" },
  { href: "/trainer", title: "Trainer", detail: "Assigned batches, classes, attendance and recordings" },
  { href: "/student", title: "Student", detail: "Personal schedule, attendance and course access" },
];

export default function HomePage() {
  return (
    <main className="shell">
      <div className="eyebrow">Institute Operations Copilot</div>
      <h1>Run your institute with clarity.</h1>
      <p className="lead">Choose a role to open its Phase 1 workspace. Authentication and role enforcement will be added in the next implementation phase.</p>
      <section className="role-grid" aria-label="Role dashboards">
        {roles.map((role) => (
          <Link className="role-card" href={role.href} key={role.href}>
            <h2>{role.title}</h2>
            <p>{role.detail}</p>
            <span className="back">Open dashboard →</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
