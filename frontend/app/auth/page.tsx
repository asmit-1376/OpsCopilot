"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Role options with demo credentials for OpsCopilot
const DEMO_ROLES = [
  {
    role: "OWNER",
    label: "Owner",
    email: "owner@techsummittrainers.com",
    name: "Rajesh Sharma",
    route: "/owner",
    badge: "Institute Admin",
    description: "Full governance, revenue, approvals & audits",
  },
  {
    role: "COUNSELOR",
    label: "Counselor",
    email: "counselor@techsummittrainers.com",
    name: "Pooja Patil",
    route: "/counselor",
    badge: "Admissions",
    description: "Student follow-ups, leads & attendance trends",
  },
  {
    role: "TRAINER",
    label: "Trainer",
    email: "trainer@techsummittrainers.com",
    name: "Amit Kulkarni",
    route: "/trainer",
    badge: "Faculty",
    description: "Batches, live coding sessions & recordings",
  },
  {
    role: "ACCOUNTS",
    label: "Accounts Staff",
    email: "accounts@techsummittrainers.com",
    name: "Suresh Deshmukh",
    route: "/accounts",
    badge: "Finance",
    description: "Collections, EMIs, bank reconciliations & receipts",
  },
  {
    role: "STUDENT",
    label: "Student",
    email: "student@techsummittrainers.com",
    name: "Sneha Joshi",
    route: "/student",
    badge: "Learner",
    description: "Curriculum roadmap, assignments & labs",
  },
];

