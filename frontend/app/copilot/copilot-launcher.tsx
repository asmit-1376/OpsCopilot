"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import styles from "./copilot-launcher.module.css";

type Thread = { id: string; title: string; updatedAt: string; activeRequestId: string | null };
type Proposal = {
  id: string;
  status: string;
  expiresAt?: string | null;
  recipientName: string;
  recipientMaskedMobile: string;
  message: string;
};
type Message = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  status: "STREAMING" | "COMPLETED" | "FAILED" | "CANCELLED";
  proposals: Proposal[];
};

function errorMessage(value: unknown, fallback: string) {
  return value && typeof value === "object" && "error" in value && typeof value.error === "string"
    ? value.error
    : fallback;
}

async function responseJson(response: Response) {
  const raw = await response.text();
  try {
    return raw ? JSON.parse(raw) as Record<string, unknown> : {};
  } catch {
    throw new Error(`Unexpected server response (HTTP ${response.status}).`);
  }
}

function RobotIcon() {
  return <svg viewBox="0 0 32 32" aria-hidden="true" className={styles.robotIcon}>
    <path d="M16 4v4M13.5 4h5" />
    <rect x="5.5" y="9" width="21" height="17" rx="6" />
    <path d="M10 27v2m12-2v2M2.5 15v5m27-5v5" />
    <circle cx="12" cy="16" r="1.3" className={styles.robotEye} />
    <circle cx="20" cy="16" r="1.3" className={styles.robotEye} />
    <path d="M12 21h8" />
  </svg>;
}

