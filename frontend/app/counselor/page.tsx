"use client";

import React, { useState } from "react";
import Link from "next/link";

type CounselorTab =
  | "overview"
  | "leads"
  | "retention"
  | "notes"
  | "batches"
  | "communication"
  | "escalations";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  guardianName: string;
  guardianPhone: string;
  targetTrack: string;
  source: string;
  stage: "NEW" | "CONTACTED" | "DEMO_ATTENDED" | "READY_TO_ENROLL" | "ENROLLED";
  date: string;
  counselorNote?: string;
  feeStatus: "FEES_CLEARED" | "PAYMENT_FOLLOWUP_REQUIRED" | "PENDING_ENROLLMENT";
}

interface CounselorTask {
  id: string;
  title: string;
  student: string;
  deadline: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  completed: boolean;
}

interface CommunicationItem {
  id: string;
  recipient: string;
  channel: "WHATSAPP" | "EMAIL";
  template: string;
  message: string;
  time: string;
  status: "SENT" | "DELIVERED" | "READ" | "DRAFT";
}

export default function CounselorDashboard() {
  const [activeTab, setActiveTab] = useState<CounselorTab>("overview");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [showCommModal, setShowCommModal] = useState(false);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState("");
  const [leadStageFilter, setLeadStageFilter] = useState("ALL");

  // Selected student for note/escalate modals
  const [selectedStudentForAction, setSelectedStudentForAction] = useState<string>("Rohan Deshmukh");

  // Copilot interactive state
  const [copilotQuery, setCopilotQuery] = useState("");
  const [copilotAnswer, setCopilotAnswer] = useState<string | null>(null);

  // State: Leads & Students
  const [leads, setLeads] = useState<Lead[]>([
    {
      id: "LEAD-101",
      name: "Harshita Shinde",
      email: "harshita.s@gmail.com",
      phone: "+91 98221 44556",
      guardianName: "Sanjay Shinde (Father)",
      guardianPhone: "+91 98221 44550",
      targetTrack: "Full-Stack Software Engineering",
      source: "WhatsApp Demo Request",
      stage: "NEW",
      date: "Today, 11:20 AM",
      counselorNote: "Inquired about upcoming weekend batch. Working as QA, wanting to transition to Dev.",
      feeStatus: "PENDING_ENROLLMENT",
    },
    {
      id: "LEAD-102",
      name: "Nikhil Kadam",
      email: "nikhil.kadam@yahoo.com",
      phone: "+91 97654 33211",
      guardianName: "Sunita Kadam (Mother)",
      guardianPhone: "+91 97654 33200",
      targetTrack: "Applied Generative AI & Data",
      source: "Website Free Assessment",
      stage: "DEMO_ATTENDED",
      date: "Yesterday",
      counselorNote: "Attended GenAI webinar. Very eager, requested EMI schedule consultation.",
      feeStatus: "PAYMENT_FOLLOWUP_REQUIRED",
    },
    {
      id: "LEAD-103",
      name: "Tanvi Gadgil",
      email: "tanvi.gadgil@outlook.com",
      phone: "+91 94230 11998",
      guardianName: "Prakash Gadgil (Father)",
      guardianPhone: "+91 94230 11990",
      targetTrack: "DevOps & Cloud Engineering",
      source: "Campus Walk-in",
      stage: "ENROLLED",
      date: "14 Oct 2026",
      counselorNote: "Enrolled in Batch DO-05. Welcome pack & credentials sent.",
      feeStatus: "FEES_CLEARED",
    },
    {
      id: "LEAD-104",
      name: "Aditya Deshpande",
      email: "aditya.d@gmail.com",
      phone: "+91 98901 22334",
      guardianName: "Vijay Deshpande (Father)",
      guardianPhone: "+91 98901 22330",
      targetTrack: "Microservices with Go",
      source: "LinkedIn Ad",
      stage: "READY_TO_ENROLL",
      date: "12 Oct 2026",
      counselorNote: "Ready to confirm seat in Batch FS-12 once parent reviews terms.",
      feeStatus: "PAYMENT_FOLLOWUP_REQUIRED",
    },
  ]);

  // State: Tasks
  const [tasks, setTasks] = useState<CounselorTask[]>([
    {
      id: "TASK-1",
      title: "Call parent of Rohan Deshmukh regarding 4 consecutive absences",
      student: "Rohan Deshmukh",
      deadline: "Today by 4:00 PM",
      priority: "HIGH",
      completed: false,
    },
    {
      id: "TASK-2",
      title: "Follow up with Nikhil Kadam after Free Assessment demo",
      student: "Nikhil Kadam",
      deadline: "Today by 6:00 PM",
      priority: "HIGH",
      completed: false,
    },
    {
      id: "TASK-3",
      title: "Verify enrollment paperwork for 8 new Batch FS-12 learners",
      student: "Batch FS-12 Cohort",
      deadline: "Tomorrow",
      priority: "MEDIUM",
      completed: true,
    },
    {
      id: "TASK-4",
      title: "Send Microservices roadmap brochure to Shweta Rane",
      student: "Shweta Rane",
      deadline: "18 Oct 2026",
      priority: "MEDIUM",
      completed: false,
    },
  ]);

  // State: Communications
  const [communications, setCommunications] = useState<CommunicationItem[]>([
    {
      id: "COMM-1",
      recipient: "Batch FS-12 (32 Students)",
      channel: "WHATSAPP",
      template: "Batch Welcome & Orientation Schedule",
      message: "Hello! Welcome to TechSummitTrainers Batch FS-12. Orientation starts Saturday at 10 AM in Lab 101.",
      time: "2 hours ago",
      status: "DELIVERED",
    },
    {
      id: "COMM-2",
      recipient: "Rohan Deshmukh (+91 98234 11223)",
      channel: "WHATSAPP",
      template: "Attendance Check-in & Mentor Support",
      message: "Hi Rohan, we noticed you missed your last classes. Is everything alright? We are here to support you.",
      time: "3 hours ago",
      status: "READ",
    },
    {
      id: "COMM-3",
      recipient: "140 Prospective Learners",
      channel: "EMAIL",
      template: "Kubernetes & Cloud Architecture Masterclass Invite",
      message: "Join Lead Architect Siddharth V. this Sunday for an exclusive live deployment masterclass.",
      time: "Yesterday",
      status: "SENT",
    },
    {
      id: "COMM-4",
      recipient: "Nikhil Kadam",
      channel: "WHATSAPP",
      template: "EMI Milestone Notification (Polite Nudge)",
      message: "Hi Nikhil, friendly reminder regarding your demo assessment follow-up. Let us know if you need assistance.",
      time: "Yesterday",
      status: "DRAFT",
    },
  ]);

  // Form states for modals
  const [newLeadName, setNewLeadName] = useState("");
  const [newLeadEmail, setNewLeadEmail] = useState("");
  const [newLeadPhone, setNewLeadPhone] = useState("");
  const [newLeadGuardian, setNewLeadGuardian] = useState("");
  const [newLeadGuardianPhone, setNewLeadGuardianPhone] = useState("");
  const [newLeadTrack, setNewLeadTrack] = useState("Full-Stack Software Engineering");
  const [newLeadSource, setNewLeadSource] = useState("WhatsApp Demo Request");

  const [noteStudent, setNoteStudent] = useState("Rohan Deshmukh");
  const [noteType, setNoteType] = useState("PHONE_CALL");
  const [noteText, setNoteText] = useState("");

  const [escalateStudent, setEscalateStudent] = useState("Kabir Verma");
  const [escalateTo, setEscalateTo] = useState("OWNER");
  const [escalateReason, setEscalateReason] = useState("DROPOUT_RISK");
  const [escalateNotes, setEscalateNotes] = useState("");

  const [commRecipient, setCommRecipient] = useState("Rohan Deshmukh");
  const [commChannel, setCommChannel] = useState<"WHATSAPP" | "EMAIL">("WHATSAPP");
  const [commMessage, setCommMessage] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3600);
  };

  // Toggle task complete
  const handleToggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
    showToast("Counselor task list updated.");
  };

  // Create new lead
  const handleAddLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newLead: Lead = {
      id: `LEAD-${leads.length + 101}`,
      name: newLeadName,
      email: newLeadEmail,
      phone: newLeadPhone,
      guardianName: newLeadGuardian || "Not Provided",
      guardianPhone: newLeadGuardianPhone || "Not Provided",
      targetTrack: newLeadTrack,
      source: newLeadSource,
      stage: "NEW",
      date: "Just now",
      counselorNote: "New prospect inquiry registered by Counselor Pooja Patil.",
      feeStatus: "PENDING_ENROLLMENT",
    };

    setLeads([newLead, ...leads]);
    setShowAddLeadModal(false);
    showToast(`Lead for "${newLeadName}" created successfully!`);
    setNewLeadName("");
    setNewLeadEmail("");
    setNewLeadPhone("");
  };

  // Submit Note
  const handleNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowNoteModal(false);
    showToast(`Follow-up note logged for ${noteStudent}.`);
    setNoteText("");
  };

  // Submit Escalation
  const handleEscalateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowEscalateModal(false);
    showToast(`Escalation ticket submitted to ${escalateTo} for ${escalateStudent}.`);
    setEscalateNotes("");
  };

  // Send Communication
  const handleSendCommSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newComm: CommunicationItem = {
      id: `COMM-${communications.length + 1}`,
      recipient: commRecipient,
      channel: commChannel,
      template: "Personalized Counselor Message",
      message: commMessage,
      time: "Just now",
      status: "SENT",
    };
    setCommunications([newComm, ...communications]);
    setShowCommModal(false);
    showToast(`Dispatched ${commChannel} reminder to ${commRecipient}.`);
    setCommMessage("");
  };

  // Copilot preset query runner
  const runCopilotQuery = (q: string) => {
    setCopilotQuery(q);
    if (q.toLowerCase().includes("missed two consecutive")) {
      setCopilotAnswer(
        "Identified 2 students in your assigned batches who missed 2+ consecutive sessions and have no follow-up note in the last 48 hours:\n\n1. Rohan Deshmukh (Batch FS-09) — Missed 14 Oct & 16 Oct labs. Last contact was 5 days ago.\n2. Priya Nair (Batch DO-04) — Missed 15 Oct & 16 Oct classes. Medical leave reported verbally but no formal documentation.\n\nRecommended Action: Dispatched polite WhatsApp check-in or schedule guardian contact."
      );
    } else if (q.toLowerCase().includes("stopped attending")) {
      setCopilotAnswer(
        "Critical Watch: Kabir Verma (Batch DO-04) has missed 5 consecutive classes without notice since 09 Oct. Escalation to Owner and Academic Director recommended for dropout prevention."
      );
    } else {
      setCopilotAnswer(
        `Counselor Copilot Analysis for "${q}": Found 24 active leads across 3 batches launching within the next 21 days. Batch FS-12 is at 80% capacity with 8 remaining seats.`
      );
    }
  };

  return (
    <div className="tst-owner-app">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="tst-toast animate-slide-down" role="alert">
          <span className="tst-toast-icon">✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header / Bar */}
      <header className="tst-nav">
        <div className="tst-nav-container">
          <div className="tst-brand-wrap">
            <Link href="/" className="tst-brand-link">
              <div className="tst-logo-badge">
                <svg viewBox="0 0 24 24" className="tst-mountain-icon" fill="currentColor">
                  <path d="M12 6L4.5 19h15L12 6zm-1.2 5.5l2.4 4.1h-4.8l2.4-4.1z" />
                </svg>
              </div>
              <div className="tst-topbar-context">
                <span className="tst-brand-title">TechSummitTrainers</span>
                <span className="tst-context-tag" style={{ borderLeftColor: "#2563eb", background: "#0f172a" }}>
                  Counselor Cockpit
                </span>
              </div>
            </Link>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span className="tst-campus-pill">
              <span className="tst-pulse-dot" />
              Admissions & Student Success • Deccan Campus
            </span>

            {/* Counselor Avatar */}
            <div className="tst-admin-avatar">
              <div className="tst-avatar-badge" style={{ background: "#2563eb", color: "#ffffff" }}>
                PP
              </div>
              <div className="tst-avatar-info">
                <span className="tst-avatar-name">Pooja Patil</span>
                <span className="tst-avatar-role" style={{ color: "#2563eb" }}>
                  Admissions Counselor
                </span>
              </div>
            </div>

            <Link href="/login" className="tst-btn-outline" style={{ padding: "6px 14px", fontSize: "12.5px" }}>
              Portal Login ↗
            </Link>
          </div>
        </div>
      </header>

      {/* Restricted Access Information Banner */}
      <div style={{ background: "#eff6ff", borderBottom: "1px solid #dbeafe", padding: "8px 24px", fontSize: "12.5px", color: "#1e40af", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", maxWidth: "1240px", margin: "0 auto", width: "100%" }}>
          <span>🔒</span>
          <span>
            <strong>Counselor Role Scope Active:</strong> Full access to student profiles, guardian contacts, attendance trends & counseling notes. Detailed bank accounts, staff salaries, and financial ledgers are restricted by institute policy.
          </span>
        </div>
      </div>

      {/* Sub-navigation / Functional Tabs */}
      <nav className="tst-subnav-bar">
        <div className="tst-subnav-container">
          <div className="tst-tab-list">
            <button
              type="button"
              className={`tst-nav-tab ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              <span>Engagement Overview</span>
            </button>

            <button
              type="button"
              className={`tst-nav-tab ${activeTab === "leads" ? "active" : ""}`}
              onClick={() => setActiveTab("leads")}
            >
              <span>Leads & Admissions</span>
              <span className="tst-tab-counter" style={{ background: "#2563eb", color: "#ffffff" }}>
                {leads.length}
              </span>
            </button>

            <button
              type="button"
              className={`tst-nav-tab ${activeTab === "retention" ? "active" : ""}`}
              onClick={() => setActiveTab("retention")}
            >
              <span>Retention & Attendance Watch</span>
              <span className="tst-badge-alert" style={{ marginLeft: "4px" }}>2 Critical</span>
            </button>

            <button
              type="button"
              className={`tst-nav-tab ${activeTab === "notes" ? "active" : ""}`}
              onClick={() => setActiveTab("notes")}
            >
              <span>Counseling Notes & Guardian Details</span>
            </button>

            <button
              type="button"
              className={`tst-nav-tab ${activeTab === "batches" ? "active" : ""}`}
              onClick={() => setActiveTab("batches")}
            >
              <span>Batches & Launch Dates</span>
            </button>

            <button
              type="button"
              className={`tst-nav-tab ${activeTab === "communication" ? "active" : ""}`}
              onClick={() => setActiveTab("communication")}
            >
              <span>Communication History</span>
            </button>

            <button
              type="button"
              className={`tst-nav-tab ${activeTab === "escalations" ? "active" : ""}`}
              onClick={() => setActiveTab("escalations")}
            >
              <span>Escalate to Owner / Accounts</span>
            </button>
          </div>

          {/* Quick Action Toolbar */}
          <div className="tst-action-toolbar">
            <button
              type="button"
              className="tst-btn-action primary"
              onClick={() => setShowAddLeadModal(true)}
            >
              + Add New Lead
            </button>

            <button
              type="button"
              className="tst-btn-action"
              onClick={() => setShowNoteModal(true)}
            >
              Record Call Note
            </button>

            <button
              type="button"
              className="tst-btn-action"
              onClick={() => setShowCommModal(true)}
            >
              Draft Reminder
            </button>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="tst-container" style={{ padding: "28px 24px 64px" }}>
        {/* ========================================================
            COUNSELOR COPILOT PROMPT BAR (WITH EXACT USER QUESTION)
            ======================================================== */}
        <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "16px", padding: "16px 20px", marginBottom: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", flexWrap: "wrap", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f59e0b", color: "#111827", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "14px" }}>
                AI
              </div>
              <div>
                <strong style={{ fontSize: "14px", color: "#111827" }}>Counselor Operations Copilot</strong>
                <div style={{ fontSize: "12px", color: "#6b7280" }}>Ask natural language questions across learner engagement & attendance history</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="tst-preset-pill"
                style={{ color: "#78350f", background: "#fffbeb", borderColor: "#fde68a" }}
                onClick={() => runCopilotQuery("Show students in my assigned batches who have missed two consecutive classes and have not been contacted.")}
              >
                ⚡ “Missed 2 consecutive classes & not contacted”
              </button>

              <button
                type="button"
                className="tst-preset-pill"
                style={{ color: "#1e3a8a", background: "#eff6ff", borderColor: "#bfdbfe" }}
                onClick={() => runCopilotQuery("Show students who recently stopped attending")}
              >
                🚨 Students stopped attending
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <input
              type="text"
              className="tst-input"
              placeholder="e.g. Show students in my assigned batches who have missed two consecutive classes and have not been contacted."
              value={copilotQuery}
              onChange={(e) => setCopilotQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runCopilotQuery(copilotQuery);
                }
              }}
            />
            <button
              type="button"
              className="tst-btn-amber-sm"
              onClick={() => runCopilotQuery(copilotQuery)}
            >
              Query
            </button>
          </div>

          {/* Copilot Answer Box */}
          {copilotAnswer && (
            <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", borderRadius: "12px", padding: "16px", marginTop: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "11.5px", fontWeight: 800, color: "#b45309", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Copilot Intelligence Insight
                </span>
                <button
                  type="button"
                  style={{ background: "none", border: "none", fontSize: "12px", color: "#92400e", cursor: "pointer", fontWeight: 700 }}
                  onClick={() => setCopilotAnswer(null)}
                >
                  Dismiss ✕
                </button>
              </div>
              <p style={{ fontSize: "13.5px", color: "#1f2937", lineHeight: "1.6", whiteSpace: "pre-line", margin: 0 }}>
                {copilotAnswer}
              </p>
            </div>
          )}
        </div>

        {/* ========================================================
            TAB 1: ENGAGEMENT DASHBOARD (ALL 8 WIDGETS)
            ======================================================== */}
        {activeTab === "overview" && (
          <div>
            {/* Top Metric Cards Bar */}
            <div className="tst-metrics-grid">
              <div className="tst-metric-card">
                <div className="tst-metric-top">
                  <span className="tst-metric-title">New Inquiries</span>
                  <div className="tst-metric-icon">📥</div>
                </div>
                <div className="tst-metric-value">24 Leads</div>
                <div className="tst-metric-footer">
                  <span className="tst-trend-up">↑ 18 this week</span>
                  <span>WhatsApp & Web Assessment</span>
                </div>
              </div>

              <div className="tst-metric-card">
                <div className="tst-metric-top">
                  <span className="tst-metric-title">October Admissions</span>
                  <div className="tst-metric-icon">🎓</div>
                </div>
                <div className="tst-metric-value">14 Enrolled</div>
                <div className="tst-metric-footer">
                  <span className="tst-trend-up">74% Conversion</span>
                  <span>vs 65% target</span>
                </div>
              </div>

              <div className="tst-metric-card">
                <div className="tst-metric-top">
                  <span className="tst-metric-title">Retention Alert</span>
                  <div className="tst-metric-icon" style={{ background: "#fee2e2", color: "#dc2626" }}>⚠️</div>
                </div>
                <div className="tst-metric-value">3 Watchlist</div>
                <div className="tst-metric-footer">
                  <span className="tst-trend-down">Low Attendance</span>
                  <span>Requires immediate counseling</span>
                </div>
              </div>

              <div className="tst-metric-card">
                <div className="tst-metric-top">
                  <span className="tst-metric-title">Upcoming Launches</span>
                  <div className="tst-metric-icon">🚀</div>
                </div>
                <div className="tst-metric-value">3 Batches</div>
                <div className="tst-metric-footer">
                  <span>Batch FS-12 starts in 6 days</span>
                </div>
              </div>
            </div>

            {/* 2-Column Split Layout */}
            <div className="tst-dashboard-grid">
              {/* LEFT COLUMN */}
              <div className="tst-col-stack">
                {/* WIDGET 1: New leads and recent admissions */}
                <div className="tst-card-panel">
                  <div className="tst-panel-header">
                    <div className="tst-panel-title-group">
                      <h2 className="tst-panel-title">New Leads & Recent Inquiries</h2>
                      <span className="tst-pill warning">24 Active</span>
                    </div>
                    <button
                      type="button"
                      className="tst-btn-outline"
                      style={{ padding: "4px 10px", fontSize: "12px" }}
                      onClick={() => setActiveTab("leads")}
                    >
                      View All Leads →
                    </button>
                  </div>

                  <div className="tst-table-wrapper">
                    <table className="tst-table">
                      <thead>
                        <tr>
                          <th>Lead / Prospect</th>
                          <th>Target Track</th>
                          <th>Source</th>
                          <th>Stage</th>
                          <th>Quick Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leads.map((l) => (
                          <tr key={l.id}>
                            <td>
                              <div className="tst-cell-user">
                                <div className="tst-cell-avatar" style={{ background: "#e0f2fe", color: "#0369a1" }}>
                                  {l.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="tst-cell-meta">
                                  <span className="tst-cell-name">{l.name}</span>
                                  <span className="tst-cell-sub">{l.phone}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <strong>{l.targetTrack}</strong>
                              <div className="tst-cell-sub">Inquired: {l.date}</div>
                            </td>
                            <td>
                              <span className="tst-pill neutral">{l.source}</span>
                            </td>
                            <td>
                              <span className={`tst-pill ${l.stage === "ENROLLED" ? "success" : l.stage === "NEW" ? "warning" : "neutral"}`}>
                                {l.stage.replace("_", " ")}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: "6px" }}>
                                <a
                                  href={`https://wa.me/${l.phone.replace(/[^0-9]/g, "")}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="tst-btn-outline"
                                  style={{ padding: "3px 8px", fontSize: "11px", color: "#059669" }}
                                >
                                  💬 WhatsApp
                                </a>
                                <button
                                  type="button"
                                  className="tst-btn-outline"
                                  style={{ padding: "3px 8px", fontSize: "11px" }}
                                  onClick={() => {
                                    setNoteStudent(l.name);
                                    setShowNoteModal(true);
                                  }}
                                >
                                  Log Note
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* WIDGET 2: Students requiring follow-up */}
                <div className="tst-card-panel">
                  <div className="tst-panel-header">
                    <div className="tst-panel-title-group">
                      <h2 className="tst-panel-title">Students Requiring Follow-Up</h2>
                      <span className="tst-badge-counter">4 Actionable</span>
                    </div>
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>Today's callback schedule</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", border: "1px solid #e5e7eb", borderRadius: "10px", background: "#ffffff" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "14px", color: "#111827" }}>Aditya Deshpande — EMI Counselor Consultation</div>
                        <div className="tst-cell-sub">Demo completed yesterday. Requested explanation of installment schedule & career guarantee terms.</div>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          type="button"
                          className="tst-btn-amber-sm"
                          style={{ padding: "5px 12px", fontSize: "12px" }}
                          onClick={() => showToast("Opening phone dialer for Aditya Deshpande...")}
                        >
                          📞 Call Now
                        </button>
                        <button
                          type="button"
                          className="tst-btn-outline"
                          style={{ padding: "5px 10px", fontSize: "12px" }}
                          onClick={() => {
                            setNoteStudent("Aditya Deshpande");
                            setShowNoteModal(true);
                          }}
                        >
                          + Note
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", border: "1px solid #e5e7eb", borderRadius: "10px", background: "#ffffff" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "14px", color: "#111827" }}>Shweta Rane — Microservices Curriculum Roadmap</div>
                        <div className="tst-cell-sub">Requested syllabus brochure & live demo recording pass.</div>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          type="button"
                          className="tst-btn-outline"
                          style={{ padding: "5px 12px", fontSize: "12px" }}
                          onClick={() => showToast("Curriculum brochure dispatched via WhatsApp.")}
                        >
                          📄 Send PDF
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", border: "1px solid #e5e7eb", borderRadius: "10px", background: "#ffffff" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "14px", color: "#111827" }}>Manav Joshi — Guardian Lab Timings Inquiry</div>
                        <div className="tst-cell-sub">Guardian Vijay Joshi requested confirmation of Deccan lab availability on weekday evenings.</div>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          type="button"
                          className="tst-btn-outline"
                          style={{ padding: "5px 12px", fontSize: "12px" }}
                          onClick={() => showToast("Calling guardian Vijay Joshi: +91 98221 44550")}
                        >
                          👥 Call Guardian
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* WIDGET 3: Low-attendance students */}
                <div className="tst-card-panel">
                  <div className="tst-panel-header">
                    <div className="tst-panel-title-group">
                      <h2 className="tst-panel-title">Low-Attendance Students (&lt; 75%)</h2>
                      <span className="tst-badge-alert">Counseling Intervention Required</span>
                    </div>
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>Assigned batches only</span>
                  </div>

                  <div className="tst-table-wrapper">
                    <table className="tst-table">
                      <thead>
                        <tr>
                          <th>Learner</th>
                          <th>Batch</th>
                          <th>Attendance</th>
                          <th>Consecutive Misses</th>
                          <th>Fee Status (Confidential)</th>
                          <th>Counselor Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>
                            <strong>Rohan Deshmukh</strong>
                            <div className="tst-cell-sub">Parent: Sanjay D. (+91 98234 11220)</div>
                          </td>
                          <td>Batch FS-09</td>
                          <td><span className="tst-pill danger">61.0%</span></td>
                          <td><strong style={{ color: "#dc2626" }}>4 Classes</strong></td>
                          <td>
                            {/* Restricted label per requirements */}
                            <span className="tst-pill warning">Payment follow-up required</span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button
                                type="button"
                                className="tst-btn-outline"
                                style={{ padding: "3px 8px", fontSize: "11px" }}
                                onClick={() => {
                                  setCommRecipient("Rohan Deshmukh");
                                  setShowCommModal(true);
                                }}
                              >
                                Nudge
                              </button>
                              <button
                                type="button"
                                className="tst-btn-outline"
                                style={{ padding: "3px 8px", fontSize: "11px" }}
                                onClick={() => showToast("Dialing guardian Sanjay Deshmukh...")}
                              >
                                Guardian Call
                              </button>
                            </div>
                          </td>
                        </tr>

                        <tr>
                          <td>
                            <strong>Priya Nair</strong>
                            <div className="tst-cell-sub">Parent: K. Nair (+91 98900 11229)</div>
                          </td>
                          <td>Batch DO-04</td>
                          <td><span className="tst-pill warning">68.5%</span></td>
                          <td>2 Classes</td>
                          <td>
                            {/* Restricted label per requirements */}
                            <span className="tst-pill success">Fees Cleared</span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="tst-btn-outline"
                              style={{ padding: "3px 8px", fontSize: "11px" }}
                              onClick={() => {
                                setNoteStudent("Priya Nair");
                                setShowNoteModal(true);
                              }}
                            >
                              Log Medical Reason
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* WIDGET 4: Students who recently stopped attending */}
                <div className="tst-card-panel" style={{ borderLeft: "4px solid #dc2626" }}>
                  <div className="tst-panel-header">
                    <div className="tst-panel-title-group">
                      <h2 className="tst-panel-title">Students Who Recently Stopped Attending</h2>
                      <span className="tst-badge-alert">High Dropout Hazard</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ background: "#fef2f2", padding: "14px", borderRadius: "10px", border: "1px solid #fecaca", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: "14.5px", color: "#991b1b" }}>Kabir Verma — 5 Unexcused Absences</div>
                        <div style={{ fontSize: "13px", color: "#7f1d1d", marginTop: "2px" }}>
                          Batch DO-04 (DevOps) • Last active 09 Oct • Fee status: <strong>Payment follow-up required</strong>
                        </div>
                        <div style={{ fontSize: "12px", color: "#b91c1c", marginTop: "4px" }}>
                          Reason: Missed CI/CD labs, failed to submit week 4 project. Unreachable on primary phone.
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          type="button"
                          className="tst-btn-reject"
                          style={{ padding: "6px 12px", fontSize: "12px" }}
                          onClick={() => {
                            setEscalateStudent("Kabir Verma");
                            setShowEscalateModal(true);
                          }}
                        >
                          Escalate to Owner ⚠️
                        </button>
                      </div>
                    </div>

                    <div style={{ background: "#fffbeb", padding: "14px", borderRadius: "10px", border: "1px solid #fde68a", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: "14.5px", color: "#92400e" }}>Vikas Shinde — 5 Missed Sessions (Python Foundation)</div>
                        <div style={{ fontSize: "13px", color: "#78350f", marginTop: "2px" }}>
                          Batch AI-02 • Fee status: <strong>Fees Cleared</strong>
                        </div>
                        <div style={{ fontSize: "12px", color: "#b45309", marginTop: "4px" }}>
                          Reason: Academic hurdle. Reported feeling overwhelmed by matrix multiplication in neural networks.
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          type="button"
                          className="tst-btn-amber-sm"
                          style={{ padding: "6px 12px", fontSize: "12px" }}
                          onClick={() => showToast("Assigned 1-on-1 peer mentor Doubt Clearing Session for Vikas Shinde.")}
                        >
                          Book 1-on-1 Doubt Lab
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="tst-col-stack">
                {/* WIDGET 5: Upcoming batch start dates */}
                <div className="tst-card-panel">
                  <div className="tst-panel-header">
                    <h2 className="tst-panel-title">Upcoming Batch Start Dates</h2>
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>Q4 Admissions Target</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {/* Batch 1 */}
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: "12px", padding: "14px", background: "#ffffff" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontWeight: 800, fontSize: "15px", color: "#111827" }}>Batch FS-12</span>
                        <span className="tst-pill warning">Starts in 6 Days</span>
                      </div>
                      <div className="tst-cell-sub">Full-Stack Software Engineering (React, Node & Cloud)</div>
                      <div style={{ margin: "8px 0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>
                          <span>Enrollment Fill Rate</span>
                          <span>32 / 40 Seats (80%)</span>
                        </div>
                        <div style={{ width: "100%", height: "7px", background: "#e5e7eb", borderRadius: "99px", overflow: "hidden" }}>
                          <div style={{ width: "80%", height: "100%", background: "#f59e0b" }} />
                        </div>
                      </div>
                      <div style={{ fontSize: "12px", color: "#6b7280", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>Lead Trainer: Amit Kulkarni</span>
                        <button
                          type="button"
                          className="tst-btn-outline"
                          style={{ padding: "3px 8px", fontSize: "11px" }}
                          onClick={() => setShowEnrollModal(true)}
                        >
                          Enroll Lead →
                        </button>
                      </div>
                    </div>

                    {/* Batch 2 */}
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: "12px", padding: "14px", background: "#ffffff" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontWeight: 800, fontSize: "15px", color: "#111827" }}>Batch DO-05</span>
                        <span className="tst-pill neutral">Starts in 12 Days</span>
                      </div>
                      <div className="tst-cell-sub">DevOps & Cloud Engineering (Kubernetes, AWS, Terraform)</div>
                      <div style={{ margin: "8px 0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>
                          <span>Enrollment Fill Rate</span>
                          <span>26 / 35 Seats (74%)</span>
                        </div>
                        <div style={{ width: "100%", height: "7px", background: "#e5e7eb", borderRadius: "99px", overflow: "hidden" }}>
                          <div style={{ width: "74%", height: "100%", background: "#3b82f6" }} />
                        </div>
                      </div>
                      <div style={{ fontSize: "12px", color: "#6b7280", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>Lead Trainer: Siddharth V.</span>
                        <button
                          type="button"
                          className="tst-btn-outline"
                          style={{ padding: "3px 8px", fontSize: "11px" }}
                          onClick={() => setShowEnrollModal(true)}
                        >
                          Enroll Lead →
                        </button>
                      </div>
                    </div>

                    {/* Batch 3 */}
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: "12px", padding: "14px", background: "#ffffff" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontWeight: 800, fontSize: "15px", color: "#111827" }}>Batch AI-03</span>
                        <span className="tst-pill neutral">Starts in 18 Days</span>
                      </div>
                      <div className="tst-cell-sub">Applied Generative AI & LLMs (LangChain, Vector DBs)</div>
                      <div style={{ margin: "8px 0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>
                          <span>Enrollment Fill Rate</span>
                          <span>19 / 30 Seats (63%)</span>
                        </div>
                        <div style={{ width: "100%", height: "7px", background: "#e5e7eb", borderRadius: "99px", overflow: "hidden" }}>
                          <div style={{ width: "63%", height: "100%", background: "#10b981" }} />
                        </div>
                      </div>
                      <div style={{ fontSize: "12px", color: "#6b7280", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>Lead Trainer: Neha Rao</span>
                        <button
                          type="button"
                          className="tst-btn-outline"
                          style={{ padding: "3px 8px", fontSize: "11px" }}
                          onClick={() => setShowEnrollModal(true)}
                        >
                          Enroll Lead →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* WIDGET 6: Pending counselor tasks */}
                <div className="tst-card-panel">
                  <div className="tst-panel-header">
                    <h2 className="tst-panel-title">Pending Counselor Tasks</h2>
                    <span className="tst-badge-counter">{tasks.filter((t) => !t.completed).length} Incomplete</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {tasks.map((task) => (
                      <label
                        key={task.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "10px",
                          padding: "10px",
                          borderRadius: "8px",
                          background: task.completed ? "#f9fafb" : "#ffffff",
                          border: "1px solid #e5e7eb",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => handleToggleTask(task.id)}
                          style={{ accentColor: "#f59e0b", marginTop: "3px", width: "16px", height: "16px" }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: task.completed ? "#9ca3af" : "#111827", textDecoration: task.completed ? "line-through" : "none" }}>
                            {task.title}
                          </div>
                          <div style={{ fontSize: "11.5px", color: "#6b7280", display: "flex", gap: "8px", marginTop: "2px" }}>
                            <span>Due: {task.deadline}</span>
                            <span>•</span>
                            <span style={{ color: task.priority === "HIGH" ? "#dc2626" : "#4b5563", fontWeight: 600 }}>
                              {task.priority} Priority
                            </span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* WIDGET 7: Draft and sent communication history */}
                <div className="tst-card-panel">
                  <div className="tst-panel-header">
                    <h2 className="tst-panel-title">Communication Log</h2>
                    <button
                      type="button"
                      className="tst-btn-outline"
                      style={{ padding: "3px 8px", fontSize: "11.5px" }}
                      onClick={() => setShowCommModal(true)}
                    >
                      + Compose
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12.5px" }}>
                    {communications.map((c) => (
                      <div key={c.id} style={{ borderBottom: "1px solid #f3f4f6", paddingBottom: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2px" }}>
                          <span style={{ fontWeight: 700, color: "#111827" }}>
                            {c.channel === "WHATSAPP" ? "💬 WhatsApp" : "✉️ Email"} — {c.recipient}
                          </span>
                          <span className={`tst-pill ${c.status === "DELIVERED" || c.status === "READ" ? "success" : c.status === "DRAFT" ? "warning" : "neutral"}`}>
                            {c.status}
                          </span>
                        </div>
                        <div style={{ color: "#4b5563" }}>{c.message}</div>
                        <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>{c.time}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* WIDGET 8: Student-risk alerts relevant to counseling */}
                <div className="tst-card-panel">
                  <div className="tst-panel-header">
                    <h2 className="tst-panel-title">Counseling Risk Radar</h2>
                    <span className="tst-badge-alert">SLO Tracking</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12.5px" }}>
                    <div style={{ background: "#fef2f2", padding: "10px", borderRadius: "8px", border: "1px solid #fecaca" }}>
                      <strong style={{ color: "#991b1b" }}>Academic Motivation Drop:</strong> Vikas Shinde reported difficulty in PyTorch neural network labs.
                    </div>
                    <div style={{ background: "#fffbeb", padding: "10px", borderRadius: "8px", border: "1px solid #fde68a" }}>
                      <strong style={{ color: "#92400e" }}>Unannounced Absences:</strong> 4 students in Batch FS-09 missed 2+ classes without formal intimation.
                    </div>
                    <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                      <strong style={{ color: "#334155" }}>Semester Exam Window:</strong> 3 college learners requested temporary recording access pass.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 2: LEADS & ADMISSIONS
            ======================================================== */}
        {activeTab === "leads" && (
          <div className="tst-card-panel">
            <div className="tst-panel-header">
              <div>
                <h2 className="tst-panel-title">Prospective Leads & Admissions Pipeline</h2>
                <p className="tst-card-subtitle">
                  Manage incoming prospect inquiries from website demos, WhatsApp calls, and campus visits.
                </p>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  className="tst-btn-action primary"
                  onClick={() => setShowAddLeadModal(true)}
                >
                  + Add Prospect Lead
                </button>
                <button
                  type="button"
                  className="tst-btn-action"
                  onClick={() => setShowEnrollModal(true)}
                >
                  Enroll into Batch
                </button>
              </div>
            </div>

            <div className="tst-table-wrapper">
              <table className="tst-table">
                <thead>
                  <tr>
                    <th>Lead Name</th>
                    <th>Contact Phone</th>
                    <th>Guardian Details</th>
                    <th>Target Career Track</th>
                    <th>Inquiry Source</th>
                    <th>Pipeline Stage</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <strong>{l.name}</strong>
                        <div className="tst-cell-sub">{l.email}</div>
                      </td>
                      <td>{l.phone}</td>
                      <td>
                        <div>{l.guardianName}</div>
                        <div className="tst-cell-sub">{l.guardianPhone}</div>
                      </td>
                      <td>{l.targetTrack}</td>
                      <td><span className="tst-pill neutral">{l.source}</span></td>
                      <td>
                        <span className={`tst-pill ${l.stage === "ENROLLED" ? "success" : l.stage === "NEW" ? "warning" : "neutral"}`}>
                          {l.stage}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            type="button"
                            className="tst-btn-outline"
                            style={{ padding: "4px 8px", fontSize: "11px" }}
                            onClick={() => {
                              setNoteStudent(l.name);
                              setShowNoteModal(true);
                            }}
                          >
                            + Note
                          </button>
                          {l.stage !== "ENROLLED" && (
                            <button
                              type="button"
                              className="tst-btn-amber-sm"
                              style={{ padding: "4px 8px", fontSize: "11px" }}
                              onClick={() => {
                                setShowEnrollModal(true);
                              }}
                            >
                              Enroll
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 3: RETENTION & ATTENDANCE WATCH
            ======================================================== */}
        {activeTab === "retention" && (
          <div className="tst-card-panel">
            <div className="tst-panel-header">
              <div>
                <h2 className="tst-panel-title">Learner Retention & Attendance Summaries</h2>
                <p className="tst-card-subtitle">
                  Immediate alerts for learners with falling attendance or consecutive absences in your assigned batches.
                </p>
              </div>

              <button
                type="button"
                className="tst-btn-action primary"
                onClick={() => {
                  setCommMessage("Hello! TechSummitTrainers Counselor desk is reaching out to check on your attendance. Please let us know if you need academic or schedule flexibility.");
                  setShowCommModal(true);
                }}
              >
                Send Batch Attendance Reminder
              </button>
            </div>

            <div className="tst-table-wrapper">
              <table className="tst-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Batch</th>
                    <th>Attendance %</th>
                    <th>Consecutive Missed</th>
                    <th>Guardian Contact</th>
                    <th>Confidential Fee Status</th>
                    <th>Retention Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>Rohan Deshmukh</strong>
                      <div className="tst-cell-sub">rohan.d@gmail.com</div>
                    </td>
                    <td>Batch FS-09</td>
                    <td><span className="tst-pill danger">61.0%</span></td>
                    <td><strong style={{ color: "#dc2626" }}>4 Classes</strong></td>
                    <td>Sanjay Deshmukh (Father) • +91 98234 11220</td>
                    <td>
                      <span className="tst-pill warning">Payment follow-up required</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          className="tst-btn-outline"
                          style={{ padding: "4px 8px", fontSize: "11.5px" }}
                          onClick={() => showToast("WhatsApp support check-in sent to Rohan Deshmukh.")}
                        >
                          💬 WhatsApp
                        </button>
                        <button
                          type="button"
                          className="tst-btn-outline"
                          style={{ padding: "4px 8px", fontSize: "11.5px" }}
                          onClick={() => showToast("Dialing guardian Sanjay Deshmukh...")}
                        >
                          📞 Call Parent
                        </button>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td>
                      <strong>Kabir Verma</strong>
                      <div className="tst-cell-sub">kabir.v@gmail.com</div>
                    </td>
                    <td>Batch DO-04</td>
                    <td><span className="tst-pill danger">54.0%</span></td>
                    <td><strong style={{ color: "#dc2626" }}>5 Classes (Stopped)</strong></td>
                    <td>V. Verma (Father) • +91 98811 77660</td>
                    <td>
                      <span className="tst-pill warning">Payment follow-up required</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="tst-btn-reject"
                        style={{ padding: "4px 10px", fontSize: "11.5px" }}
                        onClick={() => {
                          setEscalateStudent("Kabir Verma");
                          setShowEscalateModal(true);
                        }}
                      >
                        Escalate to Owner ⚠️
                      </button>
                    </td>
                  </tr>

                  <tr>
                    <td>
                      <strong>Priya Nair</strong>
                      <div className="tst-cell-sub">priya.n@outlook.com</div>
                    </td>
                    <td>Batch DO-04</td>
                    <td><span className="tst-pill warning">68.5%</span></td>
                    <td>2 Classes</td>
                    <td>K. Nair (Mother) • +91 98900 11229</td>
                    <td>
                      <span className="tst-pill success">Fees Cleared</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="tst-btn-outline"
                        style={{ padding: "4px 8px", fontSize: "11.5px" }}
                        onClick={() => showToast("Granted recording access pass for 2 missed sessions.")}
                      >
                        Share Recordings Pass
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 4: COUNSELING NOTES & GUARDIAN DETAILS
            ======================================================== */}
        {activeTab === "notes" && (
          <div className="tst-card-panel">
            <div className="tst-panel-header">
              <div>
                <h2 className="tst-panel-title">Counseling Notes & Student Records</h2>
                <p className="tst-card-subtitle">
                  Historical log of interactions, calls, guardian discussions, and retention intervention remarks.
                </p>
              </div>

              <button
                type="button"
                className="tst-btn-action primary"
                onClick={() => setShowNoteModal(true)}
              >
                + Record New Counseling Note
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", background: "#ffffff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontWeight: 800, fontSize: "15px", color: "#111827" }}>Rohan Deshmukh (Batch FS-09)</span>
                    <span className="tst-pill neutral">Phone Call with Student</span>
                  </div>
                  <span style={{ fontSize: "12px", color: "#9ca3af" }}>15 Oct 2026, 04:30 PM • Logged by Pooja Patil</span>
                </div>
                <p style={{ fontSize: "13.5px", color: "#374151", lineHeight: "1.5", margin: "6px 0" }}>
                  "Spoke with Rohan regarding absence on Monday and Wednesday. He stated he had family commitments in Satara. Promised to attend Saturday's guest masterclass and review missed session recordings. Informed him that another absence will trigger guardian escalation."
                </p>
                <div style={{ fontSize: "12px", color: "#6b7280" }}>
                  <strong>Guardian Contact:</strong> Sanjay Deshmukh (Father) • +91 98234 11220
                </div>
              </div>

              <div style={{ border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", background: "#ffffff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontWeight: 800, fontSize: "15px", color: "#111827" }}>Kabir Verma (Batch DO-04)</span>
                    <span className="tst-pill danger">Emergency Outreach</span>
                  </div>
                  <span style={{ fontSize: "12px", color: "#9ca3af" }}>14 Oct 2026, 02:15 PM • Logged by Pooja Patil</span>
                </div>
                <p style={{ fontSize: "13.5px", color: "#374151", lineHeight: "1.5", margin: "6px 0" }}>
                  "Student phone switched off for 3 days. Reached father on secondary number. Father unaware that Kabir has been skipping Deccan campus classes. Father will visit center on Saturday morning for discussion."
                </p>
                <div style={{ fontSize: "12px", color: "#6b7280" }}>
                  <strong>Guardian Contact:</strong> V. Verma (Father) • +91 98811 77660
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 5: BATCHES & START DATES
            ======================================================== */}
        {activeTab === "batches" && (
          <div className="tst-card-panel">
            <div className="tst-panel-header">
              <div>
                <h2 className="tst-panel-title">Batch Schedules & Public Timetable</h2>
                <p className="tst-card-subtitle">
                  Inspect upcoming launch dates, class timings, room locations, and lecture recording links.
                </p>
              </div>
            </div>

            <div className="tst-table-wrapper">
              <table className="tst-table">
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>Track</th>
                    <th>Start Date</th>
                    <th>Schedule & Room</th>
                    <th>Seats Enrolled</th>
                    <th>Recordings Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Batch FS-12</strong></td>
                    <td>Full-Stack React & Node</td>
                    <td>24 Oct 2026 (In 6 days)</td>
                    <td>Mon, Wed, Fri (10:00 AM – 12:00 PM) • Lab 101</td>
                    <td><strong style={{ color: "#d97706" }}>32 / 40 (80%)</strong></td>
                    <td><span className="tst-pill neutral">Starts soon</span></td>
                  </tr>
                  <tr>
                    <td><strong>Batch DO-05</strong></td>
                    <td>DevOps & Cloud</td>
                    <td>30 Oct 2026 (In 12 days)</td>
                    <td>Tue, Thu, Sat (11:30 AM – 01:30 PM) • Lab 102</td>
                    <td><strong style={{ color: "#059669" }}>26 / 35 (74%)</strong></td>
                    <td><span className="tst-pill neutral">Starts soon</span></td>
                  </tr>
                  <tr>
                    <td><strong>Batch FS-09</strong></td>
                    <td>Full-Stack (Running)</td>
                    <td>Active since Sept</td>
                    <td>Mon, Wed, Fri (09:30 AM – 11:30 AM) • Lab 101</td>
                    <td>40 / 40 (100%)</td>
                    <td><span className="tst-pill success">All 18 Recorded ✓</span></td>
                  </tr>
                  <tr>
                    <td><strong>Batch DO-04</strong></td>
                    <td>DevOps (Running)</td>
                    <td>Active since Sept</td>
                    <td>Mon, Wed, Fri (11:45 AM – 01:45 PM) • Lab 102</td>
                    <td>28 / 30 (93%)</td>
                    <td><span className="tst-pill success">All 14 Recorded ✓</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 6: COMMUNICATION HISTORY
            ======================================================== */}
        {activeTab === "communication" && (
          <div className="tst-card-panel">
            <div className="tst-panel-header">
              <div>
                <h2 className="tst-panel-title">Sent & Draft Communication History</h2>
                <p className="tst-card-subtitle">
                  Verify multi-channel WhatsApp and email delivery status for student reminders.
                </p>
              </div>

              <button
                type="button"
                className="tst-btn-action primary"
                onClick={() => setShowCommModal(true)}
              >
                + Compose Reminder
              </button>
            </div>

            <div className="tst-table-wrapper">
              <table className="tst-table">
                <thead>
                  <tr>
                    <th>Channel</th>
                    <th>Recipient</th>
                    <th>Template</th>
                    <th>Message Snippet</th>
                    <th>Dispatched Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {communications.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <span className={`tst-pill ${c.channel === "WHATSAPP" ? "success" : "neutral"}`}>
                          {c.channel}
                        </span>
                      </td>
                      <td><strong>{c.recipient}</strong></td>
                      <td>{c.template}</td>
                      <td>{c.message}</td>
                      <td>{c.time}</td>
                      <td>
                        <span className={`tst-pill ${c.status === "DELIVERED" || c.status === "READ" ? "success" : c.status === "DRAFT" ? "warning" : "neutral"}`}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 7: ESCALATIONS TO OWNER / ACCOUNTS
            ======================================================== */}
        {activeTab === "escalations" && (
          <div className="tst-card-panel">
            <div className="tst-panel-header">
              <div>
                <h2 className="tst-panel-title">Student Escalation Dispatch Queue</h2>
                <p className="tst-card-subtitle">
                  Formally escalate high dropout-risk students or financial hardship cases directly to Owner Rajesh Sharma or Accounts Desk.
                </p>
              </div>

              <button
                type="button"
                className="tst-btn-action primary"
                onClick={() => setShowEscalateModal(true)}
              >
                + New Escalation Ticket
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ border: "1px solid #fecaca", borderRadius: "12px", padding: "16px", background: "#fff1f2" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontWeight: 800, fontSize: "15px", color: "#881337" }}>
                      #ESC-104: Kabir Verma (Batch DO-04)
                    </span>
                    <span className="tst-pill danger">Escalated to Owner</span>
                  </div>
                  <span style={{ fontSize: "12px", color: "#9f1239" }}>Submitted 14 Oct • Pending Owner Review</span>
                </div>
                <p style={{ fontSize: "13.5px", color: "#4c0519", lineHeight: "1.5", margin: "6px 0" }}>
                  "Student has ceased attending DevOps classes for 5 consecutive sessions. Guardian contacted. Recommending meeting with Owner Rajesh Sharma to decide on course pause or cohort transfer."
                </p>
              </div>

              <div style={{ border: "1px solid #fed7aa", borderRadius: "12px", padding: "16px", background: "#fff7ed" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontWeight: 800, fontSize: "15px", color: "#7c2d12" }}>
                      #ESC-102: Ananya Sen (Merit Scholarship Concession)
                    </span>
                    <span className="tst-pill success">Approved by Owner</span>
                  </div>
                  <span style={{ fontSize: "12px", color: "#9a3412" }}>Approved Yesterday by Rajesh Sharma</span>
                </div>
                <p style={{ fontSize: "13.5px", color: "#431407", lineHeight: "1.5", margin: "6px 0" }}>
                  "15% concession granted based on 98% entrance test score. Accounts desk notified to update fee installment plan."
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================
          MODAL 1: ADD NEW LEAD / STUDENT
          ======================================================== */}
      {showAddLeadModal && (
        <div className="tst-modal-backdrop" onClick={() => setShowAddLeadModal(false)}>
          <div className="tst-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="tst-modal-header">
              <h3 className="tst-modal-title">Add Prospect Lead / Inquiry</h3>
              <button
                type="button"
                className="tst-modal-close"
                onClick={() => setShowAddLeadModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddLeadSubmit} className="tst-form">
              <div className="tst-form-group">
                <label className="tst-label">Prospect Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shruti Kulkarni"
                  className="tst-input"
                  value={newLeadName}
                  onChange={(e) => setNewLeadName(e.target.value)}
                />
              </div>

              <div className="tst-form-group">
                <label className="tst-label">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. shruti.k@gmail.com"
                  className="tst-input"
                  value={newLeadEmail}
                  onChange={(e) => setNewLeadEmail(e.target.value)}
                />
              </div>

              <div className="tst-form-group">
                <label className="tst-label">Phone Number (WhatsApp Active)</label>
                <input
                  type="tel"
                  required
                  placeholder="+91 98234 56789"
                  className="tst-input"
                  value={newLeadPhone}
                  onChange={(e) => setNewLeadPhone(e.target.value)}
                />
              </div>

              <div className="tst-form-group">
                <label className="tst-label">Guardian Name & Phone</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <input
                    type="text"
                    placeholder="Guardian Name (e.g. Father)"
                    className="tst-input"
                    value={newLeadGuardian}
                    onChange={(e) => setNewLeadGuardian(e.target.value)}
                  />
                  <input
                    type="tel"
                    placeholder="Guardian Phone"
                    className="tst-input"
                    value={newLeadGuardianPhone}
                    onChange={(e) => setNewLeadGuardianPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="tst-form-group">
                <label className="tst-label">Target Career Track</label>
                <select
                  className="tst-input tst-select"
                  value={newLeadTrack}
                  onChange={(e) => setNewLeadTrack(e.target.value)}
                >
                  <option value="Full-Stack Software Engineering">Full-Stack Software Engineering</option>
                  <option value="DevOps & Cloud Engineering">DevOps & Cloud Engineering</option>
                  <option value="Applied Generative AI & Data">Applied Generative AI & Data</option>
                  <option value="Microservices with Go">Microservices with Go</option>
                </select>
              </div>

              <div className="tst-form-group">
                <label className="tst-label">Inquiry Source</label>
                <select
                  className="tst-input tst-select"
                  value={newLeadSource}
                  onChange={(e) => setNewLeadSource(e.target.value)}
                >
                  <option value="WhatsApp Demo Request">WhatsApp Demo Request</option>
                  <option value="Website Free Assessment">Website Free Assessment</option>
                  <option value="Campus Walk-in">Campus Walk-in</option>
                  <option value="LinkedIn Inquiry">LinkedIn Inquiry</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                <button type="submit" className="tst-btn-amber-lg">
                  Register Lead →
                </button>
                <button
                  type="button"
                  className="tst-btn-outline"
                  onClick={() => setShowAddLeadModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: ENROLL STUDENT INTO BATCH
          ======================================================== */}
      {showEnrollModal && (
        <div className="tst-modal-backdrop" onClick={() => setShowEnrollModal(false)}>
          <div className="tst-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="tst-modal-header">
              <h3 className="tst-modal-title">Enroll Student into Batch</h3>
              <button
                type="button"
                className="tst-modal-close"
                onClick={() => setShowEnrollModal(false)}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setShowEnrollModal(false);
                showToast("Learner officially enrolled into batch! Welcome pack dispatched.");
              }}
              className="tst-form"
            >
              <div className="tst-form-group">
                <label className="tst-label">Select Prospect Lead</label>
                <select className="tst-input tst-select">
                  <option value="Aditya Deshpande">Aditya Deshpande (+91 98901 22334)</option>
                  <option value="Harshita Shinde">Harshita Shinde (+91 98221 44556)</option>
                  <option value="Nikhil Kadam">Nikhil Kadam (+91 97654 33211)</option>
                </select>
              </div>

              <div className="tst-form-group">
                <label className="tst-label">Assign to Upcoming Batch</label>
                <select className="tst-input tst-select">
                  <option value="Batch FS-12">Batch FS-12 (Starts 24 Oct • 8 Seats Remaining)</option>
                  <option value="Batch DO-05">Batch DO-05 (Starts 30 Oct • 9 Seats Remaining)</option>
                  <option value="Batch AI-03">Batch AI-03 (Starts 05 Nov • 11 Seats Remaining)</option>
                </select>
              </div>

              <div className="tst-form-group">
                <label className="tst-label">Delivery Modality</label>
                <select className="tst-input tst-select">
                  <option value="CLASSROOM">Classroom (Deccan Campus)</option>
                  <option value="HYBRID">Hybrid (In-person + Live Stream)</option>
                  <option value="ONLINE">Online Interactive</option>
                </select>
              </div>

              <div className="tst-form-group">
                <label className="tst-label">Fee Clearance Status (Confidential Scope)</label>
                <select className="tst-input tst-select">
                  <option value="FEES_CLEARED">Fees Cleared (Down payment confirmed by Accounts)</option>
                  <option value="PAYMENT_FOLLOWUP_REQUIRED">Payment Follow-up Required (Token paid)</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                <button type="submit" className="tst-btn-amber-lg">
                  Confirm Enrollment →
                </button>
                <button
                  type="button"
                  className="tst-btn-outline"
                  onClick={() => setShowEnrollModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 3: RECORD FOLLOW-UP NOTE
          ======================================================== */}
      {showNoteModal && (
        <div className="tst-modal-backdrop" onClick={() => setShowNoteModal(false)}>
          <div className="tst-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="tst-modal-header">
              <h3 className="tst-modal-title">Record Follow-up / Counseling Note</h3>
              <button
                type="button"
                className="tst-modal-close"
                onClick={() => setShowNoteModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleNoteSubmit} className="tst-form">
              <div className="tst-form-group">
                <label className="tst-label">Learner / Prospect Name</label>
                <input
                  type="text"
                  required
                  className="tst-input"
                  value={noteStudent}
                  onChange={(e) => setNoteStudent(e.target.value)}
                />
              </div>

              <div className="tst-form-group">
                <label className="tst-label">Interaction Channel</label>
                <select
                  className="tst-input tst-select"
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value)}
                >
                  <option value="PHONE_CALL">Phone Call with Learner</option>
                  <option value="GUARDIAN_CALL">Phone Call with Guardian / Parent</option>
                  <option value="WHATSAPP">WhatsApp Discussion</option>
                  <option value="IN_PERSON">In-Person Counseling (Deccan Campus)</option>
                </select>
              </div>

              <div className="tst-form-group">
                <label className="tst-label">Counseling Discussion & Action Items</label>
                <textarea
                  required
                  rows={4}
                  className="tst-input"
                  style={{ height: "auto", padding: "12px" }}
                  placeholder="Summarize key remarks, reasons for absence, student commitment, and next follow-up date..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                <button type="submit" className="tst-btn-amber-lg">
                  Save Note to Profile →
                </button>
                <button
                  type="button"
                  className="tst-btn-outline"
                  onClick={() => setShowNoteModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 4: ESCALATE TO OWNER / ACCOUNTS
          ======================================================== */}
      {showEscalateModal && (
        <div className="tst-modal-backdrop" onClick={() => setShowEscalateModal(false)}>
          <div className="tst-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="tst-modal-header">
              <h3 className="tst-modal-title">Escalate Case to Owner / Accounts</h3>
              <button
                type="button"
                className="tst-modal-close"
                onClick={() => setShowEscalateModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEscalateSubmit} className="tst-form">
              <div className="tst-form-group">
                <label className="tst-label">Learner Name</label>
                <input
                  type="text"
                  required
                  className="tst-input"
                  value={escalateStudent}
                  onChange={(e) => setEscalateStudent(e.target.value)}
                />
              </div>

              <div className="tst-form-group">
                <label className="tst-label">Escalate To</label>
                <select
                  className="tst-input tst-select"
                  value={escalateTo}
                  onChange={(e) => setEscalateTo(e.target.value)}
                >
                  <option value="OWNER">Owner (Rajesh Sharma) — Retention / Academic Review</option>
                  <option value="ACCOUNTS">Accounts Desk — Fee Schedule & Concession</option>
                </select>
              </div>

              <div className="tst-form-group">
                <label className="tst-label">Escalation Reason</label>
                <select
                  className="tst-input tst-select"
                  value={escalateReason}
                  onChange={(e) => setEscalateReason(e.target.value)}
                >
                  <option value="DROPOUT_RISK">Severe Dropout Hazard (5+ consecutive absences)</option>
                  <option value="FINANCIAL_HARDSHIP">Financial Hardship / EMI Concession Request</option>
                  <option value="ACADEMIC_SLUMP">Academic Slump / Batch Transfer Request</option>
                  <option value="PARENT_ESCALATION">Parent Requested Director Meeting</option>
                </select>
              </div>

              <div className="tst-form-group">
                <label className="tst-label">Detailed Notes for Owner / Accounts</label>
                <textarea
                  required
                  rows={4}
                  className="tst-input"
                  style={{ height: "auto", padding: "12px" }}
                  placeholder="Provide background context and recommendations..."
                  value={escalateNotes}
                  onChange={(e) => setEscalateNotes(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                <button type="submit" className="tst-btn-reject" style={{ flex: 1, padding: "12px" }}>
                  Dispatch Escalation Ticket
                </button>
                <button
                  type="button"
                  className="tst-btn-outline"
                  onClick={() => setShowEscalateModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 5: DRAFT COMMUNICATION / REMINDER
          ======================================================== */}
      {showCommModal && (
        <div className="tst-modal-backdrop" onClick={() => setShowCommModal(false)}>
          <div className="tst-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="tst-modal-header">
              <h3 className="tst-modal-title">Draft & Dispatch Learner Reminder</h3>
              <button
                type="button"
                className="tst-modal-close"
                onClick={() => setShowCommModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendCommSubmit} className="tst-form">
              <div className="tst-form-group">
                <label className="tst-label">Target Recipient</label>
                <input
                  type="text"
                  required
                  className="tst-input"
                  value={commRecipient}
                  onChange={(e) => setCommRecipient(e.target.value)}
                />
              </div>

              <div className="tst-form-group">
                <label className="tst-label">Delivery Channel</label>
                <div style={{ display: "flex", gap: "14px" }}>
                  <label className="tst-checkbox-label">
                    <input
                      type="radio"
                      name="channel"
                      checked={commChannel === "WHATSAPP"}
                      onChange={() => setCommChannel("WHATSAPP")}
                    />
                    <span>💬 WhatsApp Template</span>
                  </label>
                  <label className="tst-checkbox-label">
                    <input
                      type="radio"
                      name="channel"
                      checked={commChannel === "EMAIL"}
                      onChange={() => setCommChannel("EMAIL")}
                    />
                    <span>✉️ Official Email</span>
                  </label>
                </div>
              </div>

              <div className="tst-form-group">
                <label className="tst-label">Message Content</label>
                <textarea
                  required
                  rows={4}
                  className="tst-input"
                  style={{ height: "auto", padding: "12px" }}
                  placeholder="Draft reminder message..."
                  value={commMessage}
                  onChange={(e) => setCommMessage(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                <button type="submit" className="tst-btn-amber-lg">
                  Send Now →
                </button>
                <button
                  type="button"
                  className="tst-btn-outline"
                  onClick={() => {
                    setShowCommModal(false);
                    showToast("Saved message to draft queue.");
                  }}
                >
                  Save as Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="tst-footer" style={{ marginTop: "auto" }}>
        <div className="tst-container">
          <div className="tst-footer-flex">
            <div>© {new Date().getFullYear()} TechSummitTrainers OpsPilot • Counselor & Student Success Workspace</div>
            <div className="tst-footer-links">
              <Link href="/login">Switch Account</Link>
              <Link href="/owner">Owner View</Link>
              <Link href="/trainer">Trainer View</Link>
              <Link href="/student">Student View</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
