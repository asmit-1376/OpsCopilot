"use client";

import React, { useState } from "react";
import Link from "next/link";

// Types
type TabType =
  | "overview"
  | "students"
  | "trainers"
  | "counselor"
  | "batches"
  | "fees"
  | "approvals"
  | "settings";

interface Proposal {
  id: string;
  type: string;
  title: string;
  author: string;
  time: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

interface Conflict {
  id: string;
  room: string;
  time: string;
  batchA: string;
  trainerA: string;
  batchB: string;
  trainerB: string;
  status: "ACTIVE" | "RESOLVED";
}

export default function OwnerDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(true);

  // Modals
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [showCopilotDrawer, setShowCopilotDrawer] = useState(false);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState("");
  const [studentFilter, setStudentFilter] = useState("all");

  // State: Conflicts
  const [conflicts, setConflicts] = useState<Conflict[]>([
    {
      id: "conf-1",
      room: "Lab 204 (Deccan Campus)",
      time: "Today @ 4:00 PM – 6:00 PM",
      batchA: "Batch FS-11 (Full Stack)",
      trainerA: "Amit Kulkarni",
      batchB: "Batch AI-03 (Generative AI)",
      trainerB: "Neha Rao",
      status: "ACTIVE",
    },
  ]);

  // State: Action Approvals
  const [proposals, setProposals] = useState<Proposal[]>([
    {
      id: "prop-1",
      type: "BATCH RESCHEDULE",
      title: "Shift Saturday Session: Batch FS-08",
      author: "Trainer Amit Kulkarni",
      time: "25 mins ago",
      reason:
        "Requested shifting Saturday lab from 10:00 AM to 11:30 AM due to industry mentor guest session.",
      status: "PENDING",
    },
    {
      id: "prop-2",
      type: "FEE CONCESSION",
      title: "15% Merit Waiver for Ananya Sen",
      author: "Counselor Pooja Patil",
      time: "1 hour ago",
      reason:
        "Student scored 98% in Entrance Assessment. Family income < ₹3 LPA. Approved by academic panel.",
      status: "PENDING",
    },
    {
      id: "prop-3",
      type: "ROOM REALLOCATION",
      title: "Move Batch DO-04 to Seminar Hall 1",
      author: "Operations Desk",
      time: "2 hours ago",
      reason:
        "Class size expanded from 28 to 36 for Cloud Architecture workshop.",
      status: "PENDING",
    },
  ]);

  // State: Timetable revision
  const [currentRevision, setCurrentRevision] = useState(42);
  const [revisionStatus, setRevisionStatus] = useState("PUBLISHED");

  // State: Policy settings
  const [attendanceThreshold, setAttendanceThreshold] = useState(75);
  const [gracePeriodDays, setGracePeriodDays] = useState(5);
  const [copilotAutonomy, setCopilotAutonomy] = useState("require_approval");

  // New Batch Form State
  const [newBatchName, setNewBatchName] = useState("");
  const [newBatchTrack, setNewBatchTrack] = useState("Full-Stack Software Engineering");
  const [newBatchTrainer, setNewBatchTrainer] = useState("Amit Kulkarni");
  const [newBatchRoom, setNewBatchRoom] = useState("Lab 102");
  const [newBatchMode, setNewBatchMode] = useState("CLASSROOM");

  // Assign Modal Form State
  const [assignBatch, setAssignBatch] = useState("Batch FS-11");
  const [assignTrainer, setAssignTrainer] = useState("Amit Kulkarni");
  const [assignRoom, setAssignRoom] = useState("Lab 201");

