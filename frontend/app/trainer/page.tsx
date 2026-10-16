"use client";

import React, { useState } from "react";
import Link from "next/link";

interface AssignedClass {
  id: string;
  batch: string;
  course: string;
  time: string;
  room: string;
  studentsCount: number;
  attendanceMarked: boolean;
  status: "UPCOMING" | "IN_PROGRESS" | "COMPLETED";
}

interface StudentRisk {
  id: string;
  name: string;
  batch: string;
  attendance: number;
  missedClasses: number;
  riskReason: string;
  lastActive: string;
}

interface Recording {
  id: string;
  batch: string;
  topic: string;
  date: string;
  duration: string;
  views: number;
  url: string;
}

interface SubstituteRequest {
  id: string;
  batch: string;
  date: string;
  time: string;
  reason: string;
  substitute: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

export default function TrainerDashboard() {
  const [activeTab, setActiveTab] = useState<"overview" | "timetable" | "attendance" | "recordings" | "students">("overview");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals & Panels
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedBatchForAttendance, setSelectedBatchForAttendance] = useState("Batch FS-09");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSubstituteModal, setShowSubstituteModal] = useState(false);
  const [showCopilotDrawer, setShowCopilotDrawer] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [showActionDropdown, setShowActionDropdown] = useState(false);

  // Form states for Upload Recording
  const [recBatch, setRecBatch] = useState("Batch FS-09");
  const [recTopic, setRecTopic] = useState("");
  const [recUrl, setRecUrl] = useState("");

  // Form state for Substitute Request
  const [subBatch, setSubBatch] = useState("Batch FS-11");
  const [subDate, setSubDate] = useState("2026-10-20");
  const [subReason, setSubReason] = useState("");
  const [subFaculty, setSubFaculty] = useState("Neha Rao (AI & Cloud)");

  // State: Classes for today
  const [todayClasses, setTodayClasses] = useState<AssignedClass[]>([
    {
      id: "cls-1",
      batch: "Batch FS-09",
      course: "Full Stack React & Node Masterclass",
      time: "09:30 AM – 11:30 AM",
      room: "Lab 101 (Main Building)",
      studentsCount: 28,
      attendanceMarked: false,
      status: "COMPLETED",
    },
    {
      id: "cls-2",
      batch: "Batch FS-11",
      course: "Advanced Node.js & Microservices",
      time: "04:00 PM – 06:00 PM",
      room: "Lab 204 (Deccan Campus)",
      studentsCount: 24,
      attendanceMarked: false,
      status: "UPCOMING",
    },
    {
      id: "cls-3",
      batch: "Batch CLOUD-02",
      course: "AWS DevOps & Docker Containers",
      time: "07:00 PM – 08:30 PM",
      room: "Online Live (Zoom / Portal)",
      studentsCount: 32,
      attendanceMarked: false,
      status: "UPCOMING",
    },
  ]);

  // Students attendance list for the modal
  const [attendanceList, setAttendanceList] = useState([
    { id: "s-1", name: "Sneha Joshi", status: "PRESENT", score: "94%" },
    { id: "s-2", name: "Rahul Verma", status: "ABSENT", score: "68%" },
    { id: "s-3", name: "Priya Nair", status: "ABSENT", score: "71%" },
    { id: "s-4", name: "Ananya Sen", status: "PRESENT", score: "96%" },
    { id: "s-5", name: "Rohan Joshi", status: "LATE", score: "72%" },
    { id: "s-6", name: "Kunal Sharma", status: "PRESENT", score: "89%" },
    { id: "s-7", name: "Tanvi Deshmukh", status: "PRESENT", score: "92%" },
  ]);

  // Students falling behind in assigned batches
  const [riskStudents, setRiskStudents] = useState<StudentRisk[]>([
    {
      id: "st-1",
      name: "Rahul Verma",
      batch: "Batch FS-09",
      attendance: 68.2,
      missedClasses: 4,
      riskReason: "Missed 3 consecutive React labs; incomplete assignment 4",
      lastActive: "4 days ago",
    },
    {
      id: "st-2",
      name: "Priya Nair",
      batch: "Batch FS-09",
      attendance: 71.0,
      missedClasses: 3,
      riskReason: "Low lab engagement; requested 1-on-1 mentor guidance",
      lastActive: "Yesterday",
    },
    {
      id: "st-3",
      name: "Rohan Joshi",
      batch: "Batch CLOUD-02",
      attendance: 72.5,
      missedClasses: 3,
      riskReason: "Docker container deployment evaluation pending submission",
      lastActive: "2 days ago",
    },
  ]);

  // Recently uploaded recordings
  const [recordings, setRecordings] = useState<Recording[]>([
    {
      id: "rec-1",
      batch: "Batch FS-09",
      topic: "State Management with Zustand & Redux Toolkit",
      date: "Oct 15, 2026",
      duration: "1h 52m",
      views: 24,
      url: "https://portal.techsummittrainers.com/recordings/fs09-zustand",
    },
    {
      id: "rec-2",
      batch: "Batch FS-11",
      topic: "Express Middleware Architecture & JWT Authentication",
      date: "Oct 14, 2026",
      duration: "1h 45m",
      views: 22,
      url: "https://portal.techsummittrainers.com/recordings/fs11-jwt-auth",
    },
    {
      id: "rec-3",
      batch: "Batch CLOUD-02",
      topic: "Docker Multi-stage Builds & Kubernetes Manifests",
      date: "Oct 13, 2026",
      duration: "2h 05m",
      views: 31,
      url: "https://portal.techsummittrainers.com/recordings/cloud02-docker-k8s",
    },
  ]);

  // Substitute requests
  const [substituteRequests, setSubstituteRequests] = useState<SubstituteRequest[]>([
    {
      id: "sub-1",
      batch: "Batch FS-11",
      date: "Oct 24, 2026",
      time: "04:00 PM – 06:00 PM",
      reason: "Attending AWS Community Day Pune keynote presentation",
      substitute: "Neha Rao",
      status: "APPROVED",
    },
  ]);

  // Copilot messages & query state
  const [copilotInput, setCopilotInput] = useState("");
  const [copilotMessages, setCopilotMessages] = useState<Array<{ sender: "user" | "copilot"; text: string; rbacWarning?: boolean }>>([
    {
      sender: "copilot",
      text: "Hello Amit! I am your Faculty OpsCopilot. I can analyze attendance, students falling behind, session plans, and timetable adjustments for your assigned batches (FS-09, FS-11, CLOUD-02). How can I assist your teaching today?",
    },
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Mark attendance handler
  const handleSaveAttendance = () => {
    setTodayClasses((prev) =>
      prev.map((c) =>
        c.batch === selectedBatchForAttendance ? { ...c, attendanceMarked: true } : c
      )
    );
    setShowAttendanceModal(false);
    showToast(`Attendance marked & synced for ${selectedBatchForAttendance}!`);
  };

  // Upload recording handler
  const handleUploadRecording = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recTopic.trim()) return;

    const newRec: Recording = {
      id: `rec-${Date.now()}`,
      batch: recBatch,
      topic: recTopic,
      date: "Today, Oct 16",
      duration: "1h 50m",
      views: 0,
      url: recUrl || "https://portal.techsummittrainers.com/recordings/new-session",
    };

    setRecordings([newRec, ...recordings]);
    setShowUploadModal(false);
    setRecTopic("");
    setRecUrl("");
    showToast(`Session recording uploaded for ${recBatch}!`);
  };

  // Submit substitute request
  const handleSubmitSubstitute = (e: React.FormEvent) => {
    e.preventDefault();
    const newReq: SubstituteRequest = {
      id: `sub-${Date.now()}`,
      batch: subBatch,
      date: subDate,
      time: "04:00 PM – 06:00 PM",
      reason: subReason || "Personal leave request",
      substitute: subFaculty,
      status: "PENDING",
    };
    setSubstituteRequests([newReq, ...substituteRequests]);
    setShowSubstituteModal(false);
    setSubReason("");
    showToast("Substitute request submitted for Academic Director review!");
  };

  // Copilot query handler with strict RBAC enforcement
  const handleSendCopilot = (questionText?: string) => {
    const q = questionText || copilotInput;
    if (!q.trim()) return;

    const userMsg = { sender: "user" as const, text: q };
    setCopilotMessages((prev) => [...prev, userMsg]);
    setCopilotInput("");

    // RBAC Check: If user asks for fee information
    const lower = q.toLowerCase();
    const isFeeQuery = lower.includes("fee") || lower.includes("payment") || lower.includes("emi") || lower.includes("paid") || lower.includes("balance");

    setTimeout(() => {
      if (isFeeQuery) {
        setCopilotMessages((prev) => [
          ...prev,
          {
            sender: "copilot",
            text: "Fee information is not available to the trainer role. I can show attendance-risk students from your assigned batches instead.",
            rbacWarning: true,
          },
        ]);
      } else if (lower.includes("java") || lower.includes("missed") || lower.includes("three classes") || lower.includes("behind")) {
        setCopilotMessages((prev) => [
          ...prev,
          {
            sender: "copilot",
            text: "Here are the students from your assigned batches who missed 3 or more classes in the last 30 days:\n\n1. **Rahul Verma** (Batch FS-09) - Missed 4 sessions (Oct 5, Oct 8, Oct 12, Oct 15). Attendance: 68.2%.\n2. **Priya Nair** (Batch FS-09) - Missed 3 sessions. Attendance: 71.0%.\n3. **Rohan Joshi** (Batch CLOUD-02) - Missed 3 sessions. Attendance: 72.5%.\n\nWould you like me to draft an academic nudge or notify their counselor Pooja Patil?",
          },
        ]);
      } else {
        setCopilotMessages((prev) => [
          ...prev,
          {
            sender: "copilot",
            text: `Analyzing your query for your assigned batches (FS-09, FS-11, CLOUD-02). All 3 batches are currently on track with the Q4 curriculum syllabus. Next lab is scheduled today at 4:00 PM in Lab 204.`,
          },
        ]);
      }
    }, 600);
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
                <span className="tst-context-tag" style={{ borderLeftColor: "#10b981" }}>Faculty Cockpit</span>
              </div>
            </Link>
          </div>

          {/* Right Header: Notification Bell + AK Avatar */}
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
              title="Notifications"
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

            {/* AK Avatar badge on far-right */}
            <div
              className="tst-avatar-badge"
              style={{
                width: "36px",
                height: "36px",
                fontSize: "13px",
                fontWeight: 800,
                background: "#059669",
                color: "#ffffff",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(5, 150, 105, 0.3)",
              }}
              title="Amit Kulkarni (Senior Faculty)"
            >
              AK
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
            <span style={{ fontSize: "15px", fontWeight: 800, color: "#111827" }}>Faculty Notifications</span>
            <span style={{ background: "#fef3c7", color: "#b45309", fontSize: "11px", fontWeight: 800, padding: "2px 8px", borderRadius: "9999px" }}>
              1 Pending
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
          {/* Card 1: Attendance Verification Needed */}
          <div style={{ background: "#ffffff", border: "1px solid #fed7aa", borderLeft: "4px solid #f59e0b", borderRadius: "14px", padding: "14px", boxShadow: "0 4px 14px -3px rgba(245, 158, 11, 0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>
              <span style={{ fontWeight: 800, color: "#92400e" }}>⚠️ Attendance Marking Required</span>
              <span>Today 11:30 AM</span>
            </div>
            <div style={{ fontWeight: 800, fontSize: "13.5px", color: "#111827", marginBottom: "3px" }}>
              Batch FS-09 Lab Session Finished
            </div>
            <div style={{ fontSize: "12px", color: "#4b5563", lineHeight: 1.4, marginBottom: "10px" }}>
              Session in Lab 101 concluded. 28 students are awaiting attendance verification.
            </div>
            <button
              type="button"
              className="tst-btn-action primary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => {
                setShowAttendanceModal(true);
                setShowNotificationPanel(false);
              }}
            >
              Mark Attendance Now →
            </button>
          </div>

          {/* Calendar Widget */}
          <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "14px", padding: "14px" }}>
            <div style={{ fontWeight: 800, fontSize: "13.5px", color: "#111827", marginBottom: "8px" }}>Friday, 16 October 2026</div>
            <div style={{ fontSize: "12px", color: "#6b7280" }}>3 Assigned Sessions Today • Next at 4:00 PM (Lab 204)</div>
          </div>
        </div>
      </aside>

      {/* 5-Item Non-Scrollable Subnav Bar */}
      <nav className="tst-subnav-bar">
        <div className="tst-subnav-container" style={{ maxWidth: "100%", width: "100%", padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="tst-tab-list" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* 1. Classroom Cockpit */}
            <button
              type="button"
              className={`tst-nav-tab ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              <span>Classroom Cockpit</span>
            </button>

            {/* 2. My Batches & Students */}
            <button
              type="button"
              className={`tst-nav-tab ${activeTab === "students" ? "active" : ""}`}
              onClick={() => setActiveTab("students")}
            >
              <span>My Batches &amp; Students</span>
              <span className="tst-badge-alert" style={{ marginLeft: "4px" }}>3 Risk</span>
            </button>

            {/* 3. Weekly Timetable */}
            <button
              type="button"
              className={`tst-nav-tab ${activeTab === "timetable" ? "active" : ""}`}
              onClick={() => setActiveTab("timetable")}
            >
              <span>Weekly Timetable</span>
              <span className="tst-pill success" style={{ fontSize: "11px", padding: "1px 6px", marginLeft: "4px" }}>12 Classes</span>
            </button>

            {/* 4. Recordings Library */}
            <button
              type="button"
              className={`tst-nav-tab ${activeTab === "recordings" ? "active" : ""}`}
              onClick={() => setActiveTab("recordings")}
            >
              <span>Recordings Library</span>
            </button>
          </div>

          {/* 5. Create / Actions Dropdown */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className="tst-btn-action primary"
              onClick={() => setShowActionDropdown(!showActionDropdown)}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 18px", fontWeight: 800, borderRadius: "10px" }}
            >
              <span>+ Faculty Action</span>
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
                    setShowAttendanceModal(true);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "9px 12px", background: "transparent", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fffbeb")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span>📝</span>
                  <div>
                    <div>Mark Attendance</div>
                    <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 500 }}>Batch FS-09 or FS-11</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowActionDropdown(false);
                    setShowUploadModal(true);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "9px 12px", background: "transparent", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fffbeb")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span>📹</span>
                  <div>
                    <div>Upload Recording Link</div>
                    <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 500 }}>Publish class session video</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowActionDropdown(false);
                    setShowSubstituteModal(true);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "9px 12px", background: "transparent", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fffbeb")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span>🔄</span>
                  <div>
                    <div>Request Substitute / Leave</div>
                    <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 500 }}>Notify academic director</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowActionDropdown(false);
                    setShowCopilotDrawer(true);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "9px 12px", background: "transparent", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fffbeb")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span>✨</span>
                  <div>
                    <div>Faculty Copilot Q&amp;A</div>
                    <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 500 }}>Batch learning queries</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Role Restriction Banner */}
      <div style={{ background: "#f0fdf4", borderBottom: "1px solid #bbf7d0", padding: "8px 28px", fontSize: "12px", color: "#166534", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span>🛡️</span>
          <span><strong>Faculty Scope Active:</strong> Teaching operations for assigned batches (FS-09, FS-11, CLOUD-02). Fee plans, EMIs, institute revenue, and other trainers&apos; confidential logs are strictly restricted.</span>
        </div>
        <button
          type="button"
          onClick={() => setShowCopilotDrawer(true)}
          style={{ background: "#ffffff", border: "1px solid #86efac", color: "#166534", fontWeight: 700, borderRadius: "6px", padding: "3px 10px", cursor: "pointer" }}
        >
          Ask Faculty Copilot ✨
        </button>
      </div>

      {/* Main Workspace Body */}
      <main style={{ maxWidth: "100%", width: "100%", padding: "24px 28px", flex: 1 }}>
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Top 4 KPI Metrics */}
            <div className="tst-metrics-grid">
              {/* Metric 1 */}
              <div className="tst-metric-card">
                <div className="tst-metric-header">
                  <span className="tst-metric-label">Today&apos;s Sessions</span>
                  <div className="tst-metric-icon">🏫</div>
                </div>
                <div className="tst-metric-value">3 Classes</div>
                <div className="tst-metric-footer">
                  <span className="tst-pill success">1 Finished</span>
                  <span style={{ fontSize: "12px", color: "#6b7280" }}>2 Remaining today</span>
                </div>
              </div>

              {/* Metric 2 */}
              <div className="tst-metric-card">
                <div className="tst-metric-header">
                  <span className="tst-metric-label">Batch Attendance</span>
                  <div className="tst-metric-icon">📊</div>
                </div>
                <div className="tst-metric-value">88.4%</div>
                <div className="tst-metric-footer">
                  <span className="tst-pill success">+2.1%</span>
                  <span style={{ fontSize: "12px", color: "#6b7280" }}>Across 84 students</span>
                </div>
              </div>

              {/* Metric 3 */}
              <div className="tst-metric-card">
                <div className="tst-metric-header">
                  <span className="tst-metric-label">Pending Attendance</span>
                  <div className="tst-metric-icon">📝</div>
                </div>
                <div className="tst-metric-value">1 Batch</div>
                <div className="tst-metric-footer">
                  <span className="tst-badge-alert">Batch FS-09</span>
                  <span style={{ fontSize: "12px", color: "#6b7280" }}>Needs verification</span>
                </div>
              </div>

              {/* Metric 4 */}
              <div className="tst-metric-card">
                <div className="tst-metric-header">
                  <span className="tst-metric-label">Assigned Batches</span>
                  <div className="tst-metric-icon">🎓</div>
                </div>
                <div className="tst-metric-value">3 Batches</div>
                <div className="tst-metric-footer">
                  <span className="tst-badge-counter">FS-09 • FS-11 • CLOUD-02</span>
                </div>
              </div>
            </div>

            {/* Split Grid: Today's Classes & Students Falling Behind */}
            <div className="tst-dashboard-grid">
              {/* Left Column: Today's Classes (Widget 1) & Pending Attendance (Widget 3) */}
              <div className="tst-col-stack">
                {/* WIDGET 1: Today's Classes */}
                <div className="tst-card-panel">
                  <div className="tst-panel-header">
                    <div className="tst-panel-title-group">
                      <h2 className="tst-panel-title">Today&apos;s Classes &amp; Schedule</h2>
                      <span className="tst-pill success">3 Sessions</span>
                    </div>
                    <span style={{ fontSize: "12.5px", color: "#6b7280" }}>Friday, 16 October 2026</span>
                  </div>

                  <div className="tst-table-wrapper">
                    <table className="tst-table">
                      <thead>
                        <tr>
                          <th>Batch &amp; Course</th>
                          <th>Time &amp; Room</th>
                          <th>Students</th>
                          <th>Attendance Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {todayClasses.map((cls) => (
                          <tr key={cls.id}>
                            <td>
                              <strong>{cls.batch}</strong>
                              <div className="tst-cell-sub">{cls.course}</div>
                            </td>
                            <td>
                              {cls.time}
                              <div className="tst-cell-sub">{cls.room}</div>
                            </td>
                            <td>
                              <span style={{ fontWeight: 700 }}>{cls.studentsCount} Students</span>
                            </td>
                            <td>
                              {cls.attendanceMarked ? (
                                <span className="tst-pill success">✓ Attendance Marked</span>
                              ) : (
                                <span className="tst-badge-alert">⚠️ Pending Marking</span>
                              )}
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: "6px" }}>
                                <button
                                  type="button"
                                  className="tst-btn-action primary"
                                  style={{ padding: "5px 10px", fontSize: "11.5px" }}
                                  onClick={() => {
                                    setSelectedBatchForAttendance(cls.batch);
                                    setShowAttendanceModal(true);
                                  }}
                                >
                                  {cls.attendanceMarked ? "Edit" : "Mark"}
                                </button>
                                <button
                                  type="button"
                                  className="tst-btn-action"
                                  style={{ padding: "5px 10px", fontSize: "11.5px" }}
                                  onClick={() => {
                                    setRecBatch(cls.batch);
                                    setShowUploadModal(true);
                                  }}
                                >
                                  + Recording
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* WIDGET 4: Batch-wise Attendance Rate */}
                <div className="tst-card-panel">
                  <div className="tst-panel-header">
                    <div className="tst-panel-title-group">
                      <h2 className="tst-panel-title">Batch-wise Attendance Performance</h2>
                    </div>
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>Last 30 Days</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "8px 0" }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 700, marginBottom: "5px" }}>
                        <span>Batch FS-09 (React &amp; Node Full Stack)</span>
                        <span style={{ color: "#047857" }}>88.4% (Good)</span>
                      </div>
                      <div style={{ width: "100%", height: "8px", background: "#f3f4f6", borderRadius: "9999px", overflow: "hidden" }}>
                        <div style={{ width: "88.4%", height: "100%", background: "#10b981", borderRadius: "9999px" }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 700, marginBottom: "5px" }}>
                        <span>Batch FS-11 (Advanced Node &amp; Cloud)</span>
                        <span style={{ color: "#047857" }}>91.2% (Excellent)</span>
                      </div>
                      <div style={{ width: "100%", height: "8px", background: "#f3f4f6", borderRadius: "9999px", overflow: "hidden" }}>
                        <div style={{ width: "91.2%", height: "100%", background: "#10b981", borderRadius: "9999px" }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 700, marginBottom: "5px" }}>
                        <span>Batch CLOUD-02 (AWS &amp; DevOps Containers)</span>
                        <span style={{ color: "#b45309" }}>78.5% (Needs Follow-up)</span>
                      </div>
                      <div style={{ width: "100%", height: "8px", background: "#f3f4f6", borderRadius: "9999px", overflow: "hidden" }}>
                        <div style={{ width: "78.5%", height: "100%", background: "#f59e0b", borderRadius: "9999px" }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Students Falling Behind (Widget 5) & Upcoming Assignments (Widget 6) */}
              <div className="tst-col-stack">
                {/* WIDGET 5: Students Falling Behind in Assigned Batches */}
                <div className="tst-card-panel">
                  <div className="tst-panel-header">
                    <div className="tst-panel-title-group">
                      <h2 className="tst-panel-title">Students Falling Behind</h2>
                      <span className="tst-badge-alert">3 Flags</span>
                    </div>
                    <button
                      type="button"
                      className="tst-btn-action"
                      style={{ padding: "4px 10px", fontSize: "11.5px" }}
                      onClick={() => handleSendCopilot("Which students in my Java batch missed three classes during the last 30 days?")}
                    >
                      Copilot Deep Dive ✨
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {riskStudents.map((st) => (
                      <div
                        key={st.id}
                        style={{
                          background: "#ffffff",
                          border: "1px solid #fed7aa",
                          borderLeft: "4px solid #f59e0b",
                          borderRadius: "10px",
                          padding: "12px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div>
                            <span style={{ fontWeight: 800, fontSize: "13.5px", color: "#111827" }}>{st.name}</span>
                            <span style={{ fontSize: "11.5px", color: "#6b7280", marginLeft: "6px" }}>({st.batch})</span>
                          </div>
                          <span style={{ background: "#fef3c7", color: "#b45309", fontWeight: 800, fontSize: "11px", padding: "2px 6px", borderRadius: "4px" }}>
                            {st.attendance}% Att.
                          </span>
                        </div>
                        <div style={{ fontSize: "12px", color: "#4b5563" }}>
                          <strong>Risk:</strong> {st.riskReason}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "4px" }}>
                          <span style={{ fontSize: "11px", color: "#9ca3af" }}>Last active {st.lastActive}</span>
                          <button
                            type="button"
                            className="tst-btn-action"
                            style={{ padding: "3px 8px", fontSize: "11px" }}
                            onClick={() => showToast(`Counselor Pooja Patil notified for ${st.name}`)}
                          >
                            Notify Counselor
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* WIDGET 6: Upcoming Assignments & Milestones */}
                <div className="tst-card-panel">
                  <div className="tst-panel-header">
                    <div className="tst-panel-title-group">
                      <h2 className="tst-panel-title">Upcoming Labs &amp; Deadlines</h2>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "10px", background: "#f9fafb", borderRadius: "8px" }}>
                      <span style={{ fontSize: "20px" }}>💻</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: "13px", color: "#111827" }}>Full Stack Capstone Submission</div>
                        <div style={{ fontSize: "11.5px", color: "#6b7280" }}>Batch FS-09 • Due Saturday, 6:00 PM • 18/28 submitted</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "10px", background: "#f9fafb", borderRadius: "8px" }}>
                      <span style={{ fontSize: "20px" }}>☸️</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: "13px", color: "#111827" }}>Docker &amp; K8s Deployment Assessment</div>
                        <div style={{ fontSize: "11.5px", color: "#6b7280" }}>Batch CLOUD-02 • Due Monday, 11:59 PM • Live Lab evaluation</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* WIDGET 8: Availability & Substitution Requests */}
                <div className="tst-card-panel">
                  <div className="tst-panel-header">
                    <div className="tst-panel-title-group">
                      <h2 className="tst-panel-title">Substitution &amp; Leave Status</h2>
                    </div>
                    <button
                      type="button"
                      className="tst-btn-action"
                      style={{ padding: "4px 8px", fontSize: "11.5px" }}
                      onClick={() => setShowSubstituteModal(true)}
                    >
                      + Request
                    </button>
                  </div>

                  {substituteRequests.map((sub) => (
                    <div key={sub.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "13px", color: "#111827" }}>{sub.batch} on {sub.date}</div>
                        <div style={{ fontSize: "11.5px", color: "#6b7280" }}>Substitute: {sub.substitute} • {sub.reason}</div>
                      </div>
                      <span className={`tst-pill ${sub.status === "APPROVED" ? "success" : "alert"}`}>
                        {sub.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Weekly Timetable (Widget 2) */}
        {activeTab === "timetable" && (
          <div className="tst-card-panel">
            <div className="tst-panel-header">
              <div className="tst-panel-title-group">
                <h2 className="tst-panel-title">Assigned Weekly Teaching Timetable</h2>
                <span className="tst-pill success">Faculty: Amit Kulkarni</span>
              </div>
              <span style={{ fontSize: "12.5px", color: "#6b7280" }}>Week of Oct 12 – Oct 17, 2026</span>
            </div>

            <div className="tst-timetable-grid">
              <div className="tst-time-col-header">Time / Day</div>
              <div className="tst-time-col-header">Monday</div>
              <div className="tst-time-col-header">Tuesday</div>
              <div className="tst-time-col-header">Wednesday</div>
              <div className="tst-time-col-header">Thursday</div>
              <div className="tst-time-col-header">Friday (Today)</div>

              {/* 09:30 AM */}
              <div className="tst-time-col-header" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>09:30 AM</div>
              <div className="tst-time-slot active-class"><strong>Batch FS-09</strong><div className="tst-cell-sub">Lab 101 • React State</div></div>
              <div className="tst-time-slot active-class"><strong>Batch FS-09</strong><div className="tst-cell-sub">Lab 101 • Redux</div></div>
              <div className="tst-time-slot active-class"><strong>Batch FS-09</strong><div className="tst-cell-sub">Lab 101 • Hooks Deep Dive</div></div>
              <div className="tst-time-slot active-class"><strong>Batch FS-09</strong><div className="tst-cell-sub">Lab 101 • Next.js Routing</div></div>
              <div className="tst-time-slot active-class" style={{ borderLeftColor: "#10b981", background: "#f0fdf4" }}><strong>Batch FS-09</strong><div className="tst-cell-sub">Lab 101 • Completed Today</div></div>

              {/* 04:00 PM */}
              <div className="tst-time-col-header" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>04:00 PM</div>
              <div className="tst-time-slot active-class"><strong>Batch FS-11</strong><div className="tst-cell-sub">Lab 204 • Node.js APIs</div></div>
              <div className="tst-time-slot active-class"><strong>Batch FS-11</strong><div className="tst-cell-sub">Lab 204 • Express Routing</div></div>
              <div className="tst-time-slot active-class"><strong>Batch FS-11</strong><div className="tst-cell-sub">Lab 204 • MongoDB Atlas</div></div>
              <div className="tst-time-slot active-class"><strong>Batch FS-11</strong><div className="tst-cell-sub">Lab 204 • Authentication</div></div>
              <div className="tst-time-slot active-class" style={{ borderLeftColor: "#f59e0b", background: "#fffbeb" }}><strong>Batch FS-11</strong><div className="tst-cell-sub">Lab 204 • Up Next (4-6 PM)</div></div>
            </div>
          </div>
        )}

        {/* Tab 3: Recordings Library (Widget 7) */}
        {activeTab === "recordings" && (
          <div className="tst-card-panel">
            <div className="tst-panel-header">
              <div className="tst-panel-title-group">
                <h2 className="tst-panel-title">Assigned Course Recordings &amp; Archives</h2>
                <span className="tst-pill success">{recordings.length} Recorded Sessions</span>
              </div>
              <button
                type="button"
                className="tst-btn-action primary"
                onClick={() => setShowUploadModal(true)}
              >
                + Upload New Recording Link
              </button>
            </div>

            <div className="tst-table-wrapper">
              <table className="tst-table">
                <thead>
                  <tr>
                    <th>Topic / Session Title</th>
                    <th>Batch</th>
                    <th>Recorded Date</th>
                    <th>Duration</th>
                    <th>Student Views</th>
                    <th>Recording Link</th>
                  </tr>
                </thead>
                <tbody>
                  {recordings.map((rec) => (
                    <tr key={rec.id}>
                      <td>
                        <strong>{rec.topic}</strong>
                      </td>
                      <td>
                        <span className="tst-badge-counter">{rec.batch}</span>
                      </td>
                      <td>{rec.date}</td>
                      <td>{rec.duration}</td>
                      <td>
                        <span style={{ fontWeight: 700 }}>{rec.views} Views</span>
                      </td>
                      <td>
                        <a
                          href={rec.url}
                          target="_blank"
                          rel="noreferrer"
                          className="tst-btn-action"
                          style={{ padding: "4px 8px", fontSize: "11.5px", textDecoration: "none", display: "inline-block" }}
                        >
                          Watch Video ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Students Details */}
        {activeTab === "students" && (
          <div className="tst-card-panel">
            <div className="tst-panel-header">
              <div className="tst-panel-title-group">
                <h2 className="tst-panel-title">Assigned Students Directory (Batches FS-09, FS-11, CLOUD-02)</h2>
                <span className="tst-pill success">84 Enrolled Students</span>
              </div>
              <span style={{ fontSize: "12px", color: "#6b7280" }}>
                Confidential financial data &amp; other faculty records hidden
              </span>
            </div>

            <div className="tst-table-wrapper">
              <table className="tst-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Batch</th>
                    <th>Contact Email</th>
                    <th>Attendance Rate</th>
                    <th>Academic Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceList.map((st) => (
                    <tr key={st.id}>
                      <td><strong>{st.name}</strong></td>
                      <td>Batch FS-09</td>
                      <td>{st.name.toLowerCase().replace(" ", ".")}@example.com</td>
                      <td>
                        <strong style={{ color: parseInt(st.score) < 75 ? "#b45309" : "#047857" }}>{st.score}</strong>
                      </td>
                      <td>
                        {parseInt(st.score) < 75 ? (
                          <span className="tst-badge-alert">Learning Risk</span>
                        ) : (
                          <span className="tst-pill success">On Track</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="tst-btn-action"
                          style={{ padding: "4px 8px", fontSize: "11.5px" }}
                          onClick={() => showToast(`Academic note added for ${st.name}`)}
                        >
                          + Trainer Note
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: Mark Attendance Sheet */}
      {showAttendanceModal && (
        <div className="tst-modal-backdrop" onClick={() => setShowAttendanceModal(false)}>
          <div className="tst-modal-card" style={{ maxWidth: "560px" }} onClick={(e) => e.stopPropagation()}>
            <div className="tst-modal-header">
              <div>
                <h3 className="tst-modal-title">Mark Attendance: {selectedBatchForAttendance}</h3>
                <div style={{ fontSize: "12.5px", color: "#6b7280", marginTop: "2px" }}>
                  Session date: Today (Oct 16, 2026) • Lab 101
                </div>
              </div>
              <button type="button" className="tst-modal-close" onClick={() => setShowAttendanceModal(false)}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "16px 0", maxHeight: "360px", overflowY: "auto" }}>
              {attendanceList.map((student, idx) => (
                <div
                  key={student.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    background: "#f9fafb",
                    borderRadius: "10px",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "13.5px", color: "#111827" }}>{student.name}</div>
                    <div style={{ fontSize: "11.5px", color: "#6b7280" }}>Overall Attendance: {student.score}</div>
                  </div>

                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...attendanceList];
                        updated[idx].status = "PRESENT";
                        setAttendanceList(updated);
                      }}
                      style={{
                        padding: "5px 10px",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        borderRadius: "6px",
                        border: "1px solid",
                        cursor: "pointer",
                        background: student.status === "PRESENT" ? "#10b981" : "#ffffff",
                        color: student.status === "PRESENT" ? "#ffffff" : "#374151",
                        borderColor: student.status === "PRESENT" ? "#10b981" : "#d1d5db",
                      }}
                    >
                      P
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...attendanceList];
                        updated[idx].status = "LATE";
                        setAttendanceList(updated);
                      }}
                      style={{
                        padding: "5px 10px",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        borderRadius: "6px",
                        border: "1px solid",
                        cursor: "pointer",
                        background: student.status === "LATE" ? "#f59e0b" : "#ffffff",
                        color: student.status === "LATE" ? "#ffffff" : "#374151",
                        borderColor: student.status === "LATE" ? "#f59e0b" : "#d1d5db",
                      }}
                    >
                      L
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...attendanceList];
                        updated[idx].status = "ABSENT";
                        setAttendanceList(updated);
                      }}
                      style={{
                        padding: "5px 10px",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        borderRadius: "6px",
                        border: "1px solid",
                        cursor: "pointer",
                        background: student.status === "ABSENT" ? "#ef4444" : "#ffffff",
                        color: student.status === "ABSENT" ? "#ffffff" : "#374151",
                        borderColor: student.status === "ABSENT" ? "#ef4444" : "#d1d5db",
                      }}
                    >
                      A
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", borderTop: "1px solid #e5e7eb", paddingTop: "14px" }}>
              <button type="button" className="tst-btn-action" onClick={() => setShowAttendanceModal(false)}>
                Cancel
              </button>
              <button type="button" className="tst-btn-action primary" onClick={handleSaveAttendance}>
                Submit Attendance Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Upload Recording Link */}
      {showUploadModal && (
        <div className="tst-modal-backdrop" onClick={() => setShowUploadModal(false)}>
          <div className="tst-modal-card" style={{ maxWidth: "520px" }} onClick={(e) => e.stopPropagation()}>
            <div className="tst-modal-header">
              <h3 className="tst-modal-title">Upload Session Recording</h3>
              <button type="button" className="tst-modal-close" onClick={() => setShowUploadModal(false)}>✕</button>
            </div>

            <form onSubmit={handleUploadRecording}>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", margin: "16px 0" }}>
                <div>
                  <label className="tst-form-label">Batch Selector</label>
                  <select
                    value={recBatch}
                    onChange={(e) => setRecBatch(e.target.value)}
                    className="tst-form-select"
                  >
                    <option value="Batch FS-09">Batch FS-09 (Full Stack Web)</option>
                    <option value="Batch FS-11">Batch FS-11 (React &amp; Node)</option>
                    <option value="Batch CLOUD-02">Batch CLOUD-02 (AWS &amp; DevOps)</option>
                  </select>
                </div>

                <div>
                  <label className="tst-form-label">Session Topic</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Next.js App Router &amp; Server Actions"
                    value={recTopic}
                    onChange={(e) => setRecTopic(e.target.value)}
                    className="tst-form-input"
                  />
                </div>

                <div>
                  <label className="tst-form-label">Recording Video URL / Drive Link</label>
                  <input
                    type="url"
                    placeholder="https://zoom.us/rec/play/..."
                    value={recUrl}
                    onChange={(e) => setRecUrl(e.target.value)}
                    className="tst-form-input"
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" className="tst-btn-action" onClick={() => setShowUploadModal(false)}>Cancel</button>
                <button type="submit" className="tst-btn-action primary">Publish Recording</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Substitute Request */}
      {showSubstituteModal && (
        <div className="tst-modal-backdrop" onClick={() => setShowSubstituteModal(false)}>
          <div className="tst-modal-card" style={{ maxWidth: "520px" }} onClick={(e) => e.stopPropagation()}>
            <div className="tst-modal-header">
              <h3 className="tst-modal-title">Request Substitute Trainer / Leave</h3>
              <button type="button" className="tst-modal-close" onClick={() => setShowSubstituteModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmitSubstitute}>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", margin: "16px 0" }}>
                <div>
                  <label className="tst-form-label">Batch Requiring Coverage</label>
                  <select value={subBatch} onChange={(e) => setSubBatch(e.target.value)} className="tst-form-select">
                    <option value="Batch FS-11">Batch FS-11 (React &amp; Node)</option>
                    <option value="Batch FS-09">Batch FS-09 (Full Stack Web)</option>
                    <option value="Batch CLOUD-02">Batch CLOUD-02 (AWS &amp; DevOps)</option>
                  </select>
                </div>

                <div>
                  <label className="tst-form-label">Date of Leave</label>
                  <input
                    type="date"
                    required
                    value={subDate}
                    onChange={(e) => setSubDate(e.target.value)}
                    className="tst-form-input"
                  />
                </div>

                <div>
                  <label className="tst-form-label">Recommended Backup Faculty</label>
                  <select value={subFaculty} onChange={(e) => setSubFaculty(e.target.value)} className="tst-form-select">
                    <option value="Neha Rao">Neha Rao (AI &amp; Full Stack)</option>
                    <option value="Sameer Deshmukh">Sameer Deshmukh (DevOps &amp; Cloud)</option>
                  </select>
                </div>

                <div>
                  <label className="tst-form-label">Reason for Request</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Enter reason for leave / timetable shift..."
                    value={subReason}
                    onChange={(e) => setSubReason(e.target.value)}
                    className="tst-form-input"
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" className="tst-btn-action" onClick={() => setShowSubstituteModal(false)}>Cancel</button>
                <button type="submit" className="tst-btn-action primary">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Faculty Copilot Side Drawer */}
      {showCopilotDrawer && (
        <>
          <div className="tst-win-panel-backdrop" onClick={() => setShowCopilotDrawer(false)} />
          <aside className="tst-win-notification-panel open" style={{ width: "440px" }}>
            <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "16px" }}>✨</span>
                <span style={{ fontWeight: 800, fontSize: "15px", color: "#111827" }}>Faculty OpsCopilot</span>
              </div>
              <button type="button" onClick={() => setShowCopilotDrawer(false)} style={{ background: "transparent", border: "none", color: "#6b7280", fontSize: "16px", cursor: "pointer" }}>✕</button>
            </div>

            {/* Chat Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {copilotMessages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
                    maxWidth: "88%",
                    padding: "12px 14px",
                    borderRadius: "14px",
                    fontSize: "13px",
                    lineHeight: 1.5,
                    background: msg.sender === "user" ? "#111827" : msg.rbacWarning ? "#fff1f2" : "#ffffff",
                    color: msg.sender === "user" ? "#ffffff" : msg.rbacWarning ? "#9f1239" : "#1f2937",
                    border: msg.rbacWarning ? "1px solid #fecdd3" : msg.sender === "copilot" ? "1px solid #e5e7eb" : "none",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                    whiteSpace: "pre-line",
                  }}
                >
                  {msg.rbacWarning && <div style={{ fontWeight: 800, marginBottom: "4px" }}>⚠️ Access Restricted:</div>}
                  {msg.text}
                </div>
              ))}
            </div>

            {/* Prompt Chips */}
            <div style={{ padding: "10px 16px", borderTop: "1px solid #f3f4f6", display: "flex", gap: "6px", flexWrap: "wrap", background: "#f9fafb" }}>
              <button
                type="button"
                onClick={() => handleSendCopilot("Which students in my Java batch missed three classes during the last 30 days?")}
                style={{ background: "#ffffff", border: "1px solid #d1d5db", borderRadius: "9999px", padding: "4px 10px", fontSize: "11px", fontWeight: 600, color: "#374151", cursor: "pointer" }}
              >
                🔍 Missed 3 classes query
              </button>
              <button
                type="button"
                onClick={() => handleSendCopilot("What are the fee payment details for Sneha Joshi?")}
                style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "9999px", padding: "4px 10px", fontSize: "11px", fontWeight: 700, color: "#9f1239", cursor: "pointer" }}
              >
                🚫 Test Fee Access (RBAC)
              </button>
            </div>

            {/* Input Bar */}
            <div style={{ padding: "12px 16px", borderTop: "1px solid #e5e7eb", display: "flex", gap: "8px" }}>
              <input
                type="text"
                placeholder="Ask Faculty Copilot..."
                value={copilotInput}
                onChange={(e) => setCopilotInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendCopilot()}
                className="tst-form-input"
                style={{ fontSize: "13px", padding: "8px 12px" }}
              />
              <button
                type="button"
                className="tst-btn-action primary"
                onClick={() => handleSendCopilot()}
                style={{ padding: "8px 14px" }}
              >
                Send
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
