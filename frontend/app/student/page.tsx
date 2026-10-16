"use client";

import React, { useState } from "react";
import Link from "next/link";

interface AttendanceRecord {
  id: string;
  date: string;
  topic: string;
  trainer: string;
  status: "PRESENT" | "LATE" | "ABSENT";
  room: string;
}

interface Recording {
  id: string;
  title: string;
  trainer: string;
  date: string;
  duration: string;
  url: string;
  category: string;
}

interface Instalment {
  id: string;
  title: string;
  amount: number;
  dueDate: string;
  status: "PAID" | "UPCOMING" | "OVERDUE";
  receiptNo?: string;
}

export default function StudentDashboard() {
  const [activeTab, setActiveTab] = useState<"overview" | "timetable" | "attendance" | "recordings" | "fees">("overview");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals & Panels
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionDate, setCorrectionDate] = useState("2026-10-14");
  const [correctionReason, setCorrectionReason] = useState("");
  const [showQueryModal, setShowQueryModal] = useState(false);
  const [queryCategory, setQueryCategory] = useState("Fee & Payment");
  const [queryText, setQueryText] = useState("");
  const [showRecordingPlayer, setShowRecordingPlayer] = useState<Recording | null>(null);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [showActionDropdown, setShowActionDropdown] = useState(false);

  // Attendance Records
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([
    {
      id: "att-1",
      date: "Oct 16, 2026 (Today)",
      topic: "Zustand & Global Store Architecture",
      trainer: "Amit Kulkarni",
      status: "PRESENT",
      room: "Lab 101",
    },
    {
      id: "att-2",
      date: "Oct 15, 2026",
      topic: "Redux Toolkit Query & RTK Mutations",
      trainer: "Amit Kulkarni",
      status: "PRESENT",
      room: "Lab 101",
    },
    {
      id: "att-3",
      date: "Oct 14, 2026",
      topic: "React 19 Server Components & Actions",
      trainer: "Amit Kulkarni",
      status: "LATE",
      room: "Lab 101",
    },
    {
      id: "att-4",
      date: "Oct 13, 2026",
      topic: "Tailwind & Headless UI Components",
      trainer: "Amit Kulkarni",
      status: "PRESENT",
      room: "Lab 101",
    },
    {
      id: "att-5",
      date: "Oct 12, 2026",
      topic: "TypeScript Generics & Utility Types",
      trainer: "Amit Kulkarni",
      status: "PRESENT",
      room: "Lab 101",
    },
  ]);

  // Recordings Library
  const [recordings] = useState<Recording[]>([
    {
      id: "rec-1",
      title: "State Management with Zustand & Redux Toolkit",
      trainer: "Amit Kulkarni",
      date: "Oct 15, 2026",
      duration: "1h 52m",
      url: "https://portal.techsummittrainers.com/recordings/fs09-zustand",
      category: "Frontend React",
    },
    {
      id: "rec-2",
      title: "Express Middleware Architecture & JWT Authentication",
      trainer: "Amit Kulkarni",
      date: "Oct 14, 2026",
      duration: "1h 45m",
      url: "https://portal.techsummittrainers.com/recordings/fs09-jwt-auth",
      category: "Backend Node",
    },
    {
      id: "rec-3",
      title: "MongoDB Aggregation Pipelines & Mongoose Schemas",
      trainer: "Neha Rao",
      date: "Oct 11, 2026",
      duration: "2h 10m",
      url: "https://portal.techsummittrainers.com/recordings/fs09-mongodb",
      category: "Database",
    },
  ]);

  // Fee Instalments
  const [instalments] = useState<Instalment[]>([
    {
      id: "fee-1",
      title: "Admission & 1st Instalment (Enrolment)",
      amount: 25000,
      dueDate: "Aug 15, 2026",
      status: "PAID",
      receiptNo: "REC-2026-0812",
    },
    {
      id: "fee-2",
      title: "2nd Instalment (Mid-Term Core React)",
      amount: 25000,
      dueDate: "Oct 15, 2026",
      status: "PAID",
      receiptNo: "REC-2026-1049",
    },
    {
      id: "fee-3",
      title: "3rd Instalment (Full Stack Cloud & DevOps)",
      amount: 15000,
      dueDate: "Nov 15, 2026",
      status: "UPCOMING",
    },
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleCorrectionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowCorrectionModal(false);
    setCorrectionReason("");
    showToast("Attendance correction request submitted to Counselor & Faculty!");
  };

  const handleQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowQueryModal(false);
    setQueryText("");
    showToast("Your query has been routed to Counselor Pooja Patil!");
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

      {/* Top Header Navigation */}
      <header className="tst-nav">
        <div className="tst-nav-container" style={{ maxWidth: "100%", width: "100%", padding: "0 28px" }}>
          {/* Logo on far-left side */}
          <div className="tst-brand-wrap">
            <Link href="/" className="tst-brand-link">
              <div className="tst-logo-badge">
                <svg viewBox="0 0 24 24" className="tst-mountain-icon" fill="currentColor">
                  <path d="M12 6L4.5 19h15L12 6zm-1.2 5.5l2.4 4.1h-4.8l2.4-4.1z" />
                </svg>
              </div>
              <div className="tst-topbar-context">
                <span className="tst-brand-title">TechSummitTrainers</span>
                <span className="tst-context-tag" style={{ borderLeftColor: "#3b82f6" }}>Student Portal</span>
              </div>
            </Link>
          </div>

          {/* Right Header: Notification Bell + SJ Avatar */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <button
              type="button"
              onClick={() => setShowNotificationPanel(!showNotificationPanel)}
              className="tst-icon-circle"
              style={{
                position: "relative",
                background: showNotificationPanel ? "#fffbeb" : "#ffffff",
                borderColor: showNotificationPanel ? "#f59e0b" : "#e5e7eb",
                cursor: "pointer",
                width: "36px",
                height: "36px",
                color: showNotificationPanel ? "#d97706" : "#111827",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: showNotificationPanel ? "0 0 0 2px rgba(245, 158, 11, 0.25)" : "none",
                transition: "all 0.2s ease",
              }}
              title="Student Notifications"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span
                style={{
                  position: "absolute",
                  top: "-2px",
                  right: "-2px",
                  width: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  background: "#f59e0b",
                  color: "#111827",
                  fontSize: "10.5px",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid #ffffff",
                }}
              >
                1
              </span>
            </button>

            {/* SJ Avatar badge on far-right */}
            <div
              className="tst-avatar-badge"
              style={{
                width: "36px",
                height: "36px",
                fontSize: "13px",
                fontWeight: 800,
                background: "#3b82f6",
                color: "#ffffff",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)",
              }}
              title="Sneha Joshi (Batch FS-09 • Full Stack)"
            >
              SJ
            </div>
          </div>
        </div>
      </header>

      {/* Windows 11 Style Notification Panel Backdrop */}
      {showNotificationPanel && (
        <div className="tst-win-panel-backdrop" onClick={() => setShowNotificationPanel(false)} />
      )}

      {/* Windows 11 Style Notification Panel */}
      <aside className={`tst-win-notification-panel ${showNotificationPanel ? "open" : "closed"}`}>
        <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(229, 231, 235, 0.8)", background: "rgba(255, 255, 255, 0.8)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "15px", fontWeight: 800, color: "#111827" }}>Learning Notifications</span>
            <span style={{ background: "#ecfdf5", color: "#047857", fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "9999px" }}>
              1 Announcement
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowNotificationPanel(false)}
            style={{ background: "transparent", border: "none", color: "#6b7280", fontSize: "16px", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Card 1: WIDGET 8: Announcements & Reminders */}
          <div style={{ background: "#ffffff", border: "1px solid #fed7aa", borderLeft: "4px solid #f59e0b", borderRadius: "14px", padding: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>
              <span style={{ fontWeight: 800, color: "#92400e" }}>📢 Institute Hackathon Announcement</span>
              <span>Today</span>
            </div>
            <div style={{ fontWeight: 800, fontSize: "13px", color: "#111827", marginBottom: "4px" }}>
              Annual Pune Full-Stack Sprint 2026
            </div>
            <div style={{ fontSize: "12px", color: "#4b5563", lineHeight: 1.4, marginBottom: "8px" }}>
              Registration opens Saturday. Top 3 teams win direct industry interviews with TechSummit hiring partners.
            </div>
            <button
              type="button"
              className="tst-btn-action primary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => showToast("Registered for Hackathon details!")}
            >
              View Hackathon Guidelines →
            </button>
          </div>

          {/* Calendar Widget */}
          <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "14px", padding: "14px" }}>
            <div style={{ fontWeight: 800, fontSize: "13.5px", color: "#111827", marginBottom: "4px" }}>Friday, 16 October 2026</div>
            <div style={{ fontSize: "12px", color: "#6b7280" }}>Next Class: Monday @ 09:30 AM (Lab 101)</div>
          </div>
        </div>
      </aside>

      {/* 5-Item Non-Scrollable Subnav Bar */}
      <nav className="tst-subnav-bar">
        <div className="tst-subnav-container" style={{ maxWidth: "100%", width: "100%", padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="tst-tab-list" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* 1. My Learning Desk */}
            <button
              type="button"
              className={`tst-nav-tab ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              <span>My Learning Desk</span>
            </button>

            {/* 2. My Timetable */}
            <button
              type="button"
              className={`tst-nav-tab ${activeTab === "timetable" ? "active" : ""}`}
              onClick={() => setActiveTab("timetable")}
            >
              <span>My Timetable</span>
            </button>

            {/* 3. Attendance Records */}
            <button
              type="button"
              className={`tst-nav-tab ${activeTab === "attendance" ? "active" : ""}`}
              onClick={() => setActiveTab("attendance")}
            >
              <span>Attendance Records</span>
              <span className="tst-pill success" style={{ fontSize: "11px", padding: "1px 6px", marginLeft: "4px" }}>91.4%</span>
            </button>

            {/* 4. Recordings & Syllabus */}
            <button
              type="button"
              className={`tst-nav-tab ${activeTab === "recordings" ? "active" : ""}`}
              onClick={() => setActiveTab("recordings")}
            >
              <span>Recordings &amp; Notes</span>
              <span className="tst-tab-counter" style={{ marginLeft: "4px" }}>{recordings.length} Videos</span>
            </button>

            {/* 5. Fees & Receipts */}
            <button
              type="button"
              className={`tst-nav-tab ${activeTab === "fees" ? "active" : ""}`}
              onClick={() => setActiveTab("fees")}
            >
              <span>Fees &amp; Receipts</span>
            </button>
          </div>

          {/* Quick Actions Dropdown */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className="tst-btn-action primary"
              onClick={() => setShowActionDropdown(!showActionDropdown)}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 18px", fontWeight: 800, borderRadius: "10px" }}
            >
              <span>+ Student Actions</span>
              <span style={{ fontSize: "11px", transform: showActionDropdown ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
            </button>

            {showActionDropdown && (
              <div
                className="animate-slide-down"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 8px)",
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "14px",
                  boxShadow: "0 15px 35px -5px rgba(0, 0, 0, 0.15)",
                  padding: "8px",
                  minWidth: "250px",
                  zIndex: 50,
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowActionDropdown(false);
                    setShowCorrectionModal(true);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "9px 12px", background: "transparent", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fffbeb")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span>📝</span>
                  <div>
                    <div>Request Attendance Correction</div>
                    <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 500 }}>Dispute missed check-in</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowActionDropdown(false);
                    setShowCertificateModal(true);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "9px 12px", background: "transparent", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fffbeb")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span>📜</span>
                  <div>
                    <div>Download Course Certificates</div>
                    <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 500 }}>Module 1 Completion</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowActionDropdown(false);
                    setShowQueryModal(true);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "9px 12px", background: "transparent", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fffbeb")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span>💬</span>
                  <div>
                    <div>Raise Fee / Schedule Query</div>
                    <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 500 }}>Contact counselor Pooja</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Role Restriction Notice */}
      <div style={{ background: "#eff6ff", borderBottom: "1px solid #bfdbfe", padding: "8px 28px", fontSize: "12px", color: "#1e40af", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span>🛡️</span>
          <span><strong>Student Scope Active:</strong> Personalized portal for Sneha Joshi (Batch FS-09). You have access only to your enrolled courses, personal attendance, fee receipts, and certificates. Institute management &amp; peer private records are restricted.</span>
        </div>
        <span style={{ fontWeight: 700, color: "#1d4ed8" }}>Student ID: TST-2026-089</span>
      </div>

      {/* Main Workspace Body */}
      <main style={{ maxWidth: "100%", width: "100%", padding: "24px 28px", flex: 1 }}>
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* WIDGET 1: Next Class (Hero Banner with Join Online Session Button) */}
            <div
              style={{
                background: "linear-gradient(135deg, #111827 0%, #1f2937 100%)",
                borderRadius: "18px",
                padding: "24px 28px",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.2)",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <span style={{ background: "#f59e0b", color: "#111827", fontSize: "11px", fontWeight: 800, padding: "2px 8px", borderRadius: "9999px" }}>
                    NEXT UPCOMING CLASS
                  </span>
                  <span style={{ color: "#9ca3af", fontSize: "12px" }}>Monday, Oct 19 • 09:30 AM – 11:30 AM</span>
                </div>
                <h2 style={{ fontSize: "22px", fontWeight: 800, margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>
                  Full Stack Next.js Architecture &amp; Database Migrations
                </h2>
                <div style={{ fontSize: "13.5px", color: "#d1d5db" }}>
                  Batch FS-09 • Faculty: <strong>Amit Kulkarni</strong> • <strong>Lab 101 (Deccan Campus)</strong>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <a
                  href="https://zoom.us/j/test-session"
                  target="_blank"
                  rel="noreferrer"
                  className="tst-btn-action primary"
                  style={{
                    padding: "12px 22px",
                    fontSize: "14px",
                    fontWeight: 800,
                    textDecoration: "none",
                    boxShadow: "0 4px 14px rgba(245, 158, 11, 0.4)",
                  }}
                >
                  Join Online Session 💻
                </a>
              </div>
            </div>

            {/* Top 4 KPI Metric Cards (Widgets 3, 5, 6, 7) */}
            <div className="tst-metrics-grid">
              {/* WIDGET 3: Attendance Percentage */}
              <div className="tst-metric-card">
                <div className="tst-metric-header">
                  <span className="tst-metric-label">My Attendance</span>
                  <div className="tst-metric-icon">📈</div>
                </div>
                <div className="tst-metric-value" style={{ color: "#047857" }}>91.4%</div>
                <div className="tst-metric-footer">
                  <span className="tst-pill success">Good Standing</span>
                  <span style={{ fontSize: "12px", color: "#6b7280" }}>Threshold: &gt;75%</span>
                </div>
              </div>

              {/* WIDGET 6: Course Progress */}
              <div className="tst-metric-card">
                <div className="tst-metric-header">
                  <span className="tst-metric-label">Course Progress</span>
                  <div className="tst-metric-icon">🎯</div>
                </div>
                <div className="tst-metric-value">74%</div>
                <div className="tst-metric-footer">
                  <span className="tst-badge-counter">4 / 6 Modules Done</span>
                </div>
              </div>

              {/* WIDGET 5: Upcoming Instalments */}
              <div className="tst-metric-card">
                <div className="tst-metric-header">
                  <span className="tst-metric-label">Next Instalment</span>
                  <div className="tst-metric-icon">💳</div>
                </div>
                <div className="tst-metric-value">₹15,000</div>
                <div className="tst-metric-footer">
                  <span style={{ fontSize: "12px", color: "#6b7280" }}>Due Nov 15, 2026</span>
                  <span className="tst-pill success">₹50,000 Paid</span>
                </div>
              </div>

              {/* WIDGET 9: Certificates Available */}
              <div className="tst-metric-card">
                <div className="tst-metric-header">
                  <span className="tst-metric-label">Certifications</span>
                  <div className="tst-metric-icon">📜</div>
                </div>
                <div className="tst-metric-value">1 Verified</div>
                <div className="tst-metric-footer">
                  <button
                    type="button"
                    onClick={() => setShowCertificateModal(true)}
                    style={{ background: "none", border: "none", color: "#d97706", fontWeight: 800, cursor: "pointer", padding: 0 }}
                  >
                    View Certificate →
                  </button>
                </div>
              </div>
            </div>

            {/* Split Dashboard: Recent Attendance (Widget 4) & Available Recordings (Widget 7) */}
            <div className="tst-dashboard-grid">
              {/* Left Column: Recent Attendance History (Widget 4) */}
              <div className="tst-col-stack">
                <div className="tst-card-panel">
                  <div className="tst-panel-header">
                    <div className="tst-panel-title-group">
                      <h2 className="tst-panel-title">Recent Attendance &amp; Check-ins</h2>
                      <span className="tst-pill success">Verified Logs</span>
                    </div>
                    <button
                      type="button"
                      className="tst-btn-action"
                      style={{ padding: "4px 10px", fontSize: "11.5px" }}
                      onClick={() => setShowCorrectionModal(true)}
                    >
                      Request Correction
                    </button>
                  </div>

                  <div className="tst-table-wrapper">
                    <table className="tst-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Topic / Lab Session</th>
                          <th>Faculty</th>
                          <th>Status</th>
                          <th>Location</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceRecords.map((att) => (
                          <tr key={att.id}>
                            <td><strong>{att.date}</strong></td>
                            <td>{att.topic}</td>
                            <td>{att.trainer}</td>
                            <td>
                              <span
                                className={`tst-pill ${
                                  att.status === "PRESENT"
                                    ? "success"
                                    : att.status === "LATE"
                                    ? "alert"
                                    : "danger"
                                }`}
                              >
                                {att.status}
                              </span>
                            </td>
                            <td>{att.room}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right Column: Available Recordings (Widget 7) & Curriculum Milestones */}
              <div className="tst-col-stack">
                <div className="tst-card-panel">
                  <div className="tst-panel-header">
                    <div className="tst-panel-title-group">
                      <h2 className="tst-panel-title">Latest Class Recordings</h2>
                      <span className="tst-tab-counter">{recordings.length} Available</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {recordings.map((rec) => (
                      <div
                        key={rec.id}
                        style={{
                          background: "#ffffff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "12px",
                          padding: "12px 14px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          transition: "border-color 0.2s",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "13px", color: "#111827" }}>{rec.title}</div>
                          <div style={{ fontSize: "11.5px", color: "#6b7280" }}>
                            {rec.trainer} • {rec.date} • {rec.duration}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="tst-btn-action primary"
                          style={{ padding: "5px 12px", fontSize: "11.5px" }}
                          onClick={() => setShowRecordingPlayer(rec)}
                        >
                          Watch ▶
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Course Syllabus Track */}
                <div className="tst-card-panel">
                  <div className="tst-panel-header">
                    <div className="tst-panel-title-group">
                      <h2 className="tst-panel-title">Full Stack Curriculum Progress</h2>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", fontWeight: 700, marginBottom: "4px" }}>
                        <span>Module 1: Modern JavaScript &amp; TypeScript</span>
                        <span style={{ color: "#047857" }}>✓ 100% Completed</span>
                      </div>
                      <div style={{ width: "100%", height: "6px", background: "#f3f4f6", borderRadius: "9999px" }}>
                        <div style={{ width: "100%", height: "100%", background: "#10b981", borderRadius: "9999px" }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", fontWeight: 700, marginBottom: "4px" }}>
                        <span>Module 2: React 19, Hooks &amp; Next.js</span>
                        <span style={{ color: "#047857" }}>✓ 100% Completed</span>
                      </div>
                      <div style={{ width: "100%", height: "6px", background: "#f3f4f6", borderRadius: "9999px" }}>
                        <div style={{ width: "100%", height: "100%", background: "#10b981", borderRadius: "9999px" }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", fontWeight: 700, marginBottom: "4px" }}>
                        <span>Module 3: Node.js, Express &amp; Microservices</span>
                        <span style={{ color: "#d97706" }}>⚡ 60% In Progress</span>
                      </div>
                      <div style={{ width: "100%", height: "6px", background: "#f3f4f6", borderRadius: "9999px" }}>
                        <div style={{ width: "60%", height: "100%", background: "#f59e0b", borderRadius: "9999px" }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", fontWeight: 700, marginBottom: "4px" }}>
                        <span>Module 4: AWS Cloud Deployment &amp; Docker</span>
                        <span style={{ color: "#6b7280" }}>Upcoming (Nov 2026)</span>
                      </div>
                      <div style={{ width: "100%", height: "6px", background: "#f3f4f6", borderRadius: "9999px" }}>
                        <div style={{ width: "0%", height: "100%", background: "#d1d5db", borderRadius: "9999px" }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Timetable (Widget 2) */}
        {activeTab === "timetable" && (
          <div className="tst-card-panel">
            <div className="tst-panel-header">
              <div className="tst-panel-title-group">
                <h2 className="tst-panel-title">My Weekly Class Schedule (Batch FS-09)</h2>
                <span className="tst-pill success">Current Term</span>
              </div>
            </div>

            <div className="tst-timetable-grid">
              <div className="tst-time-col-header">Time / Day</div>
              <div className="tst-time-col-header">Monday</div>
              <div className="tst-time-col-header">Tuesday</div>
              <div className="tst-time-col-header">Wednesday</div>
              <div className="tst-time-col-header">Thursday</div>
              <div className="tst-time-col-header">Friday (Today)</div>

              <div className="tst-time-col-header" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>09:30 AM – 11:30 AM</div>
              <div className="tst-time-slot active-class"><strong>Lab 101</strong><div className="tst-cell-sub">React Server Components</div></div>
              <div className="tst-time-slot active-class"><strong>Lab 101</strong><div className="tst-cell-sub">Zustand Global Store</div></div>
              <div className="tst-time-slot active-class"><strong>Lab 101</strong><div className="tst-cell-sub">RTK Query APIs</div></div>
              <div className="tst-time-slot active-class"><strong>Lab 101</strong><div className="tst-cell-sub">Next.js SSR vs ISR</div></div>
              <div className="tst-time-slot active-class" style={{ borderLeftColor: "#10b981", background: "#f0fdf4" }}><strong>Lab 101</strong><div className="tst-cell-sub">State Architecture (Done)</div></div>
            </div>
          </div>
        )}

        {/* Tab 3: Attendance */}
        {activeTab === "attendance" && (
          <div className="tst-card-panel">
            <div className="tst-panel-header">
              <div className="tst-panel-title-group">
                <h2 className="tst-panel-title">My Complete Attendance History</h2>
                <span className="tst-pill success">91.4% Overall (Good Standing)</span>
              </div>
              <button
                type="button"
                className="tst-btn-action primary"
                onClick={() => setShowCorrectionModal(true)}
              >
                + Request Attendance Correction
              </button>
            </div>

            <div className="tst-table-wrapper">
              <table className="tst-table">
                <thead>
                  <tr>
                    <th>Session Date</th>
                    <th>Course Topic</th>
                    <th>Trainer</th>
                    <th>Attendance Status</th>
                    <th>Classroom</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceRecords.map((att) => (
                    <tr key={att.id}>
                      <td><strong>{att.date}</strong></td>
                      <td>{att.topic}</td>
                      <td>{att.trainer}</td>
                      <td>
                        <span className={`tst-pill ${att.status === "PRESENT" ? "success" : att.status === "LATE" ? "alert" : "danger"}`}>
                          {att.status}
                        </span>
                      </td>
                      <td>{att.room}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Recordings */}
        {activeTab === "recordings" && (
          <div className="tst-card-panel">
            <div className="tst-panel-header">
              <div className="tst-panel-title-group">
                <h2 className="tst-panel-title">My Enrolled Course Recordings Library</h2>
                <span className="tst-pill success">Batch FS-09</span>
              </div>
            </div>

            <div className="tst-table-wrapper">
              <table className="tst-table">
                <thead>
                  <tr>
                    <th>Session Title</th>
                    <th>Module Category</th>
                    <th>Trainer</th>
                    <th>Date Recorded</th>
                    <th>Duration</th>
                    <th>Watch Video</th>
                  </tr>
                </thead>
                <tbody>
                  {recordings.map((rec) => (
                    <tr key={rec.id}>
                      <td><strong>{rec.title}</strong></td>
                      <td><span className="tst-badge-counter">{rec.category}</span></td>
                      <td>{rec.trainer}</td>
                      <td>{rec.date}</td>
                      <td>{rec.duration}</td>
                      <td>
                        <button
                          type="button"
                          className="tst-btn-action primary"
                          style={{ padding: "4px 10px", fontSize: "11px" }}
                          onClick={() => setShowRecordingPlayer(rec)}
                        >
                          Play Recording ▶
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 5: Fees & Receipts */}
        {activeTab === "fees" && (
          <div className="tst-card-panel">
            <div className="tst-panel-header">
              <div className="tst-panel-title-group">
                <h2 className="tst-panel-title">My Fee Plan, EMIs &amp; Payment Receipts</h2>
                <span className="tst-pill success">Total Course Fee: ₹65,000</span>
              </div>
              <button
                type="button"
                className="tst-btn-action"
                onClick={() => setShowQueryModal(true)}
              >
                Raise Fee Query
              </button>
            </div>

            <div className="tst-table-wrapper">
              <table className="tst-table">
                <thead>
                  <tr>
                    <th>Instalment Name</th>
                    <th>Due Date</th>
                    <th>Amount</th>
                    <th>Payment Status</th>
                    <th>Receipt Reference</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {instalments.map((inst) => (
                    <tr key={inst.id}>
                      <td><strong>{inst.title}</strong></td>
                      <td>{inst.dueDate}</td>
                      <td><strong>₹{inst.amount.toLocaleString("en-IN")}</strong></td>
                      <td>
                        <span className={`tst-pill ${inst.status === "PAID" ? "success" : "alert"}`}>
                          {inst.status}
                        </span>
                      </td>
                      <td>{inst.receiptNo || "—"}</td>
                      <td>
                        {inst.receiptNo ? (
                          <button
                            type="button"
                            className="tst-btn-action"
                            style={{ padding: "4px 8px", fontSize: "11px" }}
                            onClick={() => showToast(`Receipt ${inst.receiptNo} downloaded as PDF!`)}
                          >
                            Download Receipt 📥
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="tst-btn-action primary"
                            style={{ padding: "4px 8px", fontSize: "11px" }}
                            onClick={() => showToast("Opening payment gateway...")}
                          >
                            Pay Online 💳
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: Request Attendance Correction */}
      {showCorrectionModal && (
        <div className="tst-modal-backdrop" onClick={() => setShowCorrectionModal(false)}>
          <div className="tst-modal-card" style={{ maxWidth: "500px" }} onClick={(e) => e.stopPropagation()}>
            <div className="tst-modal-header">
              <h3 className="tst-modal-title">Request Attendance Correction</h3>
              <button type="button" className="tst-modal-close" onClick={() => setShowCorrectionModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCorrectionSubmit}>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", margin: "16px 0" }}>
                <div>
                  <label className="tst-form-label">Session Date</label>
                  <input
                    type="date"
                    required
                    value={correctionDate}
                    onChange={(e) => setCorrectionDate(e.target.value)}
                    className="tst-form-input"
                  />
                </div>

                <div>
                  <label className="tst-form-label">Reason / Justification</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="e.g. Attended session in Lab 101, but biometric check-in failed to record."
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    className="tst-form-input"
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" className="tst-btn-action" onClick={() => setShowCorrectionModal(false)}>Cancel</button>
                <button type="submit" className="tst-btn-action primary">Submit Dispute</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Raise Fee / Schedule Query */}
      {showQueryModal && (
        <div className="tst-modal-backdrop" onClick={() => setShowQueryModal(false)}>
          <div className="tst-modal-card" style={{ maxWidth: "500px" }} onClick={(e) => e.stopPropagation()}>
            <div className="tst-modal-header">
              <h3 className="tst-modal-title">Ask Counselor / Academic Help</h3>
              <button type="button" className="tst-modal-close" onClick={() => setShowQueryModal(false)}>✕</button>
            </div>

            <form onSubmit={handleQuerySubmit}>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", margin: "16px 0" }}>
                <div>
                  <label className="tst-form-label">Query Category</label>
                  <select value={queryCategory} onChange={(e) => setQueryCategory(e.target.value)} className="tst-form-select">
                    <option value="Fee & Payment">Fee &amp; Payment Receipt Query</option>
                    <option value="Schedule & Lab">Batch Timetable &amp; Lab Reschedule</option>
                    <option value="Placement & Project">Placement Assistance &amp; Projects</option>
                  </select>
                </div>

                <div>
                  <label className="tst-form-label">Your Message</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Enter your question for the counseling & accounts desk..."
                    value={queryText}
                    onChange={(e) => setQueryText(e.target.value)}
                    className="tst-form-input"
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" className="tst-btn-action" onClick={() => setShowQueryModal(false)}>Cancel</button>
                <button type="submit" className="tst-btn-action primary">Send Message</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Watch Recording Player */}
      {showRecordingPlayer && (
        <div className="tst-modal-backdrop" onClick={() => setShowRecordingPlayer(null)}>
          <div className="tst-modal-card" style={{ maxWidth: "700px" }} onClick={(e) => e.stopPropagation()}>
            <div className="tst-modal-header">
              <div>
                <h3 className="tst-modal-title">{showRecordingPlayer.title}</h3>
                <div style={{ fontSize: "12px", color: "#6b7280" }}>
                  {showRecordingPlayer.trainer} • {showRecordingPlayer.date} • {showRecordingPlayer.duration}
                </div>
              </div>
              <button type="button" className="tst-modal-close" onClick={() => setShowRecordingPlayer(null)}>✕</button>
            </div>

            {/* Video Player Mockup */}
            <div
              style={{
                background: "#000000",
                borderRadius: "12px",
                height: "340px",
                margin: "16px 0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  background: "rgba(245, 158, 11, 0.9)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#111827",
                  boxShadow: "0 0 20px rgba(245, 158, 11, 0.5)",
                }}
              >
                ▶
              </div>
              <span style={{ marginTop: "12px", fontSize: "13px", color: "#9ca3af" }}>
                High Definition 1080p Stream • TechSummit Video Server
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", color: "#6b7280" }}>Streaming URL: {showRecordingPlayer.url}</span>
              <button type="button" className="tst-btn-action" onClick={() => setShowRecordingPlayer(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Certificate View */}
      {showCertificateModal && (
        <div className="tst-modal-backdrop" onClick={() => setShowCertificateModal(false)}>
          <div className="tst-modal-card" style={{ maxWidth: "620px" }} onClick={(e) => e.stopPropagation()}>
            <div className="tst-modal-header">
              <h3 className="tst-modal-title">Certificate of Completion</h3>
              <button type="button" className="tst-modal-close" onClick={() => setShowCertificateModal(false)}>✕</button>
            </div>

            <div
              style={{
                background: "#ffffff",
                border: "4px double #d97706",
                borderRadius: "12px",
                padding: "24px",
                textAlign: "center",
                margin: "16px 0",
              }}
            >
              <div style={{ fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b7280", fontWeight: 800 }}>
                TECHSUMMITTRAINERS INSTITUTE OF ADVANCED COMPUTING
              </div>
              <h4 style={{ fontSize: "20px", fontWeight: 800, margin: "12px 0 6px 0", color: "#111827" }}>
                Certificate of Academic Excellence
              </h4>
              <p style={{ fontSize: "13.5px", color: "#4b5563" }}>
                This is proudly presented to
              </p>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "#d97706", margin: "6px 0" }}>
                Sneha Joshi
              </div>
              <p style={{ fontSize: "13px", color: "#4b5563", maxWidth: "460px", margin: "0 auto 14px auto" }}>
                for successfully completing <strong>Module 1: React 19 &amp; Full Stack Architecture</strong> with distinction (94% score) under faculty mentor Amit Kulkarni.
              </p>
              <div style={{ display: "flex", justifyContent: "space-around", borderTop: "1px solid #e5e7eb", paddingTop: "12px", fontSize: "11.5px", color: "#6b7280" }}>
                <div><strong>Rajesh Sharma</strong><br />Institute Director</div>
                <div><strong>Amit Kulkarni</strong><br />Lead Faculty</div>
                <div><strong>Oct 10, 2026</strong><br />Issue Date</div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                className="tst-btn-action primary"
                onClick={() => {
                  showToast("Certificate downloaded in PDF format!");
                  setShowCertificateModal(false);
                }}
              >
                Download PDF Certificate 📥
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