  // Copilot interactive state
  const [copilotPrompt, setCopilotPrompt] = useState("");
  const [copilotResponse, setCopilotResponse] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  };

  // Actions
  const handleApproveProposal = (id: string) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "APPROVED" } : p))
    );
    showToast("Proposal approved and recorded in tamper-evident audit log.");
  };

  const handleRejectProposal = (id: string) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "REJECTED" } : p))
    );
    showToast("Proposal rejected with notification sent to author.");
  };

  const handleResolveConflict = (id: string) => {
    setConflicts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "RESOLVED" } : c))
    );
    showToast("Conflict auto-resolved: Batch AI-03 reallocated to Lab 102.");
  };

  const handleCreateBatch = (e: React.FormEvent) => {
    e.preventDefault();
    setShowBatchModal(false);
    showToast(`Batch "${newBatchName || "Batch FS-12"}" successfully created and scheduled!`);
    setNewBatchName("");
  };

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowAssignModal(false);
    showToast(`Updated: ${assignBatch} assigned to ${assignTrainer} in ${assignRoom}`);
  };

  const handlePublishRevision = () => {
    setCurrentRevision((prev) => prev + 1);
    setRevisionStatus("PUBLISHED");
    setShowRevisionModal(false);
    showToast(`Timetable Revision #${currentRevision + 1} published to all students & faculty!`);
  };

  const handleRollbackRevision = () => {
    if (currentRevision > 1) {
      setCurrentRevision((prev) => prev - 1);
      setShowRevisionModal(false);
      showToast(`Timetable rolled back to Revision #${currentRevision - 1}.`);
    }
  };

  const handleCopilotQuery = (queryText: string) => {
    setCopilotPrompt(queryText);
    if (queryText.includes("conflict")) {
      setCopilotResponse(
        "Detected 1 collision in Lab 204 at 4:00 PM today between FS-11 and AI-03. Recommended action: Move AI-03 to Lab 102 which is vacant until 6:30 PM."
      );
    } else if (queryText.includes("attendance")) {
      setCopilotResponse(
        "Current institute-wide attendance is 88.4%. 3 students have fallen below the 75% threshold in the last 7 days: Rohan Deshmukh (61%), Vikas Shinde (59%), and Priya Nair (68%). Automated WhatsApp follow-ups generated."
      );
    } else if (queryText.includes("fee") || queryText.includes("collection")) {
      setCopilotResponse(
        "October collections stand at ₹42.80L (91.8% efficiency). Overdue tally is ₹3.15L across 14 students. Projected month-end recovery is ₹45.50L based on historical settlement trends."
      );
    } else {
      setCopilotResponse(
        `Analysis for "${queryText}": All 28 batches operational. Trainer workload utilization is at 94%. No unassigned rooms detected for tomorrow.`
      );
    }
  };

  const pendingCount = proposals.filter((p) => p.status === "PENDING").length;
  const activeConflictCount = conflicts.filter((c) => c.status === "ACTIVE").length;

  return (
    <div className="tst-owner-app">
      {/* Toast */}
      {toastMessage && (
        <div className="tst-toast animate-slide-down" role="alert">
          <span className="tst-toast-icon">✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header / Bar */}
      <header className="tst-nav">
        <div className="tst-nav-container" style={{ maxWidth: "100%", width: "100%", padding: "0 28px" }}>
          <div className="tst-brand-wrap">
            <Link href="/" className="tst-brand-link">
              <div className="tst-logo-badge">
                <svg viewBox="0 0 24 24" className="tst-mountain-icon" fill="currentColor">
                  <path d="M12 6L4.5 19h15L12 6zm-1.2 5.5l2.4 4.1h-4.8l2.4-4.1z" />
                </svg>
              </div>
              <div className="tst-topbar-context">
                <span className="tst-brand-title">TechSummitTrainers</span>
                <span className="tst-context-tag">Owner Cockpit</span>
              </div>
            </Link>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            {/* Notification Bell Symbol on the left side of profile icon */}
            <div>
              <button
                type="button"
                onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                className="tst-icon-circle"
                style={{
                  position: "relative",
                  background: showNotificationDropdown ? "#fffbeb" : "#ffffff",
                  borderColor: showNotificationDropdown ? "#f59e0b" : "#e5e7eb",
                  cursor: "pointer",
                  width: "36px",
                  height: "36px",
                  color: showNotificationDropdown ? "#d97706" : "#111827",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: showNotificationDropdown ? "0 0 0 2px rgba(245, 158, 11, 0.25)" : "none",
                  transition: "all 0.2s ease",
                }}
                title="Notifications (Click to slide panel in/out)"
                aria-label="Toggle notifications panel"
              >
                {/* Bell SVG */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>

                {/* Badge Dot / Counter (Amber - No Red) */}
                {activeConflictCount > 0 && (
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
                      boxShadow: "0 2px 6px rgba(245, 158, 11, 0.45)",
                    }}
                  >
                    {activeConflictCount}
                  </span>
                )}
              </button>
            </div>

            {/* RS Profile Icon on the right-most side */}
            <div
              className="tst-avatar-badge"
              style={{
                width: "36px",
                height: "36px",
                fontSize: "13.5px",
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(245, 158, 11, 0.3)",
              }}
              title="Rajesh Sharma (Owner & Director)"
            >
              RS
            </div>
          </div>
        </div>
      </header>

      {/* Windows 11 Style Notification Panel Backdrop */}
      {showNotificationDropdown && (
        <div
          className="tst-win-panel-backdrop"
          onClick={() => setShowNotificationDropdown(false)}
        />
      )}

      {/* Windows 11 Style Notification Panel (Slides left on open, slides right on close) */}
      <aside
        className={`tst-win-notification-panel ${showNotificationDropdown ? "open" : "closed"}`}
        aria-label="Windows Style Notification Panel"
      >
        {/* Header (like Windows 11 Notification Center) */}
        <div
          style={{
            padding: "16px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(229, 231, 235, 0.8)",
            background: "rgba(255, 255, 255, 0.8)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "15px", fontWeight: 800, color: "#111827" }}>Notifications</span>
            {activeConflictCount > 0 ? (
              <span
                style={{
                  background: "#fef3c7",
                  color: "#b45309",
                  fontSize: "11px",
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  border: "1px solid #fde68a",
                }}
              >
                {activeConflictCount} Urgent
              </span>
            ) : (
              <span
                style={{
                  background: "#ecfdf5",
                  color: "#047857",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "9999px",
                }}
              >
                All clear
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {activeConflictCount > 0 && (
              <button
                type="button"
                onClick={() => handleResolveConflict("conf-1")}
                style={{
                  background: "#f3f4f6",
                  border: "1px solid #e5e7eb",
                  color: "#374151",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#e5e7eb")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#f3f4f6")}
              >
                Clear all
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowNotificationDropdown(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "#6b7280",
                fontSize: "16px",
                cursor: "pointer",
                padding: "4px 6px",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
              }}
              title="Close panel (Slides to right)"
              aria-label="Close panel"
              onMouseEnter={(e) => (e.currentTarget.style.color = "#111827")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Notification & Calendar Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          
          {/* Card 1: Room Scheduling Conflict (From User's Screenshot) */}
          {activeConflictCount > 0 ? (
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #fed7aa",
                borderLeft: "4px solid #f59e0b",
                borderRadius: "14px",
                padding: "14px",
                boxShadow: "0 4px 14px -3px rgba(245, 158, 11, 0.15), 0 1px 3px rgba(0, 0, 0, 0.05)",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              {/* App Source & Timestamp (Windows Style) */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px", color: "#6b7280" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "14px" }}>⚠️</span>
                  <span style={{ fontWeight: 800, color: "#92400e" }}>TechSummitTrainers • Room Conflict</span>
                </div>
                <span>Just now</span>
              </div>

              {/* Conflict Title & Description */}
              <div>
                <div style={{ fontWeight: 800, fontSize: "13.5px", color: "#111827", marginBottom: "4px" }}>
                  Room Scheduling Conflict in Lab 204
                </div>
                <div style={{ fontSize: "12px", color: "#4b5563", lineHeight: 1.45 }}>
                  <strong style={{ color: "#1f2937" }}>Batch FS-11</strong> (Amit Kulkarni) and{" "}
                  <strong style={{ color: "#1f2937" }}>Batch AI-03</strong> (Neha Rao) are both booked for{" "}
                  <strong>Lab 204</strong> today from <strong>4:00 PM – 6:00 PM</strong>.
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", paddingTop: "2px" }}>
                <button
                  type="button"
                  onClick={() => {
                    handleResolveConflict("conf-1");
                  }}
                  style={{
                    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "7px 14px",
                    fontSize: "12px",
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(245, 158, 11, 0.35)",
                    flex: 1,
                    textAlign: "center",
                  }}
                >
                  Auto-Resolve via Copilot →
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignModal(true);
                  }}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #d1d5db",
                    color: "#374151",
                    borderRadius: "8px",
                    padding: "7px 12px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                >
                  Manual Reassign
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "12px",
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <span style={{ fontSize: "18px", color: "#10b981" }}>✓</span>
              <div style={{ fontSize: "12px", color: "#166534", fontWeight: 700 }}>
                All batch schedules and lab allocations are conflict-free.
              </div>
            </div>
          )}

          {/* Card 2: Pending Approval Alert */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "14px",
              padding: "12px 14px",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px", color: "#6b7280" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span>📋</span>
                <span style={{ fontWeight: 700, color: "#111827" }}>Approval Workflow</span>
              </div>
              <span>25m ago</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: "13px", color: "#111827" }}>
              Shift Saturday Session: Batch FS-08
            </div>
            <div style={{ fontSize: "11.5px", color: "#6b7280", lineHeight: 1.4 }}>
              Trainer Amit Kulkarni requested shifting lab to 11:30 AM due to industry mentor session.
            </div>
          </div>

          {/* Card 3: Attendance Watch Alert */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "14px",
              padding: "12px 14px",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px", color: "#6b7280" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span>👥</span>
                <span style={{ fontWeight: 700, color: "#111827" }}>Attendance Watch</span>
              </div>
              <span>1h ago</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: "13px", color: "#111827" }}>
              3 Students Below 75% Threshold
            </div>
            <div style={{ fontSize: "11.5px", color: "#6b7280", lineHeight: 1.4 }}>
              Batch FS-09 students flagged for counselor follow-up.
            </div>
          </div>

          {/* Calendar & Date Section (Exact Windows 11 Calendar from User's Screenshot) */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "14px",
              padding: "14px",
              marginTop: "4px",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)",
            }}
          >
            {/* Header: Friday, 16 October */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ fontWeight: 800, fontSize: "13.5px", color: "#111827" }}>
                Friday, 16 October
              </div>
              <span style={{ fontSize: "12px", color: "#9ca3af" }}>▼</span>
            </div>

            {/* Month & Year header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <span style={{ fontWeight: 700, fontSize: "13px", color: "#1f2937" }}>October, 2026</span>
              <div style={{ display: "flex", gap: "8px", color: "#6b7280", fontSize: "12px" }}>
                <span style={{ cursor: "pointer" }}>▲</span>
                <span style={{ cursor: "pointer" }}>▼</span>
              </div>
            </div>

            {/* Calendar Day Labels */}
            <div className="tst-win-cal-grid" style={{ marginBottom: "6px" }}>
              <div className="tst-win-cal-day-label">Su</div>
              <div className="tst-win-cal-day-label">Mo</div>
              <div className="tst-win-cal-day-label">Tu</div>
              <div className="tst-win-cal-day-label">We</div>
              <div className="tst-win-cal-day-label">Th</div>
              <div className="tst-win-cal-day-label">Fr</div>
              <div className="tst-win-cal-day-label">Sa</div>

              {/* Row 1 */}
              <div className="tst-win-cal-date-cell other-month">27</div>
              <div className="tst-win-cal-date-cell other-month">28</div>
              <div className="tst-win-cal-date-cell other-month">29</div>
              <div className="tst-win-cal-date-cell other-month">30</div>
              <div className="tst-win-cal-date-cell">1</div>
              <div className="tst-win-cal-date-cell">2</div>
              <div className="tst-win-cal-date-cell">3</div>

              {/* Row 2 */}
              <div className="tst-win-cal-date-cell">4</div>
              <div className="tst-win-cal-date-cell">5</div>
              <div className="tst-win-cal-date-cell">6</div>
              <div className="tst-win-cal-date-cell">7</div>
              <div className="tst-win-cal-date-cell">8</div>
              <div className="tst-win-cal-date-cell">9</div>
              <div className="tst-win-cal-date-cell">10</div>

              {/* Row 3 - 16th is Today! Highlighted in Golden Amber */}
              <div className="tst-win-cal-date-cell">11</div>
              <div className="tst-win-cal-date-cell">12</div>
              <div className="tst-win-cal-date-cell">13</div>
              <div className="tst-win-cal-date-cell">14</div>
              <div className="tst-win-cal-date-cell">15</div>
              <div className="tst-win-cal-date-cell today">16</div>
              <div className="tst-win-cal-date-cell">17</div>

              {/* Row 4 */}
              <div className="tst-win-cal-date-cell">18</div>
              <div className="tst-win-cal-date-cell">19</div>
              <div className="tst-win-cal-date-cell">20</div>
              <div className="tst-win-cal-date-cell">21</div>
              <div className="tst-win-cal-date-cell">22</div>
              <div className="tst-win-cal-date-cell">23</div>
              <div className="tst-win-cal-date-cell">24</div>

              {/* Row 5 */}
              <div className="tst-win-cal-date-cell">25</div>
              <div className="tst-win-cal-date-cell">26</div>
              <div className="tst-win-cal-date-cell">27</div>
              <div className="tst-win-cal-date-cell">28</div>
              <div className="tst-win-cal-date-cell">29</div>
              <div className="tst-win-cal-date-cell">30</div>
              <div className="tst-win-cal-date-cell">31</div>
            </div>

            {/* Quick Status Bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "10px",
                paddingTop: "10px",
                borderTop: "1px solid #f3f4f6",
                fontSize: "11.5px",
                color: "#6b7280",
                fontWeight: 600,
              }}
            >
              <span>14 Classes Today</span>
              <span style={{ color: "#d97706", fontWeight: 800 }}>88.4% Attendance</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Sub-navigation / Functional Tabs: Exactly 5 items, non-scrollable */}
      <nav className="tst-subnav-bar">
        <div
          className="tst-subnav-container"
          style={{ maxWidth: "100%", width: "100%", padding: "0 28px", overflow: "visible", display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          <div className="tst-tab-list" style={{ overflow: "visible", display: "flex", alignItems: "center", gap: "10px" }}>
            {/* 1. Executive Overview */}
            <button
              type="button"
              className={`tst-nav-tab ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("overview");
                setShowCreateDropdown(false);
              }}
            >
              <span>Executive Overview</span>
            </button>

            {/* 2. Students Details */}
            <button
              type="button"
              className={`tst-nav-tab ${activeTab === "students" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("students");
                setShowCreateDropdown(false);
              }}
            >
              <span>Students Details</span>
              <span className="tst-badge-alert" style={{ marginLeft: "4px" }}>3 Risk</span>
            </button>

            {/* 3. Trainer Details */}
            <button
              type="button"
              className={`tst-nav-tab ${activeTab === "trainers" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("trainers");
                setShowCreateDropdown(false);
              }}
            >
              <span>Trainer Details</span>
              <span className="tst-pill success" style={{ fontSize: "11px", padding: "1px 6px", marginLeft: "4px" }}>34 Active</span>
            </button>

            {/* 4. Counselor Details */}
            <button
              type="button"
              className={`tst-nav-tab ${activeTab === "counselor" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("counselor");
                setShowCreateDropdown(false);
              }}
            >
              <span>Counselor Details</span>
              <span className="tst-tab-counter" style={{ marginLeft: "4px" }}>24 Leads</span>
            </button>
          </div>

          {/* 5. Create (Dropdown) */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className="tst-btn-action primary"
              onClick={() => setShowCreateDropdown(!showCreateDropdown)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 18px",
                fontWeight: 800,
                fontSize: "13.5px",
                borderRadius: "10px",
              }}
            >
              <span>+ Create</span>
              <span style={{ fontSize: "11px", transform: showCreateDropdown ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                ▼
              </span>
            </button>

            {/* Create Dropdown Options */}
            {showCreateDropdown && (
              <div
                className="animate-slide-down"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 8px)",
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "14px",
                  boxShadow: "0 15px 35px -5px rgba(0, 0, 0, 0.15), 0 5px 15px rgba(0, 0, 0, 0.05)",
                  padding: "8px",
                  minWidth: "260px",
                  zIndex: 50,
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                {/* Create New Batch */}
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateDropdown(false);
                    setShowBatchModal(true);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    width: "100%",
                    padding: "10px 14px",
                    background: "transparent",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "13.5px",
                    fontWeight: 700,
                    color: "#111827",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fffbeb")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontSize: "16px" }}>📦</span>
                  <div>
                    <div>Create New Batch</div>
                    <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 500 }}>Setup batch, track & timetable</div>
                  </div>
                </button>

                {/* Assign Trainer */}
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateDropdown(false);
                    setShowAssignModal(true);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    width: "100%",
                    padding: "10px 14px",
                    background: "transparent",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "13.5px",
                    fontWeight: 700,
                    color: "#111827",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fffbeb")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontSize: "16px" }}>👨‍🏫</span>
                  <div>
                    <div>Assign Trainer</div>
                    <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 500 }}>Map faculty to active batch</div>
                  </div>
                </button>

                {/* Assign Room */}
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateDropdown(false);
                    setShowAssignModal(true);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    width: "100%",
                    padding: "10px 14px",
                    background: "transparent",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "13.5px",
                    fontWeight: 700,
                    color: "#111827",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fffbeb")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontSize: "16px" }}>🏫</span>
                  <div>
                    <div>Assign Room</div>
                    <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 500 }}>Resolve conflicts & allocate labs</div>
                  </div>
                </button>

                {/* Timetable Revision */}
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateDropdown(false);
                    setShowRevisionModal(true);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    width: "100%",
                    padding: "10px 14px",
                    background: "transparent",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "13.5px",
                    fontWeight: 700,
                    color: "#111827",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fffbeb")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontSize: "16px" }}>📅</span>
                  <div>
                    <div>Timetable Revision</div>
                    <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 500 }}>Publish or rollback revision #{currentRevision}</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Body */}
      <main className="tst-container" style={{ padding: "28px 24px 64px" }}>
        {/* ========================================================
            TAB 1: EXECUTIVE OVERVIEW (ALL 9 WIDGETS)
            ======================================================== */}
        {activeTab === "overview" && (
          <div>
            {/* WIDGET 1: Total active students, trainers, batches and courses */}
            <section className="tst-metrics-grid">
              {/* Active Students */}
              <div className="tst-metric-card">
                <div className="tst-metric-top">
                  <span className="tst-metric-title">Active Students</span>
                  <div className="tst-metric-icon">🎓</div>
                </div>
                <div className="tst-metric-value">1,248</div>
                <div className="tst-metric-footer">
                  <span className="tst-trend-up">↑ +12.4%</span>
                  <span>vs last month (92 new enrollments)</span>
                </div>
              </div>

              {/* Active Trainers */}
              <div className="tst-metric-card">
                <div className="tst-metric-top">
                  <span className="tst-metric-title">Active Trainers</span>
                  <div className="tst-metric-icon">💻</div>
                </div>
                <div className="tst-metric-value">34</div>
                <div className="tst-metric-footer">
                  <span className="tst-trend-up">94%</span>
                  <span>capacity utilization (2 on leave)</span>
                </div>
              </div>

              {/* Running Batches */}
              <div className="tst-metric-card">
                <div className="tst-metric-top">
                  <span className="tst-metric-title">Running Batches</span>
                  <div className="tst-metric-icon">📦</div>
                </div>
                <div className="tst-metric-value">28</div>
                <div className="tst-metric-footer">
                  <span>18 Classroom • 10 Hybrid & Online</span>
                </div>
              </div>

              {/* Active Courses */}
              <div className="tst-metric-card">
                <div className="tst-metric-top">
                  <span className="tst-metric-title">Career Tracks</span>
                  <div className="tst-metric-icon">📚</div>
                </div>
                <div className="tst-metric-value">6 Tracks</div>
                <div className="tst-metric-footer">
                  <span className="tst-badge-counter">FS • DevOps • AI • Cloud</span>
                </div>
              </div>
            </section>



            {/* Main 2-Column Split Dashboard */}
            <div className="tst-dashboard-grid">
              {/* LEFT COLUMN */}
              <div className="tst-col-stack">
                {/* WIDGET 2: Today's classes and attendance rate */}
                <div className="tst-card-panel">
                  <div className="tst-panel-header">
                    <div className="tst-panel-title-group">
                      <h2 className="tst-panel-title">Today's Classes & Attendance Rate</h2>
                      <span className="tst-pill success">88.4% Check-in</span>
                    </div>
                    <span style={{ fontSize: "12.5px", color: "#6b7280" }}>
                      14 Classes Scheduled Today
                    </span>
                  </div>

                  <div className="tst-table-wrapper">
                    <table className="tst-table">
                      <thead>
                        <tr>
                          <th>Batch / Track</th>
                          <th>Time & Room</th>
                          <th>Trainer</th>
                          <th>Attendance Rate</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>
                            <strong>Batch FS-09</strong>
                            <div className="tst-cell-sub">Full Stack React & Node</div>
                          </td>
                          <td>
                            09:30 AM – 11:30 AM
                            <div className="tst-cell-sub">Lab 101</div>
                          </td>
                          <td>Amit Kulkarni</td>
                          <td>
                            <strong style={{ color: "#059669" }}>92.5%</strong> (37/40)
                          </td>
                          <td><span className="tst-pill neutral">Completed</span></td>
                        </tr>
                        <tr>
                          <td>
                            <strong>Batch DO-04</strong>
                            <div className="tst-cell-sub">DevOps Kubernetes & CI/CD</div>
                          </td>
                          <td>
                            11:45 AM – 01:45 PM
                            <div className="tst-cell-sub">Lab 102</div>
                          </td>
                          <td>Siddharth V.</td>
                          <td>
                            <strong style={{ color: "#059669" }}>89.2%</strong> (25/28)
                          </td>
                          <td><span className="tst-pill success">Live Now</span></td>
                        </tr>
                        <tr>
                          <td>
                            <strong>Batch AI-02</strong>
                            <div className="tst-cell-sub">Generative AI & LLMs</div>
                          </td>
                          <td>
                            02:00 PM – 04:00 PM
                            <div className="tst-cell-sub">Room 302</div>
                          </td>
                          <td>Neha Rao</td>
                          <td>
                            <strong style={{ color: "#d97706" }}>84.0%</strong> (21/25)
                          </td>
                          <td><span className="tst-pill warning">Upcoming</span></td>
                        </tr>
                        <tr>
                          <td>
                            <strong>Batch FS-11</strong>
                            <div className="tst-cell-sub">Microservices with Go</div>
                          </td>
                          <td>
                            04:00 PM – 06:00 PM
                            <div className="tst-cell-sub" style={{ color: "#dc2626" }}>Lab 204 (Conflict)</div>
                          </td>
                          <td>Amit Kulkarni</td>
                          <td>
                            <span>Projected ~88%</span>
                          </td>
                          <td><span className="tst-pill danger">Needs Room</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* WIDGET 4: Instalments due, overdue amount and collection trends */}
                <div className="tst-card-panel">
                  <div className="tst-panel-header">
                    <div className="tst-panel-title-group">
                      <h2 className="tst-panel-title">Instalments, Overdue & Collections</h2>
                      <span className="tst-pill success">91.8% Recovery</span>
                    </div>
                    <button
                      type="button"
                      className="tst-btn-outline"
                      style={{ padding: "4px 10px", fontSize: "12px" }}
                      onClick={() => setActiveTab("fees")}
                    >
                      View Detailed Ledger →
                    </button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginBottom: "18px" }}>
                    <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                        Collected This Month
                      </div>
                      <div style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>
                        ₹42,80,000
                      </div>
                      <div style={{ fontSize: "11px", color: "#059669", marginTop: "2px" }}>
                        ↑ 14% over target
                      </div>
                    </div>

                    <div style={{ background: "#fffbeb", padding: "14px", borderRadius: "12px", border: "1px solid #fef3c7" }}>
                      <div style={{ fontSize: "11.5px", color: "#b45309", fontWeight: 700, textTransform: "uppercase" }}>
                        Due Next 7 Days
                      </div>
                      <div style={{ fontSize: "22px", fontWeight: 800, color: "#78350f", marginTop: "4px" }}>
                        ₹8,45,000
                      </div>
                      <div style={{ fontSize: "11px", color: "#92400e", marginTop: "2px" }}>
                        38 student instalments
                      </div>
                    </div>

                    <div style={{ background: "#fef2f2", padding: "14px", borderRadius: "12px", border: "1px solid #fecaca" }}>
                      <div style={{ fontSize: "11.5px", color: "#b91c1c", fontWeight: 700, textTransform: "uppercase" }}>
                        Overdue Amount
                      </div>
                      <div style={{ fontSize: "22px", fontWeight: 800, color: "#991b1b", marginTop: "4px" }}>
                        ₹3,15,000
                      </div>
                      <div style={{ fontSize: "11px", color: "#b91c1c", marginTop: "2px" }}>
                        14 students overdue (&gt; 10 days)
                      </div>
                    </div>
                  </div>

                  <div style={{ background: "#fafafa", padding: "12px 16px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "13px", color: "#4b5563" }}>
                      Automated payment nudges scheduled for overdue accounts today.
                    </span>
                    <button
                      type="button"
                      className="tst-btn-amber-sm"
                      style={{ padding: "6px 14px", fontSize: "12px" }}
                      onClick={() => showToast("Dispatched WhatsApp payment reminders to 14 overdue students.")}
                    >
                      Trigger All Nudges Now
                    </button>
                  </div>
                </div>

                {/* WIDGET 3: Students with low attendance */}
                <div className="tst-card-panel">
                  <div className="tst-panel-header">
                    <div className="tst-panel-title-group">
                      <h2 className="tst-panel-title">Students with Low Attendance</h2>
                      <span className="tst-badge-alert">Below {attendanceThreshold}%</span>
                    </div>
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>
                      Threshold configured at {attendanceThreshold}%
                    </span>
                  </div>

                  <div className="tst-table-wrapper">
                    <table className="tst-table">
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Batch</th>
                          <th>Attendance</th>
                          <th>Absences</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>
                            <div className="tst-cell-user">
                              <div className="tst-cell-avatar">RD</div>
                              <div className="tst-cell-meta">
                                <span className="tst-cell-name">Rohan Deshmukh</span>
                                <span className="tst-cell-sub">rohan.d@gmail.com</span>
                              </div>
                            </div>
                          </td>
                          <td>Batch FS-09</td>
                          <td>
                            <span className="tst-pill danger">61.0%</span>
                          </td>
                          <td>4 consecutive days</td>
                          <td>
                            <button
                              type="button"
                              className="tst-btn-outline"
                              style={{ padding: "4px 8px", fontSize: "11.5px" }}
                              onClick={() => showToast("WhatsApp alert sent to Rohan Deshmukh & assigned counselor.")}
                            >
                              💬 WhatsApp Nudge
                            </button>
                          </td>
                        </tr>

                        <tr>
                          <td>
                            <div className="tst-cell-user">
                              <div className="tst-cell-avatar">VS</div>
                              <div className="tst-cell-meta">
                                <span className="tst-cell-name">Vikas Shinde</span>
                                <span className="tst-cell-sub">vikas.shinde@yahoo.com</span>
                              </div>
                            </div>
                          </td>
                          <td>Batch AI-02</td>
                          <td>
                            <span className="tst-pill danger">59.2%</span>
                          </td>
                          <td>5 missed labs</td>
                          <td>
                            <button
                              type="button"
                              className="tst-btn-outline"
                              style={{ padding: "4px 8px", fontSize: "11.5px" }}
                              onClick={() => showToast("Scheduled mandatory counseling meeting for Vikas Shinde.")}
                            >
                              📞 Counselor Call
                            </button>
                          </td>
                        </tr>

                        <tr>
                          <td>
                            <div className="tst-cell-user">
                              <div className="tst-cell-avatar">PN</div>
                              <div className="tst-cell-meta">
                                <span className="tst-cell-name">Priya Nair</span>
                                <span className="tst-cell-sub">priya.nair@outlook.com</span>
                              </div>
                            </div>
                          </td>
                          <td>Batch DO-04</td>
                          <td>
                            <span className="tst-pill warning">68.5%</span>
                          </td>
                          <td>Medical leave</td>
                          <td>
                            <button
                              type="button"
                              className="tst-btn-outline"
                              style={{ padding: "4px 8px", fontSize: "11.5px" }}
                              onClick={() => showToast("Granted recording access pass for missed lectures to Priya.")}
                            >
                              🎥 Share Recordings
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="tst-col-stack">
                {/* WIDGET 6: Pending action approvals */}
                <div className="tst-card-panel">
                  <div className="tst-panel-header">
                    <div className="tst-panel-title-group">
                      <h2 className="tst-panel-title">Pending Action Approvals</h2>
                      <span className="tst-badge-counter">{pendingCount} Pending</span>
                    </div>
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>Requires Owner Sign-off</span>
                  </div>

                  <div className="tst-proposal-list">
                    {proposals.map((p) => (
                      <div key={p.id} className="tst-proposal-card">
                        <div className="tst-proposal-top">
                          <span className="tst-proposal-type">{p.type}</span>
                          <span className="tst-proposal-time">{p.time}</span>
                        </div>
                        <div className="tst-proposal-title">{p.title}</div>
                        <div className="tst-cell-sub" style={{ marginBottom: "6px" }}>
                          Submitted by <strong>{p.author}</strong>
                        </div>
                        <div className="tst-proposal-reason">{p.reason}</div>

                        {p.status === "PENDING" ? (
                          <div className="tst-proposal-actions">
                            <button
                              type="button"
                              className="tst-btn-approve"
                              onClick={() => handleApproveProposal(p.id)}
                            >
                              ✓ Approve
                            </button>
                            <button
                              type="button"
                              className="tst-btn-reject"
                              onClick={() => handleRejectProposal(p.id)}
                            >
                              ✕ Reject
                            </button>
                          </div>
                        ) : (
                          <span className={`tst-pill ${p.status === "APPROVED" ? "success" : "danger"}`}>
                            {p.status === "APPROVED" ? "✓ Approved by Owner" : "✕ Rejected"}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* WIDGET 8: Dropout-risk students with reasons */}
                <div className="tst-card-panel">
                  <div className="tst-panel-header">
                    <div className="tst-panel-title-group">
                      <h2 className="tst-panel-title">Dropout Risk Watch</h2>
                      <span className="tst-badge-alert">AI Predictor</span>
                    </div>
                  </div>

                  <div className="tst-risk-list">
                    <div className="tst-risk-card">
                      <div className="tst-risk-info">
                        <div className="tst-risk-score high">89%</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "14px", color: "#111827" }}>Kabir Verma</div>
                          <div className="tst-risk-reason">
                            5 days unexcused absence + EMI overdue 12 days + zero lab commits.
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="tst-btn-amber-sm"
                        style={{ padding: "4px 10px", fontSize: "11px", whiteSpace: "nowrap" }}
                        onClick={() => showToast("Urgent counseling escalation triggered for Kabir Verma.")}
                      >
                        Escalate
                      </button>
                    </div>

                    <div className="tst-risk-card">
                      <div className="tst-risk-info">
                        <div className="tst-risk-score medium">64%</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "14px", color: "#111827" }}>Sakshi More</div>
                          <div style={{ fontSize: "12px", color: "#b45309", fontWeight: 600 }}>
                            Missed 3 mock interviews + partial attendance drop in Cloud module.
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="tst-btn-outline"
                        style={{ padding: "4px 10px", fontSize: "11px", whiteSpace: "nowrap" }}
                        onClick={() => showToast("Mentorship 1-on-1 scheduled with Lead Trainer.")}
                      >
                        1-on-1
                      </button>
                    </div>

                    <div className="tst-risk-card">
                      <div className="tst-risk-info">
                        <div className="tst-risk-score medium">58%</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "14px", color: "#111827" }}>Aditi Kulkarni</div>
                          <div style={{ fontSize: "12px", color: "#6b7280" }}>
                            Requested temporary batch pause due to exam semester.
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="tst-btn-outline"
                        style={{ padding: "4px 10px", fontSize: "11px", whiteSpace: "nowrap" }}
                        onClick={() => showToast("Pause agreement sent for review.")}
                      >
                        Review
                      </button>
                    </div>
                  </div>
                </div>

                {/* WIDGET 7: Recently sent reminders */}
                <div className="tst-card-panel">
                  <div className="tst-panel-header">
                    <h2 className="tst-panel-title">Recently Sent Reminders</h2>
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>Multi-channel</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", paddingBottom: "10px", borderBottom: "1px solid #f3f4f6" }}>
                      <span style={{ color: "#25d366", fontSize: "16px" }}>💬</span>
                      <div>
                        <div><strong>Fee Reminder (WhatsApp):</strong> Sent to 14 overdue students.</div>
                        <div className="tst-cell-sub">22 mins ago • 100% delivered</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", paddingBottom: "10px", borderBottom: "1px solid #f3f4f6" }}>
                      <span style={{ color: "#25d366", fontSize: "16px" }}>💬</span>
                      <div>
                        <div><strong>Low Attendance Alert:</strong> Sent to Rohan D. and parent.</div>
                        <div className="tst-cell-sub">1 hour ago • Read receipt received</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                      <span style={{ color: "#3b82f6", fontSize: "16px" }}>✉️</span>
                      <div>
                        <div><strong>Timetable Revision Notice:</strong> Broadcast for Batch DO-04.</div>
                        <div className="tst-cell-sub">3 hours ago • 28 students notified</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* WIDGET 9: Copilot activity and recent audit events */}
                <div className="tst-card-panel">
                  <div className="tst-panel-header">
                    <h2 className="tst-panel-title">Audit Log & AI Copilot Feed</h2>
                    <span className="tst-pill neutral">Immutable Log</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12.5px" }}>
                    <div style={{ background: "#f9fafb", padding: "8px 12px", borderRadius: "8px" }}>
                      <span style={{ color: "#9ca3af" }}>18:45 • </span>
                      <strong>Owner</strong> approved Batch AI-05 curriculum update
                    </div>
                    <div style={{ background: "#f9fafb", padding: "8px 12px", borderRadius: "8px" }}>
                      <span style={{ color: "#9ca3af" }}>17:12 • </span>
                      <strong>Counselor Pooja</strong> logged counseling session for #1094
                    </div>
                    <div style={{ background: "#f9fafb", padding: "8px 12px", borderRadius: "8px" }}>
                      <span style={{ color: "#9ca3af" }}>15:30 • </span>
                      <strong>System</strong> published Timetable Revision #{currentRevision}
                    </div>
                    <div style={{ background: "#fffbeb", padding: "8px 12px", borderRadius: "8px", borderLeft: "3px solid #f59e0b" }}>
                      <span style={{ color: "#b45309" }}>14:20 • </span>
                      <strong>Copilot AI</strong> generated room allocation suggestion for Lab 102
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 2: ALL STUDENTS AND PROFILES
            ======================================================== */}
        {activeTab === "students" && (
          <div className="tst-card-panel">
            <div className="tst-panel-header">
              <div>
                <h2 className="tst-panel-title">All Students & Profiles Directory</h2>
                <p className="tst-card-subtitle">
                  Browse complete learner profiles, attendance history, fee milestones, and academic track records.
                </p>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  type="text"
                  placeholder="Search by student name, email, batch..."
                  className="tst-input"
                  style={{ height: "40px", width: "260px" }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select
                  className="tst-input tst-select"
                  style={{ height: "40px", width: "160px" }}
                  value={studentFilter}
                  onChange={(e) => setStudentFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="risk">High Dropout Risk</option>
                  <option value="low">Low Attendance (&lt;75%)</option>
                  <option value="overdue">Fee Overdue</option>
                </select>
              </div>
            </div>

            <div className="tst-table-wrapper">
              <table className="tst-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Enrolled Track & Batch</th>
                    <th>Attendance %</th>
                    <th>Fees Paid / Plan</th>
                    <th>Risk Factor</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div className="tst-cell-user">
                        <div className="tst-cell-avatar">RD</div>
                        <div className="tst-cell-meta">
                          <span className="tst-cell-name">Rohan Deshmukh</span>
                          <span className="tst-cell-sub">rohan.d@gmail.com • +91 98234 11223</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong>Batch FS-09</strong>
                      <div className="tst-cell-sub">Full Stack React & Node</div>
                    </td>
                    <td><span className="tst-pill danger">61.0% (Critical)</span></td>
                    <td>
                      <div>₹60,000 / ₹95,000</div>
                      <div style={{ fontSize: "11px", color: "#dc2626" }}>Overdue: ₹15,000</div>
                    </td>
                    <td><span className="tst-pill danger">High (82%)</span></td>
                    <td>
                      <button
                        type="button"
                        className="tst-btn-outline"
                        style={{ padding: "4px 10px", fontSize: "12px" }}
                        onClick={() => showToast("Opening Rohan Deshmukh's full 360° profile...")}
                      >
                        View Profile →
                      </button>
                    </td>
                  </tr>

                  <tr>
                    <td>
                      <div className="tst-cell-user">
                        <div className="tst-cell-avatar">SJ</div>
                        <div className="tst-cell-meta">
                          <span className="tst-cell-name">Sneha Joshi</span>
                          <span className="tst-cell-sub">sneha.j@gmail.com • +91 94220 88991</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong>Batch FS-09</strong>
                      <div className="tst-cell-sub">Full Stack React & Node</div>
                    </td>
                    <td><span className="tst-pill success">96.5% (Exemplary)</span></td>
                    <td>
                      <div>₹95,000 / ₹95,000</div>
                      <div style={{ fontSize: "11px", color: "#059669" }}>Fully Paid</div>
                    </td>
                    <td><span className="tst-pill success">Safe (2%)</span></td>
                    <td>
                      <button
                        type="button"
                        className="tst-btn-outline"
                        style={{ padding: "4px 10px", fontSize: "12px" }}
                        onClick={() => showToast("Opening Sneha Joshi's profile...")}
                      >
                        View Profile →
                      </button>
                    </td>
                  </tr>

                  <tr>
                    <td>
                      <div className="tst-cell-user">
                        <div className="tst-cell-avatar">KV</div>
                        <div className="tst-cell-meta">
                          <span className="tst-cell-name">Kabir Verma</span>
                          <span className="tst-cell-sub">kabir.v@gmail.com • +91 98811 77665</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong>Batch DO-04</strong>
                      <div className="tst-cell-sub">DevOps & Cloud Engineering</div>
                    </td>
                    <td><span className="tst-pill danger">54.0% (Critical)</span></td>
                    <td>
                      <div>₹30,000 / ₹1,10,000</div>
                      <div style={{ fontSize: "11px", color: "#dc2626" }}>Overdue: ₹25,000 (12d)</div>
                    </td>
                    <td><span className="tst-pill danger">Critical (89%)</span></td>
                    <td>
                      <button
                        type="button"
                        className="tst-btn-outline"
                        style={{ padding: "4px 10px", fontSize: "12px" }}
                        onClick={() => showToast("Opening Kabir Verma's profile...")}
                      >
                        View Profile →
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 3: ALL BATCHES, COURSES, ROOMS & TIMETABLE
            ======================================================== */}
        {activeTab === "batches" && (
          <div className="tst-card-panel">
            <div className="tst-panel-header">
              <div>
                <h2 className="tst-panel-title">Batches, Courses, Rooms & Timetable Matrix</h2>
                <p className="tst-card-subtitle">
                  Inspect batch health, room capacity, live recording availability, and timetable revisions.
                </p>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  className="tst-btn-action primary"
                  onClick={() => setShowBatchModal(true)}
                >
                  + Add New Batch
                </button>
                <button
                  type="button"
                  className="tst-btn-action"
                  onClick={() => setShowRevisionModal(true)}
                >
                  Publish Timetable Rev
                </button>
              </div>
            </div>

            {/* Weekly Timetable Grid Preview */}
            <h3 style={{ fontSize: "15px", fontWeight: 800, color: "#111827", margin: "16px 0 8px" }}>
              Active Timetable Schedule — Deccan Campus
            </h3>

            <div className="tst-timetable-grid">
              <div className="tst-time-col-header">Time</div>
              <div className="tst-time-col-header">Monday</div>
              <div className="tst-time-col-header">Tuesday</div>
              <div className="tst-time-col-header">Wednesday</div>
              <div className="tst-time-col-header">Thursday</div>
              <div className="tst-time-col-header">Friday</div>

              {/* Slot 1: 09:30 AM */}
              <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#6b7280", padding: "10px 4px" }}>
                09:30 AM
              </div>
              <div className="tst-time-slot active-class">
                <strong>Batch FS-09</strong>
                <div>Lab 101 • Amit K.</div>
                <div style={{ color: "#059669" }}>Recorded ✓</div>
              </div>
              <div className="tst-time-slot active-class">
                <strong>Batch FS-09</strong>
                <div>Lab 101 • Amit K.</div>
                <div style={{ color: "#059669" }}>Recorded ✓</div>
              </div>
              <div className="tst-time-slot active-class">
                <strong>Batch DO-04</strong>
                <div>Lab 102 • Siddharth</div>
                <div style={{ color: "#059669" }}>Recorded ✓</div>
              </div>
              <div className="tst-time-slot active-class">
                <strong>Batch FS-09</strong>
                <div>Lab 101 • Amit K.</div>
                <div style={{ color: "#059669" }}>Recorded ✓</div>
              </div>
              <div className="tst-time-slot active-class">
                <strong>Batch DO-04</strong>
                <div>Lab 102 • Siddharth</div>
                <div style={{ color: "#059669" }}>Recorded ✓</div>
              </div>

              {/* Slot 2: 02:00 PM */}
              <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#6b7280", padding: "10px 4px" }}>
                02:00 PM
              </div>
              <div className="tst-time-slot">
                <strong>Batch AI-02</strong>
                <div>Room 302 • Neha R.</div>
              </div>
              <div className="tst-time-slot">
                <strong>Batch AI-02</strong>
                <div>Room 302 • Neha R.</div>
              </div>
              <div className="tst-time-slot">
                <strong>Open Lab Practice</strong>
                <div>Lab 101 (Free)</div>
              </div>
              <div className="tst-time-slot">
                <strong>Batch AI-02</strong>
                <div>Room 302 • Neha R.</div>
              </div>
              <div className="tst-time-slot">
                <strong>Guest Masterclass</strong>
                <div>Auditorium</div>
              </div>

              {/* Slot 3: 04:00 PM */}
              <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#6b7280", padding: "10px 4px" }}>
                04:00 PM
              </div>
              <div className="tst-time-slot">
                <strong>Batch FS-10</strong>
                <div>Lab 102 • Rohan P.</div>
              </div>
              <div className="tst-time-slot">
                <strong>Batch FS-10</strong>
                <div>Lab 102 • Rohan P.</div>
              </div>
              <div className="tst-time-slot conflict">
                <strong>⚠️ Lab 204 Conflict</strong>
                <div>FS-11 vs AI-03</div>
                <div style={{ color: "#dc2626", fontWeight: 700 }}>Double Booked</div>
              </div>
              <div className="tst-time-slot">
                <strong>Batch FS-10</strong>
                <div>Lab 102 • Rohan P.</div>
              </div>
              <div className="tst-time-slot">
                <strong>Weekly Hackathon</strong>
                <div>Campus-wide</div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 4: TRAINERS AVAILABILITY & WORKLOAD
            ======================================================== */}
        {activeTab === "trainers" && (
          <div className="tst-card-panel">
            <div className="tst-panel-header">
              <div>
                <h2 className="tst-panel-title">Trainer Availability & Workload</h2>
                <p className="tst-card-subtitle">
                  Monitor faculty teaching hours, assigned batches, feedback ratings, and room utilization.
                </p>
              </div>

              <button
                type="button"
                className="tst-btn-action primary"
                onClick={() => setShowAssignModal(true)}
              >
                Reassign Trainer Workload
              </button>
            </div>

            <div className="tst-table-wrapper">
              <table className="tst-table">
                <thead>
                  <tr>
                    <th>Trainer</th>
                    <th>Core Specialization</th>
                    <th>Assigned Batches</th>
                    <th>Weekly Load / Capacity</th>
                    <th>Student Rating</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div className="tst-cell-user">
                        <div className="tst-cell-avatar">AK</div>
                        <div className="tst-cell-meta">
                          <span className="tst-cell-name">Amit Kulkarni</span>
                          <span className="tst-cell-sub">amit.k@techsummittrainers.com</span>
                        </div>
                      </div>
                    </td>
                    <td>Full Stack, Distributed Systems & Go</td>
                    <td>Batch FS-09, Batch FS-11</td>
                    <td>
                      <strong>24 hrs / 30 hrs</strong>
                      <div className="tst-cell-sub">80% Workload (Optimal)</div>
                    </td>
                    <td><strong style={{ color: "#d97706" }}>★ 4.92 / 5.0</strong></td>
                    <td><span className="tst-pill success">Available</span></td>
                  </tr>

                  <tr>
                    <td>
                      <div className="tst-cell-user">
                        <div className="tst-cell-avatar">SV</div>
                        <div className="tst-cell-meta">
                          <span className="tst-cell-name">Siddharth V.</span>
                          <span className="tst-cell-sub">siddharth.v@techsummittrainers.com</span>
                        </div>
                      </div>
                    </td>
                    <td>DevOps, Kubernetes & AWS Cloud</td>
                    <td>Batch DO-04, Batch DO-05</td>
                    <td>
                      <strong>28 hrs / 30 hrs</strong>
                      <div className="tst-cell-sub">93% Workload (Near Peak)</div>
                    </td>
                    <td><strong style={{ color: "#d97706" }}>★ 4.88 / 5.0</strong></td>
                    <td><span className="tst-pill warning">High Load</span></td>
                  </tr>

                  <tr>
                    <td>
                      <div className="tst-cell-user">
                        <div className="tst-cell-avatar">NR</div>
                        <div className="tst-cell-meta">
                          <span className="tst-cell-name">Neha Rao</span>
                          <span className="tst-cell-sub">neha.r@techsummittrainers.com</span>
                        </div>
                      </div>
                    </td>
                    <td>Generative AI, LangChain & PyTorch</td>
                    <td>Batch AI-02, Batch AI-03</td>
                    <td>
                      <strong>20 hrs / 30 hrs</strong>
                      <div className="tst-cell-sub">66% Workload (Ready for new batch)</div>
                    </td>
                    <td><strong style={{ color: "#d97706" }}>★ 4.95 / 5.0</strong></td>
                    <td><span className="tst-pill success">Available</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB: COUNSELOR DETAILS
            ======================================================== */}
        {activeTab === "counselor" && (
          <div className="tst-card-panel">
            <div className="tst-panel-header">
              <div>
                <h2 className="tst-panel-title">Counselor Operations & Learner Engagement</h2>
                <p className="tst-card-subtitle">
                  Monitor counselor team performance, lead conversion pipeline, active student follow-ups, and counseling logs.
                </p>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <span className="tst-pill success">Counselor Lead: Pooja Patil</span>
                <span className="tst-badge-counter">24 Active Inquiries</span>
              </div>
            </div>

            {/* Counselor Performance Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "22px" }}>
              <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                  Admissions Conversion
                </div>
                <div style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>74.2%</div>
                <div style={{ fontSize: "11px", color: "#059669", marginTop: "2px" }}>14 enrolled / 19 demos</div>
              </div>

              <div style={{ background: "#fffbeb", padding: "16px", borderRadius: "12px", border: "1px solid #fef3c7" }}>
                <div style={{ fontSize: "11.5px", color: "#92400e", fontWeight: 700, textTransform: "uppercase" }}>
                  Pending Callbacks
                </div>
                <div style={{ fontSize: "24px", fontWeight: 800, color: "#78350f", marginTop: "4px" }}>6 Leads</div>
                <div style={{ fontSize: "11px", color: "#b45309", marginTop: "2px" }}>Scheduled for today</div>
              </div>

              <div style={{ background: "#fef2f2", padding: "16px", borderRadius: "12px", border: "1px solid #fecaca" }}>
                <div style={{ fontSize: "11.5px", color: "#991b1b", fontWeight: 700, textTransform: "uppercase" }}>
                  Retention Interventions
                </div>
                <div style={{ fontSize: "24px", fontWeight: 800, color: "#991b1b", marginTop: "4px" }}>3 Students</div>
                <div style={{ fontSize: "11px", color: "#dc2626", marginTop: "2px" }}>Rohan D., Kabir V., Vikas S.</div>
              </div>

              <div style={{ background: "#f0fdf4", padding: "16px", borderRadius: "12px", border: "1px solid #bbf7d0" }}>
                <div style={{ fontSize: "11.5px", color: "#166534", fontWeight: 700, textTransform: "uppercase" }}>
                  Feedback Satisfaction
                </div>
                <div style={{ fontSize: "24px", fontWeight: 800, color: "#14532d", marginTop: "4px" }}>4.85 / 5.0</div>
                <div style={{ fontSize: "11px", color: "#16a34a", marginTop: "2px" }}>Learner onboarding score</div>
              </div>
            </div>

            {/* Counselor Lead Pipeline & Calls Table */}
            <div className="tst-table-wrapper">
              <table className="tst-table">
                <thead>
                  <tr>
                    <th>Prospect / Learner</th>
                    <th>Inquired Track</th>
                    <th>Source</th>
                    <th>Counseling Status</th>
                    <th>Guardian Details</th>
                    <th>Last Counseling Note</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div className="tst-cell-user">
                        <div className="tst-cell-avatar" style={{ background: "#e0f2fe", color: "#0369a1" }}>HS</div>
                        <div className="tst-cell-meta">
                          <span className="tst-cell-name">Harshita Shinde</span>
                          <span className="tst-cell-sub">+91 98221 44556</span>
                        </div>
                      </div>
                    </td>
                    <td>Full-Stack React & Node</td>
                    <td><span className="tst-pill neutral">WhatsApp Demo</span></td>
                    <td><span className="tst-pill warning">Demo Attended</span></td>
                    <td>Sanjay Shinde (Father) • +91 98221 44550</td>
                    <td>"Inquired about upcoming weekend batch. Working in QA, wanting dev transition."</td>
                  </tr>

                  <tr>
                    <td>
                      <div className="tst-cell-user">
                        <div className="tst-cell-avatar" style={{ background: "#e0f2fe", color: "#0369a1" }}>NK</div>
                        <div className="tst-cell-meta">
                          <span className="tst-cell-name">Nikhil Kadam</span>
                          <span className="tst-cell-sub">+91 97654 33211</span>
                        </div>
                      </div>
                    </td>
                    <td>Applied Generative AI & Data</td>
                    <td><span className="tst-pill neutral">Website Assessment</span></td>
                    <td><span className="tst-pill warning">Callback Scheduled</span></td>
                    <td>Sunita Kadam (Mother) • +91 97654 33200</td>
                    <td>"Attended GenAI webinar. Requested consultation on EMI installment milestones."</td>
                  </tr>

                  <tr>
                    <td>
                      <div className="tst-cell-user">
                        <div className="tst-cell-avatar" style={{ background: "#e0f2fe", color: "#0369a1" }}>TG</div>
                        <div className="tst-cell-meta">
                          <span className="tst-cell-name">Tanvi Gadgil</span>
                          <span className="tst-cell-sub">+91 94230 11998</span>
                        </div>
                      </div>
                    </td>
                    <td>DevOps & Cloud Engineering</td>
                    <td><span className="tst-pill neutral">Campus Walk-in</span></td>
                    <td><span className="tst-pill success">Enrolled in Batch DO-05</span></td>
                    <td>Prakash Gadgil (Father) • +91 94230 11990</td>
                    <td>"Enrolled. Welcome pack & credentials dispatched."</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 5: FEES, EMIs & CASH FLOW
            ======================================================== */}
        {activeTab === "fees" && (
          <div className="tst-card-panel">
            <div className="tst-panel-header">
              <div>
                <h2 className="tst-panel-title">Fee Plans, EMIs & Payment History</h2>
                <p className="tst-card-subtitle">
                  Real-time collection overview, upcoming instalments, overdue aging, and automated payment follow-ups.
                </p>
              </div>

              <button
                type="button"
                className="tst-btn-action primary"
                onClick={() => showToast("Exported complete October financial ledger as CSV.")}
              >
                Export Ledger (CSV)
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "20px" }}>
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "16px", borderRadius: "12px" }}>
                <span style={{ fontSize: "12px", color: "#166534", fontWeight: 700 }}>Total Collected Q4</span>
                <div style={{ fontSize: "24px", fontWeight: 800, color: "#14532d", marginTop: "4px" }}>₹1.28 Crores</div>
                <span style={{ fontSize: "11.5px", color: "#15803d" }}>94% of quarterly target achieved</span>
              </div>

              <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", padding: "16px", borderRadius: "12px" }}>
                <span style={{ fontSize: "12px", color: "#92400e", fontWeight: 700 }}>Due in Next 15 Days</span>
                <div style={{ fontSize: "24px", fontWeight: 800, color: "#78350f", marginTop: "4px" }}>₹14,20,000</div>
                <span style={{ fontSize: "11.5px", color: "#b45309" }}>62 active student EMIs</span>
              </div>

              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: "16px", borderRadius: "12px" }}>
                <span style={{ fontSize: "12px", color: "#991b1b", fontWeight: 700 }}>Critical Overdue (&gt;15 days)</span>
                <div style={{ fontSize: "24px", fontWeight: 800, color: "#7f1d1d", marginTop: "4px" }}>₹3,15,000</div>
                <span style={{ fontSize: "11.5px", color: "#b91c1c" }}>Action: Automated notices dispatched</span>
              </div>
            </div>

            <div className="tst-table-wrapper">
              <table className="tst-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Batch</th>
                    <th>Instalment #</th>
                    <th>Amount</th>
                    <th>Due Date</th>
                    <th>Payment Source</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Sneha Joshi</td>
                    <td>Batch FS-09</td>
                    <td>Instalment 3 of 3</td>
                    <td>₹35,000</td>
                    <td>14 Oct 2026</td>
                    <td>UPI / Razorpay</td>
                    <td><span className="tst-pill success">Paid</span></td>
                  </tr>
                  <tr>
                    <td>Rohan Deshmukh</td>
                    <td>Batch FS-09</td>
                    <td>Instalment 2 of 3</td>
                    <td>₹15,000</td>
                    <td>08 Oct 2026</td>
                    <td>Pending</td>
                    <td><span className="tst-pill danger">Overdue (8 days)</span></td>
                  </tr>
                  <tr>
                    <td>Kabir Verma</td>
                    <td>Batch DO-04</td>
                    <td>Instalment 2 of 4</td>
                    <td>₹25,000</td>
                    <td>04 Oct 2026</td>
                    <td>Pending</td>
                    <td><span className="tst-pill danger">Overdue (12 days)</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 6: APPROVALS & AUDIT LOGS
            ======================================================== */}
        {activeTab === "approvals" && (
          <div className="tst-card-panel">
            <div className="tst-panel-header">
              <div>
                <h2 className="tst-panel-title">Action Proposals & Audit Trail</h2>
                <p className="tst-card-subtitle">
                  Review pending institute changes, timetable overrides, fee concessions, and inspect immutable audit logs.
                </p>
              </div>

              <span className="tst-pill success">Audit Log Verification: Active</span>
            </div>

            <div className="tst-proposal-list" style={{ marginBottom: "28px" }}>
              {proposals.map((p) => (
                <div key={p.id} className="tst-proposal-card">
                  <div className="tst-proposal-top">
                    <span className="tst-proposal-type">{p.type}</span>
                    <span className="tst-proposal-time">{p.time}</span>
                  </div>
                  <div className="tst-proposal-title">{p.title}</div>
                  <div className="tst-cell-sub" style={{ marginBottom: "6px" }}>
                    Requested by <strong>{p.author}</strong>
                  </div>
                  <div className="tst-proposal-reason">{p.reason}</div>

                  {p.status === "PENDING" ? (
                    <div className="tst-proposal-actions">
                      <button
                        type="button"
                        className="tst-btn-approve"
                        onClick={() => handleApproveProposal(p.id)}
                      >
                        ✓ Approve Change
                      </button>
                      <button
                        type="button"
                        className="tst-btn-reject"
                        onClick={() => handleRejectProposal(p.id)}
                      >
                        ✕ Reject
                      </button>
                    </div>
                  ) : (
                    <span className={`tst-pill ${p.status === "APPROVED" ? "success" : "danger"}`}>
                      {p.status === "APPROVED" ? "✓ Approved by Owner" : "✕ Rejected"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 7: POLICIES & INSTITUTE SETTINGS
            ======================================================== */}
        {activeTab === "settings" && (
          <div className="tst-card-panel" style={{ maxWidth: "780px" }}>
            <div className="tst-panel-header">
              <div>
                <h2 className="tst-panel-title">Institute Policies & Operational Controls</h2>
                <p className="tst-card-subtitle">
                  Configure attendance thresholds, fee grace periods, automated messaging rules, and AI Copilot autonomy.
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                showToast("Institute policy configuration saved successfully!");
              }}
              style={{ display: "flex", flexDirection: "column", gap: "20px" }}
            >
              <div className="tst-form-group">
                <label className="tst-label">
                  Attendance Minimum Threshold (%): <strong>{attendanceThreshold}%</strong>
                </label>
                <input
                  type="range"
                  min="60"
                  max="90"
                  value={attendanceThreshold}
                  onChange={(e) => setAttendanceThreshold(Number(e.target.value))}
                  style={{ accentColor: "#f59e0b", height: "30px", cursor: "pointer" }}
                />
                <span className="tst-cell-sub">
                  Students falling below this threshold will automatically be placed on the Risk Watch and receive counseling nudges.
                </span>
              </div>

              <div className="tst-form-group">
                <label className="tst-label">
                  Fee Payment Grace Period: <strong>{gracePeriodDays} days</strong>
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  className="tst-input"
                  value={gracePeriodDays}
                  onChange={(e) => setGracePeriodDays(Number(e.target.value))}
                />
                <span className="tst-cell-sub">
                  Days before automated WhatsApp & Email overdue notices are triggered after an instalment date.
                </span>
              </div>

              <div className="tst-form-group">
                <label className="tst-label">Copilot Autonomy Level</label>
                <select
                  className="tst-input tst-select"
                  value={copilotAutonomy}
                  onChange={(e) => setCopilotAutonomy(e.target.value)}
                >
                  <option value="require_approval">Require Owner Approval for all changes (Strict)</option>
                  <option value="auto_reschedule">Auto-resolve room conflicts under 1 hour & notify Owner</option>
                  <option value="full_autonomy">Full AI Pilot with Daily Digest</option>
                </select>
              </div>

              <button type="submit" className="tst-btn-amber-lg" style={{ width: "fit-content", padding: "0 28px" }}>
                Save Policy Configuration
              </button>
            </form>
          </div>
        )}
      </main>

      {/* ========================================================
          MODAL 1: CREATE NEW BATCH
          ======================================================== */}
      {showBatchModal && (
        <div className="tst-modal-backdrop" onClick={() => setShowBatchModal(false)}>
          <div className="tst-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="tst-modal-header">
              <h3 className="tst-modal-title">Create or Modify Batch</h3>
              <button
                type="button"
                className="tst-modal-close"
                onClick={() => setShowBatchModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="tst-form">
              <div className="tst-form-group">
                <label className="tst-label">Batch Name / Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Batch FS-12 (Morning)"
                  className="tst-input"
                  value={newBatchName}
                  onChange={(e) => setNewBatchName(e.target.value)}
                />
              </div>

              <div className="tst-form-group">
                <label className="tst-label">Career Track</label>
                <select
                  className="tst-input tst-select"
                  value={newBatchTrack}
                  onChange={(e) => setNewBatchTrack(e.target.value)}
                >
                  <option value="Full-Stack Software Engineering">Full-Stack Software Engineering</option>
                  <option value="DevOps & Cloud Engineering">DevOps & Cloud Engineering</option>
                  <option value="Applied Generative AI & Data">Applied Generative AI & Data</option>
                  <option value="Microservices with Go">Microservices with Go</option>
                </select>
              </div>

              <div className="tst-form-group">
                <label className="tst-label">Assign Lead Trainer</label>
                <select
                  className="tst-input tst-select"
                  value={newBatchTrainer}
                  onChange={(e) => setNewBatchTrainer(e.target.value)}
                >
                  <option value="Amit Kulkarni">Amit Kulkarni (24h load)</option>
                  <option value="Siddharth V.">Siddharth V. (28h load)</option>
                  <option value="Neha Rao">Neha Rao (20h load)</option>
                </select>
              </div>

              <div className="tst-form-group">
                <label className="tst-label">Assign Room / Lab</label>
                <select
                  className="tst-input tst-select"
                  value={newBatchRoom}
                  onChange={(e) => setNewBatchRoom(e.target.value)}
                >
                  <option value="Lab 101">Lab 101 (40 Cap, Deccan)</option>
                  <option value="Lab 102">Lab 102 (35 Cap, Deccan)</option>
                  <option value="Lab 201">Lab 201 (30 Cap, Deccan)</option>
                  <option value="Seminar Hall 1">Seminar Hall 1 (60 Cap)</option>
                </select>
              </div>

              <div className="tst-form-group">
                <label className="tst-label">Delivery Mode</label>
                <select
                  className="tst-input tst-select"
                  value={newBatchMode}
                  onChange={(e) => setNewBatchMode(e.target.value)}
                >
                  <option value="CLASSROOM">Classroom (In-person Deccan)</option>
                  <option value="HYBRID">Hybrid (In-person + Live Stream)</option>
                  <option value="ONLINE">Online Interactive</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                <button type="submit" className="tst-btn-amber-lg">
                  Confirm & Schedule Batch →
                </button>
                <button
                  type="button"
                  className="tst-btn-outline"
                  onClick={() => setShowBatchModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: ASSIGN TRAINER & ROOM
          ======================================================== */}
      {showAssignModal && (
        <div className="tst-modal-backdrop" onClick={() => setShowAssignModal(false)}>
          <div className="tst-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="tst-modal-header">
              <h3 className="tst-modal-title">Assign Trainer & Room Allocation</h3>
              <button
                type="button"
                className="tst-modal-close"
                onClick={() => setShowAssignModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="tst-form">
              <div className="tst-form-group">
                <label className="tst-label">Select Batch</label>
                <select
                  className="tst-input tst-select"
                  value={assignBatch}
                  onChange={(e) => setAssignBatch(e.target.value)}
                >
                  <option value="Batch FS-11">Batch FS-11 (Microservices)</option>
                  <option value="Batch AI-03">Batch AI-03 (Generative AI)</option>
                  <option value="Batch DO-04">Batch DO-04 (DevOps)</option>
                </select>
              </div>

              <div className="tst-form-group">
                <label className="tst-label">Select Trainer</label>
                <select
                  className="tst-input tst-select"
                  value={assignTrainer}
                  onChange={(e) => setAssignTrainer(e.target.value)}
                >
                  <option value="Amit Kulkarni">Amit Kulkarni (Full Stack)</option>
                  <option value="Neha Rao">Neha Rao (AI & LLMs)</option>
                  <option value="Siddharth V.">Siddharth V. (DevOps)</option>
                </select>
              </div>

              <div className="tst-form-group">
                <label className="tst-label">Select Conflict-Free Room</label>
                <select
                  className="tst-input tst-select"
                  value={assignRoom}
                  onChange={(e) => setAssignRoom(e.target.value)}
                >
                  <option value="Lab 102">Lab 102 (Available 4:00 PM – 6:30 PM)</option>
                  <option value="Lab 201">Lab 201 (Available 3:30 PM – 5:30 PM)</option>
                  <option value="Room 302">Room 302 (Available all day)</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                <button type="submit" className="tst-btn-amber-lg">
                  Save Assignment
                </button>
                <button
                  type="button"
                  className="tst-btn-outline"
                  onClick={() => setShowAssignModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 3: TIMETABLE REVISION & ROLLBACK
          ======================================================== */}
      {showRevisionModal && (
        <div className="tst-modal-backdrop" onClick={() => setShowRevisionModal(false)}>
          <div className="tst-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="tst-modal-header">
              <div>
                <h3 className="tst-modal-title">Publish Timetable Revision</h3>
                <span className="tst-cell-sub">Current active version: Revision #{currentRevision}</span>
              </div>
              <button
                type="button"
                className="tst-modal-close"
                onClick={() => setShowRevisionModal(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "18px" }}>
              <div style={{ fontWeight: 800, fontSize: "14px", color: "#0f172a", marginBottom: "8px" }}>
                Revision #{currentRevision + 1} Pending Changes:
              </div>
              <ul style={{ paddingLeft: "20px", fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
                <li>Lab 204 conflict resolved: Batch AI-03 moved to Lab 102 (4 PM – 6 PM).</li>
                <li>Batch FS-08 Saturday session adjusted from 10:00 AM to 11:30 AM.</li>
                <li>Recording auto-publish pipeline enabled for Room 302.</li>
              </ul>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "space-between" }}>
              <button
                type="button"
                className="tst-btn-amber-lg"
                style={{ width: "auto", padding: "0 20px" }}
                onClick={handlePublishRevision}
              >
                Publish Revision #{currentRevision + 1} →
              </button>

              <button
                type="button"
                className="tst-btn-reject"
                onClick={handleRollbackRevision}
              >
                Roll Back to Rev #{currentRevision - 1}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 4: COPILOT INTERACTIVE QUERY DRAWER
          ======================================================== */}
      {showCopilotDrawer && (
        <div className="tst-modal-backdrop" onClick={() => setShowCopilotDrawer(false)}>
          <div className="tst-modal-card" style={{ maxWidth: "680px" }} onClick={(e) => e.stopPropagation()}>
            <div className="tst-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div className="tst-copilot-spark">AI</div>
                <div>
                  <h3 className="tst-modal-title">Institute Operations Copilot</h3>
                  <span className="tst-cell-sub">Natural language queries across schedules, finance & academics</span>
                </div>
              </div>
              <button
                type="button"
                className="tst-modal-close"
                onClick={() => setShowCopilotDrawer(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <div className="tst-form-group">
                <label className="tst-label">Ask Copilot</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    className="tst-input"
                    placeholder="e.g. Which batches have low attendance this week?"
                    value={copilotPrompt}
                    onChange={(e) => setCopilotPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCopilotQuery(copilotPrompt);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="tst-btn-amber-sm"
                    onClick={() => handleCopilotQuery(copilotPrompt)}
                  >
                    Query
                  </button>
                </div>
              </div>
            </div>

            {/* Response Box */}
            {copilotResponse && (
              <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", padding: "16px", borderRadius: "12px", marginBottom: "16px" }}>
                <div style={{ fontSize: "12px", fontWeight: 800, color: "#b45309", marginBottom: "6px" }}>
                  COPILOT INSIGHT
                </div>
                <p style={{ fontSize: "14px", color: "#1f2937", lineHeight: "1.55", margin: 0 }}>
                  {copilotResponse}
                </p>
              </div>
            )}

            <div style={{ fontSize: "12.5px", color: "#6b7280" }}>
              <strong>Popular Owner Queries:</strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                <button
                  type="button"
                  className="tst-preset-pill"
                  style={{ color: "#111827", background: "#f3f4f6", borderColor: "#e5e7eb" }}
                  onClick={() => handleCopilotQuery("Explain room conflict in Lab 204")}
                >
                  Explain Lab 204 conflict
                </button>
                <button
                  type="button"
                  className="tst-preset-pill"
                  style={{ color: "#111827", background: "#f3f4f6", borderColor: "#e5e7eb" }}
                  onClick={() => handleCopilotQuery("Forecast fee collection for this month")}
                >
                  Forecast fee collection
                </button>
                <button
                  type="button"
                  className="tst-preset-pill"
                  style={{ color: "#111827", background: "#f3f4f6", borderColor: "#e5e7eb" }}
                  onClick={() => handleCopilotQuery("Check trainer capacity and overload")}
                >
                  Check trainer capacity
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="tst-footer" style={{ marginTop: "auto" }}>
        <div className="tst-container">
          <div className="tst-footer-flex">
            <div>© {new Date().getFullYear()} TechSummitTrainers OpsPilot • Owner / Institute Admin Workspace</div>
            <div className="tst-footer-links">
              <Link href="/login">Switch Account</Link>
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