export default function CopilotLauncher() {
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [workingProposalId, setWorkingProposalId] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const openCopilot = () => setOpen(true);
    window.addEventListener("ops-copilot:open", openCopilot);
    return () => window.removeEventListener("ops-copilot:open", openCopilot);
  }, []);

  const loadThreads = useCallback(async (preferredId?: string) => {
    setLoadingThreads(true);
    try {
      const response = await fetch("/api/copilot/threads", { cache: "no-store" });
      const result = await responseJson(response);
      if (!response.ok) throw new Error(errorMessage(result, "Could not load conversations."));
      const rows = Array.isArray(result.threads) ? result.threads as Thread[] : [];
      setThreads(rows);
      const nextId = preferredId && rows.some((thread) => thread.id === preferredId)
        ? preferredId
        : selectedThreadId && rows.some((thread) => thread.id === selectedThreadId)
          ? selectedThreadId
          : rows[0]?.id ?? "";
      setSelectedThreadId(nextId);
      return nextId;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load conversations.");
      return "";
    } finally {
      setLoadingThreads(false);
    }
  }, [selectedThreadId]);

  const loadMessages = useCallback(async (threadId: string) => {
    if (!threadId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    setError("");
    try {
      const response = await fetch(`/api/copilot/threads/${threadId}`, { cache: "no-store" });
      const result = await responseJson(response);
      if (!response.ok) throw new Error(errorMessage(result, "Could not load this conversation."));
      setMessages(Array.isArray(result.messages) ? result.messages as Message[] : []);
    } catch (reason) {
      setMessages([]);
      setError(reason instanceof Error ? reason.message : "Could not load this conversation.");
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => { void loadThreads(); }, 0);
    return () => window.clearTimeout(timer);
  }, [open, loadThreads]);

  useEffect(() => {
    if (!open || !selectedThreadId || streaming) return;
    const timer = window.setTimeout(() => {
      void loadMessages(selectedThreadId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, selectedThreadId, loadMessages, streaming]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, status]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function createThread() {
    setError("");
    try {
      const response = await fetch("/api/copilot/threads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = await responseJson(response);
      if (!response.ok || !result.thread || typeof result.thread !== "object") {
        throw new Error(errorMessage(result, "Could not start a new conversation."));
      }
      const thread = result.thread as Thread;
      setThreads((current) => [thread, ...current.filter((item) => item.id !== thread.id)]);
      setSelectedThreadId(thread.id);
      setMessages([]);
      setStatus("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not start a new conversation.");
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || streaming) return;
    setError("");
    setStatus("Starting Copilot…");

    let threadId = selectedThreadId;
    if (!threadId) {
      try {
        const response = await fetch("/api/copilot/threads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
        const result = await responseJson(response);
        if (!response.ok || !result.thread || typeof result.thread !== "object") {
          throw new Error(errorMessage(result, "Could not start a new conversation."));
        }
        const thread = result.thread as Thread;
        threadId = thread.id;
        setThreads((current) => [thread, ...current]);
        setSelectedThreadId(threadId);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not start a new conversation.");
        setStatus("");
        return;
      }
    }

    const userMessage: Message = { id: crypto.randomUUID(), role: "USER", content, status: "COMPLETED", proposals: [] };
    const assistantMessage: Message = { id: crypto.randomUUID(), role: "ASSISTANT", content: "", status: "STREAMING", proposals: [] };
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setDraft("");
    setStreaming(true);
    const aborter = new AbortController();
    abortRef.current = aborter;
    try {
      const response = await fetch(`/api/copilot/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ content }),
        signal: aborter.signal,
      });
      if (!response.ok || !response.body) {
        const result = await responseJson(response);
        throw new Error(errorMessage(result, "Copilot could not start this request."));
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamError = "";
      const handleFrame = (frame: string) => {
        let event = "message";
        const data: string[] = [];
        for (const line of frame.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
        }
        if (!data.length) return;
        let value: Record<string, unknown>;
        try { value = JSON.parse(data.join("\n")) as Record<string, unknown>; }
        catch { streamError = "Copilot returned an unreadable update."; return; }
        if (event === "status" && typeof value.message === "string") setStatus(value.message);
        if (event === "token" && typeof value.text === "string") {
          setMessages((current) => current.map((message) => message.id === assistantMessage.id ? { ...message, content: message.content + value.text } : message));
        }
        if (event === "proposal" && typeof value.id === "string") {
          const proposal = value as unknown as Proposal;
          setMessages((current) => current.map((message) => message.id === assistantMessage.id ? { ...message, proposals: [...message.proposals, proposal] } : message));
        }
        if (event === "error") streamError = errorMessage(value, "Copilot could not complete this request.");
        if (event === "cancelled") setStatus("Response stopped.");
        if (event === "done") setStatus("Response complete");
      };
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        let splitAt = buffer.indexOf("\n\n");
        while (splitAt >= 0) {
          handleFrame(buffer.slice(0, splitAt));
          buffer = buffer.slice(splitAt + 2);
          splitAt = buffer.indexOf("\n\n");
        }
      }
      buffer += decoder.decode();
      if (buffer.trim()) handleFrame(buffer);
      if (streamError) throw new Error(streamError);
      setMessages((current) => current.map((message) => message.id === assistantMessage.id
        ? { ...message, status: aborter.signal.aborted ? "CANCELLED" : "COMPLETED" }
        : message));
      await loadThreads(threadId);
    } catch (reason) {
      const cancelled = aborter.signal.aborted;
      const text = cancelled ? "Response stopped." : reason instanceof Error ? reason.message : "Copilot could not complete this request.";
      if (!cancelled) setError(text);
      setMessages((current) => current.map((message) => message.id === assistantMessage.id
        ? { ...message, status: cancelled ? "CANCELLED" : "FAILED", content: message.content || text }
        : message));
    } finally {
      abortRef.current = null;
      setStreaming(false);
      setStatus("");
    }
  }

  async function decideProposal(proposal: Proposal, decision: "APPROVED" | "REJECTED") {
    setWorkingProposalId(proposal.id);
    setError("");
    try {
      const response = await fetch(`/api/copilot/proposals/${proposal.id}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const result = await responseJson(response);
      if (!response.ok) throw new Error(errorMessage(result, "Could not update this WhatsApp draft."));
      setMessages((current) => current.map((message) => ({
        ...message,
        proposals: message.proposals.map((item) => item.id === proposal.id ? { ...item, status: String(result.status ?? decision) } : item),
      })));
      if (decision === "APPROVED") setStatus("WhatsApp sent successfully.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update this WhatsApp draft.");
    } finally {
      setWorkingProposalId("");
    }
  }

  return <>
    {open && <section className={styles.panel} aria-label="OpsCopilot chat" role="dialog" aria-modal="false" aria-labelledby="copilot-title">
      <header className={styles.header}>
        <div className={styles.brand}><span className={styles.brandIcon}><RobotIcon /></span><div><h2 id="copilot-title">Institute Copilot</h2><p>Owner, trainer, and counselor workspace</p></div></div>
        <button type="button" className={styles.closeButton} onClick={() => setOpen(false)} aria-label="Close Copilot">×</button>
      </header>

      <div className={styles.threadBar}>
        <label htmlFor="copilot-thread">Conversation</label>
        <select id="copilot-thread" value={selectedThreadId} disabled={loadingThreads || streaming} onChange={(event) => { setMessages([]); setSelectedThreadId(event.target.value); }}>
          {!threads.length && <option value="">No saved conversations</option>}
          {threads.map((thread) => <option key={thread.id} value={thread.id}>{thread.title}</option>)}
        </select>
        <button type="button" className={styles.newButton} onClick={() => void createThread()} disabled={streaming}>New chat</button>
      </div>

      <div className={styles.messages} ref={listRef} aria-live="polite" aria-busy={loadingMessages || streaming}>
        {loadingMessages && <p className={styles.emptyState}>Loading conversation…</p>}
        {!loadingMessages && messages.length === 0 && <div className={styles.emptyState}><span className={styles.emptyRobot}><RobotIcon /></span><strong>What can I help with?</strong><p>Ask about your authorized institute records, or ask me to draft a WhatsApp message for your approval.</p></div>}
        {messages.map((message) => <article key={message.id} className={`${styles.message} ${message.role === "USER" ? styles.userMessage : styles.assistantMessage}`}>
          <span className={styles.messageRole}>{message.role === "USER" ? "You" : "Copilot"}</span>
          <p className={styles.messageText}>{message.content || (message.status === "STREAMING" ? "Thinking…" : "")}</p>
          {message.status === "FAILED" && <small className={styles.failed}>This response could not be completed.</small>}
          {message.proposals.map((proposal) => <section className={styles.proposal} key={proposal.id}>
            <div className={styles.proposalHeader}><strong>WhatsApp draft</strong><span>{proposal.status.replaceAll("_", " ")}</span></div>
            <p>To {proposal.recipientName} · {proposal.recipientMaskedMobile}</p>
            <blockquote>{proposal.message}</blockquote>
            {proposal.status === "PENDING" && <div className={styles.proposalActions}>
              <button type="button" onClick={() => void decideProposal(proposal, "REJECTED")} disabled={workingProposalId === proposal.id}>Reject</button>
              <button type="button" onClick={() => void decideProposal(proposal, "APPROVED")} disabled={workingProposalId === proposal.id}>{workingProposalId === proposal.id ? "Sending…" : "Approve & send"}</button>
            </div>}
          </section>)}
        </article>)}
        {status && <p className={styles.status} role="status">{status}</p>}
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}
      <form className={styles.composer} onSubmit={(event) => void sendMessage(event)}>
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about a learner, schedule, attendance…" rows={2} maxLength={8000} aria-label="Message Copilot" disabled={streaming} onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }} />
        <div className={styles.composerFooter}><small>Enter to send · Shift+Enter for a new line</small>
          {streaming
            ? <button type="button" className={styles.stopButton} onClick={() => abortRef.current?.abort()}>Stop</button>
            : <button type="submit" className={styles.sendButton} disabled={!draft.trim()}>Send <span aria-hidden="true">↑</span></button>}
        </div>
      </form>
    </section>}
    <button type="button" className={`${styles.launcher} ${open ? styles.launcherOpen : ""}`} onClick={() => setOpen((value) => !value)} aria-label={open ? "Close Copilot" : "Open Institute Copilot"} aria-expanded={open}>
      {open ? <span className={styles.launcherClose} aria-hidden="true">×</span> : <RobotIcon />}
      <span className={styles.launcherLabel}>Copilot</span>
    </button>
  </>;
}