export default function AuthPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<"signin" | "register">("signin");
  const [selectedRole, setSelectedRole] = useState("STUDENT");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form states
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("student@techsummittrainers.com");
  const [phone, setPhone] = useState("+91 84858 46806");
  const [password, setPassword] = useState("Password@123");
  const [careerTrack, setCareerTrack] = useState("Full-Stack Software Engineering");

  // Quick Demo Auto-fill
  const handleSelectRole = (roleKey: string) => {
    setSelectedRole(roleKey);
    const target = DEMO_ROLES.find((r) => r.role === roleKey);
    if (target) {
      setEmail(target.email);
      setFullName(target.name);
      setPassword("Password@123");
      showToast(`Selected demo profile: ${target.label} (${target.email})`);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3600);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const currentRole = DEMO_ROLES.find((r) => r.role === selectedRole) || DEMO_ROLES[3];

    setTimeout(() => {
      setIsSubmitting(false);
      showToast(
        authMode === "signin"
          ? `Welcome back, ${currentRole.label}! Directing to workspace...`
          : `Account created successfully! Launching ${currentRole.label} dashboard...`
      );

      // Redirect to the appropriate dashboard
      setTimeout(() => {
        router.push(currentRole.route);
      }, 900);
    }, 700);
  };

  return (
    <div className="tst-page">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="tst-toast animate-slide-down" role="alert">
          <span className="tst-toast-icon">✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="tst-nav">
        <div className="tst-nav-container">
          <div className="tst-brand-wrap">
            <Link href="/" className="tst-brand-link">
              <div className="tst-logo-badge">
                {/* Mountain / Summit Icon */}
                <svg viewBox="0 0 24 24" className="tst-mountain-icon" fill="currentColor">
                  <path d="M12 3L2 20h20L12 3zm0 4.2l5.8 9.8H6.2L12 7.2z" opacity="0.15" />
                  <path d="M12 6L4.5 19h15L12 6zm-1.2 5.5l2.4 4.1h-4.8l2.4-4.1z" />
                </svg>
              </div>
              <span className="tst-brand-title">TechSummitTrainers</span>
            </Link>
          </div>

          <nav className="tst-menu" aria-label="Main Navigation">
            <span className="tst-menu-link has-dropdown">
              Courses
              <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </span>
            <span className="tst-menu-link">Why Us</span>
            <span className="tst-menu-link">Student Stories</span>
            <span className="tst-menu-link">Mentors</span>
            <span className="tst-menu-link">Campus</span>
            <span className="tst-menu-link">FAQ</span>
          </nav>

          <div className="tst-nav-actions">
            {/* Phone */}
            <a
              href="tel:+918485846806"
              className="tst-icon-circle"
              title="Call Us: +91 84858 46806"
              aria-label="Call TechSummitTrainers"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </a>

            {/* WhatsApp */}
            <a
              href="https://wa.me/918485846806"
              target="_blank"
              rel="noopener noreferrer"
              className="tst-icon-circle"
              title="WhatsApp Mentors"
              aria-label="WhatsApp"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24M8.53 7.33c-.16 0-.42.06-.64.3-.22.25-.85.83-.85 2.02s.87 2.34.99 2.51c.13.16 1.7 2.6 4.13 3.65.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.47-.28-.25-.13-1.44-.71-1.66-.79-.22-.09-.39-.13-.55.13-.16.25-.64.79-.78.96-.15.16-.29.18-.54.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.15-.25-.02-.39.11-.51.11-.11.25-.29.38-.44.13-.15.17-.25.25-.42.09-.17.04-.31-.02-.44-.06-.13-.55-1.33-.76-1.82-.2-.48-.41-.41-.56-.42l-.48-.01z" />
              </svg>
            </a>

            {/* LinkedIn */}
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="tst-icon-circle"
              title="LinkedIn"
              aria-label="LinkedIn"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76c.86 0 1.55-.7 1.55-1.55 0-.86-.7-1.55-1.55-1.55-.86 0-1.55.7-1.55 1.55 0 .86.69 1.55 1.55 1.55m1.39 9.74v-8.37H5.07v8.37h2.78z" />
              </svg>
            </a>

            {/* Instagram */}
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="tst-icon-circle"
              title="Instagram"
              aria-label="Instagram"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </a>

            <button
              type="button"
              className="tst-btn-amber-sm"
              onClick={() => handleSelectRole("STUDENT")}
            >
              Book a Free Demo
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="tst-main-content">
        <div className="tst-container">
          <div className="tst-split-grid">
            {/* Left Column: Brand Hero & Value Proposition */}
            <section className="tst-hero-col">
              {/* Top Dark Badge */}
              <div className="tst-pill-badge">
                <span className="tst-pulse-dot" />
                <span className="tst-badge-accent">FREE ASSESSMENT</span>
                <span className="tst-badge-divider">—</span>
                <span className="tst-badge-text">Are you job-ready? Find out now →</span>
              </div>

              {/* Main Headline */}
              <h1 className="tst-hero-title">
                Not a coaching <br />
                class. <br />
                A <span className="tst-text-gradient-amber">career launchpad.</span>
              </h1>

              {/* Sub-paragraph */}
              <p className="tst-hero-desc">
                Learn full-stack development, DevOps and AI directly from{" "}
                <strong>working industry professionals</strong> — practitioners who build and ship
                real software, bringing that experience into every session with honest, personal mentorship.
              </p>

              {/* Video Story Feature Card (from screenshot 2) */}
              <div className="tst-story-card">
                <div className="tst-story-media">
                  <div className="tst-story-avatar-box">
                    {/* Stylized Instructor Avatar Illustration */}
                    <div className="tst-story-portrait">
                      <div className="tst-avatar-head" />
                      <div className="tst-avatar-body" />
                    </div>
                  </div>

                  {/* Brand Watermark in Story */}
                  <div className="tst-story-watermark">
                    <div className="tst-logo-badge small">
                      <svg viewBox="0 0 24 24" className="tst-mountain-icon" fill="currentColor">
                        <path d="M12 6L4.5 19h15L12 6zm-1.2 5.5l2.4 4.1h-4.8l2.4-4.1z" />
                      </svg>
                    </div>
                  </div>

                  {/* Video Subtitle Caption */}
                  <div className="tst-story-caption">
                    <span className="tst-story-label">OUR STORY</span>
                    <p className="tst-story-quote">"मध्ये तुमचे स्वागत करतो — Where engineers are made."</p>
                  </div>
                </div>

                {/* Carousel Controls */}
                <div className="tst-carousel-dots">
                  <button className="tst-carousel-arrow" aria-label="Previous">‹</button>
                  <span className="tst-dot" />
                  <span className="tst-dot active" />
                  <span className="tst-dot" />
                  <button className="tst-carousel-arrow" aria-label="Next">›</button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="tst-hero-buttons">
                <Link href="#explore" className="tst-btn-outline">
                  Explore Courses →
                </Link>
                <Link href="#mentors" className="tst-btn-outline">
                  Meet the Mentors
                </Link>
              </div>

              {/* Stats Highlights */}
              <div className="tst-stats-row">
                <div className="tst-stat-item">
                  <div className="tst-stat-num">5</div>
                  <div className="tst-stat-label">career tracks</div>
                </div>
                <div className="tst-stat-item">
                  <div className="tst-stat-num">26+</div>
                  <div className="tst-stat-label">yrs combined experience</div>
                </div>
                <div className="tst-stat-item">
                  <div className="tst-stat-num">Small</div>
                  <div className="tst-stat-label">focused batches</div>
                </div>
                <div className="tst-stat-item">
                  <div className="tst-stat-num">Live</div>
                  <div className="tst-stat-label">+ recorded sessions</div>
                </div>
              </div>
            </section>

            {/* Right Column: Authentication Card (The Theme Match) */}
            <section className="tst-auth-col">
              <div className="tst-auth-card">
                {/* Mode Switcher Tabs */}
                <div className="tst-tab-switch">
                  <button
                    type="button"
                    className={`tst-tab-btn ${authMode === "signin" ? "active" : ""}`}
                    onClick={() => setAuthMode("signin")}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    className={`tst-tab-btn ${authMode === "register" ? "active" : ""}`}
                    onClick={() => setAuthMode("register")}
                  >
                    Create Account
                  </button>
                </div>

                {/* Card Title */}
                <div className="tst-card-heading-wrap">
                  <h2 className="tst-card-title">
                    {authMode === "signin"
                      ? "Sign in to TechSummit portal"
                      : "Talk to a mentor about your career"}
                  </h2>
                  <p className="tst-card-subtitle">
                    {authMode === "signin"
                      ? "Access your learning modules, batches & institute tools."
                      : "Fast-track your tech career with personalized industry mentorship."}
                  </p>
                </div>

                {/* Role Switcher Pill Bar for Quick Demo */}
                <div className="tst-role-selector">
                  <div className="tst-role-header">
                    <span className="tst-role-title">Choose Portal Role:</span>
                    <span className="tst-role-hint">Auto-fills demo account</span>
                  </div>
                  <div className="tst-role-chips">
                    {DEMO_ROLES.map((r) => (
                      <button
                        key={r.role}
                        type="button"
                        onClick={() => handleSelectRole(r.role)}
                        className={`tst-chip ${selectedRole === r.role ? "active" : ""}`}
                      >
                        <span className="tst-chip-dot" />
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <div className="tst-role-desc">
                    {DEMO_ROLES.find((r) => r.role === selectedRole)?.description}
                  </div>
                </div>

                {/* The Authentication Form */}
                <form onSubmit={handleSubmit} className="tst-form">
                  {/* Full Name (for Register) */}
                  {authMode === "register" && (
                    <div className="tst-form-group">
                      <label className="tst-label" htmlFor="fullName">Full name</label>
                      <input
                        id="fullName"
                        type="text"
                        required
                        className="tst-input"
                        placeholder="e.g. Rahul Patil"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                  )}

                  {/* Email address */}
                  <div className="tst-form-group">
                    <label className="tst-label" htmlFor="email">Email address</label>
                    <input
                      id="email"
                      type="email"
                      required
                      className="tst-input"
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  {/* Phone number (for Register or WhatsApp OTP) */}
                  {authMode === "register" && (
                    <div className="tst-form-group">
                      <label className="tst-label" htmlFor="phone">Phone number</label>
                      <input
                        id="phone"
                        type="tel"
                        required
                        className="tst-input"
                        placeholder="e.g. +91 98765 43210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  )}

                  {/* Career Track selector (for Register) */}
                  {authMode === "register" && (
                    <div className="tst-form-group">
                      <label className="tst-label" htmlFor="track">Interested Track</label>
                      <select
                        id="track"
                        className="tst-input tst-select"
                        value={careerTrack}
                        onChange={(e) => setCareerTrack(e.target.value)}
                      >
                        <option value="Full-Stack Software Engineering">Full-Stack Software Engineering</option>
                        <option value="DevOps & Cloud Engineering">DevOps & Cloud Engineering</option>
                        <option value="Applied Generative AI & Data">Applied Generative AI & Data</option>
                        <option value="Microservices & Backend Systems">Microservices & Backend Systems</option>
                      </select>
                    </div>
                  )}

                  {/* Password Field */}
                  <div className="tst-form-group">
                    <div className="tst-label-flex">
                      <label className="tst-label" htmlFor="password">Password</label>
                      {authMode === "signin" && (
                        <button
                          type="button"
                          className="tst-link-btn"
                          onClick={() => showToast("Password reset link sent to " + email)}
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="tst-password-wrapper">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        required
                        className="tst-input tst-input-pwd"
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="tst-pwd-toggle"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Remember me option */}
                  <div className="tst-options-row">
                    <label className="tst-checkbox-label">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="tst-checkbox"
                      />
                      <span>Keep me signed in for 30 days</span>
                    </label>
                  </div>

                  {/* Main Action Button (Styled identical to "Get a Call Back ->") */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="tst-btn-amber-lg"
                  >
                    {isSubmitting ? (
                      <span className="tst-btn-spinner-text">Authenticating...</span>
                    ) : (
                      <>
                        {authMode === "signin"
                          ? `Sign In to ${DEMO_ROLES.find((r) => r.role === selectedRole)?.label} Workspace →`
                          : "Get a Call Back →"}
                      </>
                    )}
                  </button>

                  {/* WhatsApp Quick OTP Option */}
                  <div className="tst-divider">
                    <span>or continue via</span>
                  </div>

                  <a
                    href="https://wa.me/918485846806?text=Hi%20TechSummitTrainers,%20I%20would%20like%20to%20access%20the%20portal."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tst-btn-whatsapp"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24M8.53 7.33c-.16 0-.42.06-.64.3-.22.25-.85.83-.85 2.02s.87 2.34.99 2.51c.13.16 1.7 2.6 4.13 3.65.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.47-.28-.25-.13-1.44-.71-1.66-.79-.22-.09-.39-.13-.55.13-.16.25-.64.79-.78.96-.15.16-.29.18-.54.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.15-.25-.02-.39.11-.51.11-.11.25-.29.38-.44.13-.15.17-.25.25-.42.09-.17.04-.31-.02-.44-.06-.13-.55-1.33-.76-1.82-.2-.48-.41-.41-.56-.42l-.48-.01z" />
                    </svg>
                    <span>Instant Login with WhatsApp</span>
                  </a>

                  {/* Direct Contact Footer Line */}
                  <div className="tst-card-footer">
                    <span>Or </span>
                    <a
                      href="https://wa.me/918485846806"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tst-link-bold"
                    >
                      WhatsApp us
                    </a>
                    <span> / </span>
                    <a href="tel:+918485846806" className="tst-link-bold">
                      call +91 84858 46806
                    </a>
                    <span> directly.</span>
                  </div>
                </form>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer minimal info */}
      <footer className="tst-footer">
        <div className="tst-container">
          <div className="tst-footer-flex">
            <div>© {new Date().getFullYear()} TechSummitTrainers. All rights reserved.</div>
            <div className="tst-footer-links">
              <Link href="/owner">Owner View</Link>
              <Link href="/counselor">Counselor View</Link>
              <Link href="/trainer">Trainer View</Link>
              <Link href="/student">Student View</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
