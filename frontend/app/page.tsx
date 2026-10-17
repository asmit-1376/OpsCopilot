import Link from "next/link";

const roles = [
  { href: "/owner", title: "Owner", detail: "Institute overview, approvals, revenue analytics & audit trails" },
  { href: "/counselor", title: "Counselor", detail: "Lead conversion, student follow-ups, batches & attendance" },
  { href: "/trainer", title: "Trainer", detail: "Assigned batches, live classes, student progress & recordings" },
  { href: "/student", title: "Student", detail: "Personal schedule, coding labs, recordings & course progress" },
];

export default function HomePage() {
  return (
    <div className="tst-page">
      {/* Top Header */}
      <header className="tst-nav">
        <div className="tst-nav-container">
          <Link href="/" className="tst-brand-link">
            <div className="tst-logo-badge">
              <svg viewBox="0 0 24 24" className="tst-mountain-icon" fill="currentColor">
                <path d="M12 6L4.5 19h15L12 6zm-1.2 5.5l2.4 4.1h-4.8l2.4-4.1z" />
              </svg>
            </div>
            <span className="tst-brand-title">OpsCopilot</span>
          </Link>

          <div className="tst-nav-actions">
            <Link href="/login" className="tst-btn-amber-sm">
              Sign In to Portal →
            </Link>
          </div>
        </div>
      </header>

      {/* Main Hero Container */}
      <main className="tst-container" style={{ padding: "48px 24px 80px" }}>
        <div className="tst-pill-badge" style={{ marginBottom: "16px" }}>
          <span className="tst-pulse-dot" />
          <span className="tst-badge-accent">OPSCOPILOT SUITE</span>
          <span className="tst-badge-divider">—</span>
          <span className="tst-badge-text">Secure Institute Management Portal</span>
        </div>

        <h1 style={{ fontSize: "clamp(34px, 4.5vw, 54px)", fontWeight: 800, letterSpacing: "-0.03em", color: "#111827", marginBottom: "16px", maxWidth: "800px" }}>
          Run your institute with <span className="tst-text-gradient-amber">total clarity.</span>
        </h1>

        <p style={{ fontSize: "18px", color: "#4B5563", maxWidth: "680px", lineHeight: 1.6, marginBottom: "32px" }}>
          Unified governance, admissions CRM, faculty scheduling, and student learning paths for your institute.
        </p>

        {/* Action Link to Authentication */}
        <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginBottom: "44px" }}>
          <Link href="/login" className="tst-btn-amber-lg" style={{ width: "auto", padding: "0 28px" }}>
            Open Authentication Page →
          </Link>
        </div>

        {/* Role Cards Grid */}
        <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#111827", marginBottom: "16px", letterSpacing: "-0.02em" }}>
          Direct Role Workspaces
        </h2>

        <section className="role-grid" aria-label="Role dashboards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "18px" }}>
          {roles.map((role) => (
            <Link
              className="role-card"
              href={role.href}
              key={role.href}
              style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: "16px",
                padding: "24px",
                boxShadow: "0 4px 14px rgba(0,0,0,0.03)",
                transition: "all 0.2s ease"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#d97706", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Workspace
                </span>
                <span className="tst-dot active" />
              </div>
              <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#111827", marginBottom: "8px" }}>{role.title}</h3>
              <p style={{ fontSize: "14px", color: "#6b7280", lineHeight: 1.5, marginBottom: "16px" }}>{role.detail}</p>
              <span style={{ fontSize: "13.5px", fontWeight: 700, color: "#d97706" }}>Open workspace →</span>
            </Link>
          ))}
        </section>
      </main>

      {/* Footer */}
      <footer className="tst-footer">
        <div className="tst-container">
          <div className="tst-footer-flex">
            <div>© {new Date().getFullYear()} OpsCopilot</div>
            <div className="tst-footer-links">
              <Link href="/login">Sign In</Link>
              <Link href="/auth">Register</Link>
              <Link href="/owner">Owner</Link>
              <Link href="/counselor">Counselor</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
