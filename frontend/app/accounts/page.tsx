"use client";

import React, { useState } from "react";
import Link from "next/link";

interface Transaction {
  id: string;
  studentName: string;
  studentId: string;
  batch: string;
  amount: number;
  mode: "UPI" | "NET_BANKING" | "CREDIT_CARD" | "CASH";
  referenceNo: string;
  status: "VERIFIED" | "PENDING_RECONCILIATION" | "FAILED";
  timestamp: string;
  receiptNo: string;
}

interface OverdueInstalment {
  id: string;
  studentName: string;
  batch: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
  reminderSent: boolean;
  phone: string;
}

interface UnmatchedTxn {
  id: string;
  bankRef: string;
  amount: number;
  time: string;
  senderName: string;
  suggestedStudent: string;
}

export default function AccountsDashboard() {
  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "instalments" | "reconciliation">("overview");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<Transaction | null>(null);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [showCopilotDrawer, setShowCopilotDrawer] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [showActionDropdown, setShowActionDropdown] = useState(false);

  // Form states for new payment
  const [payStudent, setPayStudent] = useState("");
  const [payBatch, setPayBatch] = useState("Batch FS-09");
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState<"UPI" | "NET_BANKING" | "CREDIT_CARD" | "CASH">("UPI");
  const [payRef, setPayRef] = useState("");

  // State: Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: "tx-101",
      studentName: "Sneha Joshi",
      studentId: "TST-2026-089",
      batch: "Batch FS-09",
      amount: 25000,
      mode: "UPI",
      referenceNo: "UPI/261016/894711",
      status: "VERIFIED",
      timestamp: "Today @ 11:20 AM",
      receiptNo: "REC-2026-1049",
    },
    {
      id: "tx-102",
      studentName: "Kunal Sharma",
      studentId: "TST-2026-112",
      batch: "Batch FS-11",
      amount: 30000,
      mode: "NET_BANKING",
      referenceNo: "HDFC984729104",
      status: "VERIFIED",
      timestamp: "Today @ 01:45 PM",
      receiptNo: "REC-2026-1050",
    },
    {
      id: "tx-103",
      studentName: "Rahul Verma",
      studentId: "TST-2026-092",
      batch: "Batch FS-09",
      amount: 15000,
      mode: "UPI",
      referenceNo: "UPI/261016/331089",
      status: "VERIFIED",
      timestamp: "Today @ 02:15 PM",
      receiptNo: "REC-2026-1051",
    },
    {
      id: "tx-104",
      studentName: "Ananya Sen",
      studentId: "TST-2026-044",
      batch: "Batch AI-03",
      amount: 45000,
      mode: "CREDIT_CARD",
      referenceNo: "RAZOR_84920492",
      status: "VERIFIED",
      timestamp: "Today @ 03:00 PM",
      receiptNo: "REC-2026-1052",
    },
  ]);

  // State: Overdue Instalments
  const [overdueList, setOverdueList] = useState<OverdueInstalment[]>([
    {
      id: "ov-1",
      studentName: "Vikram Malhotra",
      batch: "Batch FS-08",
      amount: 15000,
      dueDate: "Oct 05, 2026",
      daysOverdue: 11,
      reminderSent: false,
      phone: "+91 98234 10923",
    },
    {
      id: "ov-2",
      studentName: "Rohan Joshi",
      batch: "Batch CLOUD-02",
      amount: 18000,
      dueDate: "Oct 08, 2026",
      daysOverdue: 8,
      reminderSent: false,
      phone: "+91 97654 81920",
    },
    {
      id: "ov-3",
      studentName: "Priya Nair",
      batch: "Batch FS-09",
      amount: 12500,
      dueDate: "Oct 09, 2026",
      daysOverdue: 7,
      reminderSent: true,
      phone: "+91 91234 56789",
    },
  ]);

  // State: Unmatched Transactions
  const [unmatchedList, setUnmatchedList] = useState<UnmatchedTxn[]>([
    {
      id: "un-1",
      bankRef: "UPI/948201/ICICI_TRANSFER",
      amount: 25000,
      time: "10:14 AM",
      senderName: "Sanjay Kumar Verma",
      suggestedStudent: "Rahul Verma (Father)",
    },
    {
      id: "un-2",
      bankRef: "NEFT/SBIN84920481",
      amount: 15000,
      time: "01:25 PM",
      senderName: "Gita Joshi",
      suggestedStudent: "Sneha Joshi (Mother)",
    },
  ]);

  // Copilot messages & state
  const [copilotInput, setCopilotInput] = useState("");
  const [copilotMessages, setCopilotMessages] = useState<Array<{ sender: "user" | "copilot"; text: string; rbacWarning?: boolean }>>([
    {
      sender: "copilot",
      text: "Hello Suresh! I am your Accounts & Financial Copilot. I can query fee collections, overdue instalment ageing, bank reconciliation exceptions, and broadcast payment reminders. How can I assist with institute finance today?",
    },
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Record payment
  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payStudent.trim() || !payAmount) return;

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      studentName: payStudent,
      studentId: `TST-2026-${Math.floor(100 + Math.random() * 900)}`,
      batch: payBatch,
      amount: parseFloat(payAmount),
      mode: payMode,
      referenceNo: payRef || `REF/${Date.now().toString().slice(-6)}`,
      status: "VERIFIED",
      timestamp: "Just now",
      receiptNo: `REC-2026-${Math.floor(1055 + Math.random() * 50)}`,
    };

    setTransactions([newTx, ...transactions]);
    setShowPaymentModal(false);
    setPayStudent("");
    setPayAmount("");
    setPayRef("");
    showToast(`Payment of ₹${newTx.amount.toLocaleString("en-IN")} recorded & verified!`);
  };

  // Reconcile unmatched transaction
  const handleReconcile = (id: string, studentName: string) => {
    setUnmatchedList((prev) => prev.filter((u) => u.id !== id));
    showToast(`Transaction matched & allocated to ${studentName}!`);
  };

  // Send reminder
  const handleSendReminder = (id: string, name: string) => {
    setOverdueList((prev) =>
      prev.map((o) => (o.id === id ? { ...o, reminderSent: true } : o))
    );
    showToast(`WhatsApp & SMS fee reminder dispatched to ${name}!`);
  };

  // Copilot query handler with Accounts RBAC enforcement
  const handleSendCopilot = (questionText?: string) => {
    const q = questionText || copilotInput;
    if (!q.trim()) return;

    const userMsg = { sender: "user" as const, text: q };
    setCopilotMessages((prev) => [...prev, userMsg]);
    setCopilotInput("");

    const lower = q.toLowerCase();
    const isAcademicRestricted =
      lower.includes("recording") ||
      lower.includes("video") ||
      lower.includes("evaluations") ||
      lower.includes("classroom notes") ||
      lower.includes("private trainer");

    setTimeout(() => {
      if (isAcademicRestricted) {
        setCopilotMessages((prev) => [
          ...prev,
          {
            sender: "copilot",
            text: "Classroom recordings, detailed academic evaluations, and private trainer notes are restricted for the Accounts Staff role. I can provide fee collection and instalment status instead.",
            rbacWarning: true,
          },
        ]);
      } else if (lower.includes("overdue") || lower.includes("10,000") || lower.includes("seven days") || lower.includes("reminder")) {
        setCopilotMessages((prev) => [
          ...prev,
          {
            sender: "copilot",
            text: `Here are the instalments above ₹10,000 overdue by more than 7 days without a reminder:\n\n1. **Vikram Malhotra** (Batch FS-08) - ₹15,000 overdue by 11 days (Due Oct 5). No reminder sent.\n2. **Rohan Joshi** (Batch CLOUD-02) - ₹18,000 overdue by 8 days (Due Oct 8). No reminder sent.\n\nTotal overdue across these 2 students: ₹33,000.\n\nWould you like me to broadcast automated WhatsApp payment reminders with UPI payment links now?`,
          },
        ]);
      } else {
        setCopilotMessages((prev) => [
          ...prev,
          {
            sender: "copilot",
            text: `Today's collections total ₹1,45,000 against a weekly target of ₹4,20,000. 12 pending instalment reminders are queued for dispatch, and 2 unmatched UPI transactions require reconciliation.`,
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
                <span className="tst-context-tag" style={{ borderLeftColor: "#f59e0b" }}>Accounts Cockpit</span>
              </div>
            </Link>
          </div>

          {/* Right Header: Notification Bell + SD Avatar */}
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
              title="Financial Notifications"
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
                2
              </span>
            </button>

            {/* SD Avatar badge on far-right */}
            <div
              className="tst-avatar-badge"
              style={{
                width: "36px",
                height: "36px",
                fontSize: "13px",
                fontWeight: 800,
                background: "#0284c7",
                color: "#ffffff",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(2, 132, 199, 0.3)",
              }}
              title="Suresh Deshmukh (Head of Accounts & Billing)"
            >
              SD
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
            <span style={{ fontSize: "15px", fontWeight: 800, color: "#111827" }}>Finance Alerts</span>
            <span style={{ background: "#fef3c7", color: "#b45309", fontSize: "11px", fontWeight: 800, padding: "2px 8px", borderRadius: "9999px" }}>
              2 Exceptions
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
          {/* Unmatched UPI Warning */}
          <div style={{ background: "#ffffff", border: "1px solid #fed7aa", borderLeft: "4px solid #f59e0b", borderRadius: "14px", padding: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>
              <span style={{ fontWeight: 800, color: "#92400e" }}>⚠️ 2 Unmatched UPI Payments</span>
              <span>Today</span>
            </div>
            <div style={{ fontSize: "12.5px", color: "#1f2937", lineHeight: 1.4, marginBottom: "8px" }}>
              ₹40,000 received in HDFC Current A/C without student admission registration code.
            </div>
            <button
              type="button"
              className="tst-btn-action primary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => {
                setActiveTab("reconciliation");
                setShowNotificationPanel(false);
              }}
            >
              Reconcile Bank Transfers →
            </button>
          </div>

          {/* Calendar Widget */}
          <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "14px", padding: "14px" }}>
            <div style={{ fontWeight: 800, fontSize: "13.5px", color: "#111827", marginBottom: "4px" }}>Friday, 16 October 2026</div>
            <div style={{ fontSize: "12px", color: "#6b7280" }}>₹1,45,000 Collected Today • 18 Instalments Due This Week</div>
          </div>
        </div>
      </aside>

      {/* 5-Item Non-Scrollable Subnav Bar */}
      <nav className="tst-subnav-bar">
        <div className="tst-subnav-container" style={{ maxWidth: "100%", width: "100%", padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="tst-tab-list" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* 1. Financial Cockpit */}
            <button
              type="button"
              className={`tst-nav-tab ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              <span>Financial Cockpit</span>
            </button>

            {/* 2. Transactions & Receipts */}
            <button
              type="button"
              className={`tst-nav-tab ${activeTab === "transactions" ? "active" : ""}`}
              onClick={() => setActiveTab("transactions")}
            >
              <span>Transactions &amp; Receipts</span>
              <span className="tst-pill success" style={{ fontSize: "11px", padding: "1px 6px", marginLeft: "4px" }}>4 Today</span>
            </button>

            {/* 3. Overdue Instalments */}
            <button
              type="button"
              className={`tst-nav-tab ${activeTab === "instalments" ? "active" : ""}`}
              onClick={() => setActiveTab("instalments")}
            >
              <span>Overdue Instalments</span>
              <span className="tst-badge-alert" style={{ marginLeft: "4px" }}>{overdueList.length} Overdue</span>
            </button>

            {/* 4. Bank Reconciliation */}
            <button
              type="button"
              className={`tst-nav-tab ${activeTab === "reconciliation" ? "active" : ""}`}
              onClick={() => setActiveTab("reconciliation")}
            >
              <span>Bank Reconciliation</span>
              <span className="tst-tab-counter" style={{ marginLeft: "4px" }}>{unmatchedList.length} Unmatched</span>
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
              <span>+ Financial Action</span>
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
                  minWidth: "260px",
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
                    setShowPaymentModal(true);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "9px 12px", background: "transparent", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fffbeb")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span>💳</span>
                  <div>
                    <div>Record &amp; Verify Payment</div>
                    <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 500 }}>Issue receipt &amp; update ledger</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowActionDropdown(false);
                    showToast("Importing ICICI & HDFC daily statement...");
                  }}
                  style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "9px 12px", background: "transparent", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fffbeb")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span>🏦</span>
                  <div>
                    <div>Import Bank Statement</div>
                    <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 500 }}>Auto-reconcile UPI &amp; NEFT</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowActionDropdown(false);
                    showToast("12 WhatsApp payment reminders queued for overdue students!");
                  }}
                  style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "9px 12px", background: "transparent", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fffbeb")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span>📢</span>
                  <div>
                    <div>Broadcast Overdue Reminders</div>
                    <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 500 }}>Send WhatsApp &amp; SMS alerts</div>
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
                    <div>Financial Copilot</div>
                    <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 500 }}>Query ageing &amp; fee reports</div>
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
          <span><strong>Accounts Staff Scope Active:</strong> Full access to fee schedules, collections, receipts, and reconciliations. Classroom video recordings, academic evaluations, and private trainer notes are strictly restricted.</span>
        </div>
        <button
          type="button"
          onClick={() => setShowCopilotDrawer(true)}
          style={{ background: "#ffffff", border: "1px solid #86efac", color: "#166534", fontWeight: 700, borderRadius: "6px", padding: "3px 10px", cursor: "pointer" }}
        >
          Ask Accounts Copilot ✨
        </button>
      </div>

      {/* Main Workspace Body */}
      <main style={{ maxWidth: "100%", width: "100%", padding: "24px 28px", flex: 1 }}>
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Top 4 Financial Metric Cards (Widgets 1, 2, 3, 4) */}
            <div className="tst-metrics-grid">
              {/* WIDGET 1: Collections Received Today */}
              <div className="tst-metric-card">
                <div className="tst-metric-header">
                  <span className="tst-metric-label">Collections Today</span>
                  <div className="tst-metric-icon">💰</div>
                </div>
                <div className="tst-metric-value">₹1,45,000</div>
                <div className="tst-metric-footer">
                  <span className="tst-pill success">4 Verified</span>
                  <span style={{ fontSize: "12px", color: "#6b7280" }}>Across UPI &amp; Cards</span>
                </div>
              </div>

              {/* WIDGET 2: Instalments Due This Week */}
              <div className="tst-metric-card">
                <div className="tst-metric-header">
                  <span className="tst-metric-label">Due This Week</span>
                  <div className="tst-metric-icon">📅</div>
                </div>
                <div className="tst-metric-value">₹3,80,000</div>
                <div className="tst-metric-footer">
                  <span className="tst-badge-counter">18 Students</span>
                  <span style={{ fontSize: "12px", color: "#6b7280" }}>Due by Sunday</span>
                </div>
              </div>

              {/* WIDGET 3: Total Overdue Amount */}
              <div className="tst-metric-card">
                <div className="tst-metric-header">
                  <span className="tst-metric-label">Total Overdue</span>
                  <div className="tst-metric-icon">⚠️</div>
                </div>
                <div className="tst-metric-value" style={{ color: "#b45309" }}>₹6,20,000</div>
                <div className="tst-metric-footer">
                  <span className="tst-badge-alert">3 Urgent Cases</span>
                  <span style={{ fontSize: "12px", color: "#6b7280" }}>&gt;7 Days late</span>
                </div>
              </div>

              {/* WIDGET 4: Unmatched Payment Transactions */}
              <div className="tst-metric-card">
                <div className="tst-metric-header">
                  <span className="tst-metric-label">Unmatched Bank Txns</span>
                  <div className="tst-metric-icon">🔍</div>
                </div>
                <div className="tst-metric-value">{unmatchedList.length} Txns</div>
                <div className="tst-metric-footer">
                  <span className="tst-pill alert">₹40,000</span>
                  <span style={{ fontSize: "12px", color: "#6b7280" }}>Needs student match</span>
                </div>
              </div>
            </div>

            {/* Split Dashboard: Collections & Overdue Breakdown */}
            <div className="tst-dashboard-grid">
              {/* Left Column: Recent Transactions & Collection Trend by Batch (Widget 7) */}
              <div className="tst-col-stack">
                <div className="tst-card-panel">
                  <div className="tst-panel-header">
                    <div className="tst-panel-title-group">
                      <h2 className="tst-panel-title">Today&apos;s Verified Payment Transactions</h2>
                      <span className="tst-pill success">Real-time Feed</span>
                    </div>
                    <button
                      type="button"
                      className="tst-btn-action primary"
                      style={{ padding: "4px 10px", fontSize: "11.5px" }}
                      onClick={() => setShowPaymentModal(true)}
                    >
                      + Record Payment
                    </button>
                  </div>

                  <div className="tst-table-wrapper">
                    <table className="tst-table">
                      <thead>
                        <tr>
                          <th>Student &amp; Batch</th>
                          <th>Amount</th>
                          <th>Mode &amp; Ref</th>
                          <th>Receipt No.</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((tx) => (
                          <tr key={tx.id}>
                            <td>
                              <strong>{tx.studentName}</strong>
                              <div className="tst-cell-sub">{tx.batch} • {tx.studentId}</div>
                            </td>
                            <td>
                              <strong style={{ color: "#047857" }}>₹{tx.amount.toLocaleString("en-IN")}</strong>
                            </td>
                            <td>
                              <span className="tst-badge-counter">{tx.mode}</span>
                              <div className="tst-cell-sub">{tx.referenceNo}</div>
                            </td>
                            <td>{tx.receiptNo}</td>
                            <td>
                              <button
                                type="button"
                                className="tst-btn-action"
                                style={{ padding: "4px 8px", fontSize: "11px" }}
                                onClick={() => {
                                  setActiveReceipt(tx);
                                  setShowReceiptModal(true);
                                }}
                              >
                                View Receipt
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* WIDGET 7: Collection Trend by Batch */}
                <div className="tst-card-panel">
                  <div className="tst-panel-header">
                    <div className="tst-panel-title-group">
                      <h2 className="tst-panel-title">Collection Rate by Batch</h2>
                    </div>
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>Q4 2026 Batch Targets</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "8px 0" }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 700, marginBottom: "5px" }}>
                        <span>Batch FS-09 (Full Stack Web)</span>
                        <span style={{ color: "#047857" }}>94% Collected (₹18.8L / ₹20L)</span>
                      </div>
                      <div style={{ width: "100%", height: "8px", background: "#f3f4f6", borderRadius: "9999px", overflow: "hidden" }}>
                        <div style={{ width: "94%", height: "100%", background: "#10b981", borderRadius: "9999px" }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 700, marginBottom: "5px" }}>
                        <span>Batch AI-03 (Generative AI Masterclass)</span>
                        <span style={{ color: "#047857" }}>88% Collected (₹14.0L / ₹16L)</span>
                      </div>
                      <div style={{ width: "100%", height: "8px", background: "#f3f4f6", borderRadius: "9999px", overflow: "hidden" }}>
                        <div style={{ width: "88%", height: "100%", background: "#10b981", borderRadius: "9999px" }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 700, marginBottom: "5px" }}>
                        <span>Batch DevOps-04 (Cloud Engineering)</span>
                        <span style={{ color: "#b45309" }}>72% Collected (₹8.6L / ₹12L)</span>
                      </div>
                      <div style={{ width: "100%", height: "8px", background: "#f3f4f6", borderRadius: "9999px", overflow: "hidden" }}>
                        <div style={{ width: "72%", height: "100%", background: "#f59e0b", borderRadius: "9999px" }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Overdue Follow-ups (Widget 6) & Unmatched UPI (Widget 4) */}
              <div className="tst-col-stack">
                {/* WIDGET 6: Pending Payment Reminders */}
                <div className="tst-card-panel">
                  <div className="tst-panel-header">
                    <div className="tst-panel-title-group">
                      <h2 className="tst-panel-title">Pending Payment Reminders</h2>
                      <span className="tst-badge-alert">{overdueList.length} Due</span>
                    </div>
                    <button
                      type="button"
                      className="tst-btn-action"
                      style={{ padding: "4px 8px", fontSize: "11px" }}
                      onClick={() => handleSendCopilot("Which instalments above ₹10,000 are overdue by more than seven days and have not received a reminder?")}
                    >
                      Copilot Filter ✨
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {overdueList.map((item) => (
                      <div
                        key={item.id}
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
                            <span style={{ fontWeight: 800, fontSize: "13.5px", color: "#111827" }}>{item.studentName}</span>
                            <span style={{ fontSize: "11.5px", color: "#6b7280", marginLeft: "6px" }}>({item.batch})</span>
                          </div>
                          <strong style={{ color: "#b45309", fontSize: "13.5px" }}>₹{item.amount.toLocaleString("en-IN")}</strong>
                        </div>
                        <div style={{ fontSize: "12px", color: "#4b5563" }}>
                          Due Date: <strong>{item.dueDate}</strong> ({item.daysOverdue} days overdue)
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "4px" }}>
                          <span style={{ fontSize: "11.5px", color: item.reminderSent ? "#047857" : "#6b7280" }}>
                            {item.reminderSent ? "✓ Reminder Sent" : "No reminder sent yet"}
                          </span>
                          <button
                            type="button"
                            className="tst-btn-action primary"
                            style={{ padding: "3px 9px", fontSize: "11px" }}
                            onClick={() => handleSendReminder(item.id, item.studentName)}
                          >
                            Send WhatsApp Nudge
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* WIDGET 8: Bank Reconciliation Exceptions */}
                <div className="tst-card-panel">
                  <div className="tst-panel-header">
                    <div className="tst-panel-title-group">
                      <h2 className="tst-panel-title">Bank Reconciliation Discrepancies</h2>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {unmatchedList.map((un) => (
                      <div
                        key={un.id}
                        style={{
                          padding: "12px",
                          background: "#f9fafb",
                          border: "1px solid #e5e7eb",
                          borderRadius: "10px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 700, fontSize: "13px", color: "#111827" }}>₹{un.amount.toLocaleString("en-IN")} via {un.bankRef}</span>
                          <span style={{ fontSize: "11px", color: "#6b7280" }}>{un.time}</span>
                        </div>
                        <div style={{ fontSize: "11.5px", color: "#6b7280" }}>
                          Sender: <strong>{un.senderName}</strong> • Suggested Match: <strong style={{ color: "#d97706" }}>{un.suggestedStudent}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "4px" }}>
                          <button
                            type="button"
                            className="tst-btn-action primary"
                            style={{ padding: "4px 10px", fontSize: "11.5px" }}
                            onClick={() => handleReconcile(un.id, un.suggestedStudent)}
                          >
                            Confirm Match &amp; Allocate
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Transactions & Receipts */}
        {activeTab === "transactions" && (
          <div className="tst-card-panel">
            <div className="tst-panel-header">
              <div className="tst-panel-title-group">
                <h2 className="tst-panel-title">Payment Transactions &amp; Digital Receipts</h2>
                <span className="tst-pill success">{transactions.length} Total Verified</span>
              </div>
              <button
                type="button"
                className="tst-btn-action primary"
                onClick={() => setShowPaymentModal(true)}
              >
                + Record New Payment
              </button>
            </div>

            <div className="tst-table-wrapper">
              <table className="tst-table">
                <thead>
                  <tr>
                    <th>Receipt No.</th>
                    <th>Student Name</th>
                    <th>Batch</th>
                    <th>Amount</th>
                    <th>Payment Mode</th>
                    <th>Reference Code</th>
                    <th>Timestamp</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td><strong>{tx.receiptNo}</strong></td>
                      <td>{tx.studentName}</td>
                      <td><span className="tst-badge-counter">{tx.batch}</span></td>
                      <td><strong style={{ color: "#047857" }}>₹{tx.amount.toLocaleString("en-IN")}</strong></td>
                      <td>{tx.mode}</td>
                      <td><code>{tx.referenceNo}</code></td>
                      <td>{tx.timestamp}</td>
                      <td>
                        <button
                          type="button"
                          className="tst-btn-action"
                          style={{ padding: "4px 8px", fontSize: "11px" }}
                          onClick={() => {
                            setActiveReceipt(tx);
                            setShowReceiptModal(true);
                          }}
                        >
                          Print / Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Overdue Instalments */}
        {activeTab === "instalments" && (
          <div className="tst-card-panel">
            <div className="tst-panel-header">
              <div className="tst-panel-title-group">
                <h2 className="tst-panel-title">Overdue Instalment Ageing &amp; Reminders</h2>
                <span className="tst-badge-alert">{overdueList.length} Active Overdue</span>
              </div>
              <button
                type="button"
                className="tst-btn-action primary"
                onClick={() => showToast("Overdue WhatsApp reminder batch dispatched!")}
              >
                Broadcast Batch Reminders 📢
              </button>
            </div>

            <div className="tst-table-wrapper">
              <table className="tst-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Batch</th>
                    <th>Phone</th>
                    <th>Overdue Amount</th>
                    <th>Due Date</th>
                    <th>Ageing</th>
                    <th>Reminder Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {overdueList.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.studentName}</strong></td>
                      <td>{item.batch}</td>
                      <td>{item.phone}</td>
                      <td><strong style={{ color: "#b45309" }}>₹{item.amount.toLocaleString("en-IN")}</strong></td>
                      <td>{item.dueDate}</td>
                      <td>
                        <span className="tst-badge-alert">{item.daysOverdue} Days Late</span>
                      </td>
                      <td>
                        {item.reminderSent ? (
                          <span className="tst-pill success">Dispatched</span>
                        ) : (
                          <span className="tst-badge-counter">Pending</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="tst-btn-action primary"
                          style={{ padding: "4px 8px", fontSize: "11px" }}
                          onClick={() => handleSendReminder(item.id, item.studentName)}
                        >
                          Send WhatsApp
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Bank Reconciliation */}
        {activeTab === "reconciliation" && (
          <div className="tst-card-panel">
            <div className="tst-panel-header">
              <div className="tst-panel-title-group">
                <h2 className="tst-panel-title">Automated Bank &amp; UPI Reconciliation Feed</h2>
                <span className="tst-pill success">ICICI Current A/C • HDFC Escrow</span>
              </div>
              <button
                type="button"
                className="tst-btn-action"
                onClick={() => showToast("Bank statements synchronized with payment gateway!")}
              >
                Sync Gateway Feed ↻
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
              {unmatchedList.map((un) => (
                <div
                  key={un.id}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #fed7aa",
                    borderLeft: "4px solid #f59e0b",
                    borderRadius: "12px",
                    padding: "16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                      <strong style={{ fontSize: "15px", color: "#111827" }}>₹{un.amount.toLocaleString("en-IN")}</strong>
                      <span className="tst-badge-counter">{un.bankRef}</span>
                      <span style={{ fontSize: "11px", color: "#6b7280" }}>{un.time}</span>
                    </div>
                    <div style={{ fontSize: "12.5px", color: "#4b5563" }}>
                      Payer: <strong>{un.senderName}</strong> • Suggested student mapping: <strong style={{ color: "#d97706" }}>{un.suggestedStudent}</strong>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      className="tst-btn-action primary"
                      onClick={() => handleReconcile(un.id, un.suggestedStudent)}
                    >
                      Allocate to Student →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: Record & Verify Payment */}
      {showPaymentModal && (
        <div className="tst-modal-backdrop" onClick={() => setShowPaymentModal(false)}>
          <div className="tst-modal-card" style={{ maxWidth: "520px" }} onClick={(e) => e.stopPropagation()}>
            <div className="tst-modal-header">
              <h3 className="tst-modal-title">Record &amp; Verify Student Payment</h3>
              <button type="button" className="tst-modal-close" onClick={() => setShowPaymentModal(false)}>✕</button>
            </div>

            <form onSubmit={handleRecordPayment}>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", margin: "16px 0" }}>
                <div>
                  <label className="tst-form-label">Student Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sneha Joshi"
                    value={payStudent}
                    onChange={(e) => setPayStudent(e.target.value)}
                    className="tst-form-input"
                  />
                </div>

                <div>
                  <label className="tst-form-label">Batch</label>
                  <select value={payBatch} onChange={(e) => setPayBatch(e.target.value)} className="tst-form-select">
                    <option value="Batch FS-09">Batch FS-09 (Full Stack Web)</option>
                    <option value="Batch FS-11">Batch FS-11 (React &amp; Node)</option>
                    <option value="Batch AI-03">Batch AI-03 (Generative AI)</option>
                    <option value="Batch CLOUD-02">Batch CLOUD-02 (AWS &amp; DevOps)</option>
                  </select>
                </div>

                <div>
                  <label className="tst-form-label">Amount (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="25000"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="tst-form-input"
                  />
                </div>

                <div>
                  <label className="tst-form-label">Payment Mode</label>
                  <select
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value as any)}
                    className="tst-form-select"
                  >
                    <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
                    <option value="NET_BANKING">Net Banking (NEFT / RTGS / IMPS)</option>
                    <option value="CREDIT_CARD">Credit / Debit Card</option>
                    <option value="CASH">Cash Deposit</option>
                  </select>
                </div>

                <div>
                  <label className="tst-form-label">Transaction Reference / UTR Number</label>
                  <input
                    type="text"
                    placeholder="UPI/261016/894711"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    className="tst-form-input"
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" className="tst-btn-action" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                <button type="submit" className="tst-btn-action primary">Confirm &amp; Generate Receipt</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Receipt Preview */}
      {showReceiptModal && activeReceipt && (
        <div className="tst-modal-backdrop" onClick={() => setShowReceiptModal(false)}>
          <div className="tst-modal-card" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
            <div className="tst-modal-header">
              <h3 className="tst-modal-title">Fee Payment Receipt</h3>
              <button type="button" className="tst-modal-close" onClick={() => setShowReceiptModal(false)}>✕</button>
            </div>

            <div style={{ padding: "16px", background: "#f9fafb", borderRadius: "12px", border: "1px solid #e5e7eb", margin: "14px 0" }}>
              <div style={{ textAlign: "center", borderBottom: "1px dashed #d1d5db", paddingBottom: "12px", marginBottom: "12px" }}>
                <div style={{ fontWeight: 800, fontSize: "16px", color: "#111827" }}>TechSummitTrainers</div>
                <div style={{ fontSize: "11.5px", color: "#6b7280" }}>FC Road, Shivajinagar, Pune • GSTIN: 27AABCT8921M1Z</div>
                <div style={{ fontSize: "12px", fontWeight: 700, marginTop: "4px", color: "#047857" }}>{activeReceipt.receiptNo}</div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12.5px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#6b7280" }}>Student Name:</span>
                  <strong>{activeReceipt.studentName}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#6b7280" }}>Batch Track:</span>
                  <span>{activeReceipt.batch}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#6b7280" }}>Payment Mode:</span>
                  <span>{activeReceipt.mode}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#6b7280" }}>Reference / UTR:</span>
                  <code>{activeReceipt.referenceNo}</code>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e5e7eb", paddingTop: "8px", marginTop: "4px" }}>
                  <span style={{ fontWeight: 800 }}>Total Amount Paid:</span>
                  <strong style={{ fontSize: "15px", color: "#047857" }}>₹{activeReceipt.amount.toLocaleString("en-IN")}</strong>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="tst-btn-action primary"
                onClick={() => {
                  showToast(`Receipt ${activeReceipt.receiptNo} downloaded as PDF!`);
                  setShowReceiptModal(false);
                }}
              >
                Download Receipt PDF 📥
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accounts Copilot Side Drawer */}
      {showCopilotDrawer && (
        <>
          <div className="tst-win-panel-backdrop" onClick={() => setShowCopilotDrawer(false)} />
          <aside className="tst-win-notification-panel open" style={{ width: "440px" }}>
            <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "16px" }}>✨</span>
                <span style={{ fontWeight: 800, fontSize: "15px", color: "#111827" }}>Accounts Financial Copilot</span>
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
                onClick={() => handleSendCopilot("Which instalments above ₹10,000 are overdue by more than seven days and have not received a reminder?")}
                style={{ background: "#ffffff", border: "1px solid #d1d5db", borderRadius: "9999px", padding: "4px 10px", fontSize: "11px", fontWeight: 600, color: "#374151", cursor: "pointer" }}
              >
                🔍 Overdue &gt;₹10k query
              </button>
              <button
                type="button"
                onClick={() => handleSendCopilot("Show me the private trainer notes and classroom recordings for Batch FS-09")}
                style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "9999px", padding: "4px 10px", fontSize: "11px", fontWeight: 700, color: "#9f1239", cursor: "pointer" }}
              >
                🚫 Test Academic Access (RBAC)
              </button>
            </div>

            {/* Input Bar */}
            <div style={{ padding: "12px 16px", borderTop: "1px solid #e5e7eb", display: "flex", gap: "8px" }}>
              <input
                type="text"
                placeholder="Ask Accounts Copilot..."
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
