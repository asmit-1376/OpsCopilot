"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { authClient } from "@/auth/auth-client";

const roles = [
  { value: "STUDENT", label: "Student", path: "/student" },
  { value: "TRAINER", label: "Trainer / Teacher", path: "/trainer" },
  { value: "COUNSELOR", label: "Counselor", path: "/counselor" },
  { value: "ACCOUNTS", label: "Accounts", path: "/accounts" },
  { value: "OWNER", label: "Owner", path: "/owner" },
] as const;

function AuthForm() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [role, setRole] = useState<(typeof roles)[number]["value"]>("STUDENT");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [needsOtp, setNeedsOtp] = useState(false);
  const [existingSetup, setExistingSetup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(searchParams.get("error") ?? "");
  const [notice, setNotice] = useState("");

  async function checkRole() {
    const response = await fetch("/api/auth/role-check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message ?? "We could not verify your account.");
    return data as { ok: true; role: string; redirectTo: string };
  }

  async function activateAccount() {
    const response = await fetch("/api/auth/activate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const data = await response.json();
    if (!response.ok) {
      await authClient.signOut();
      throw new Error(data.message ?? "Your account could not be activated.");
    }
  }

  async function checkRegistration() {
    const response = await fetch("/api/auth/register-check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message ?? "Your institute account could not be verified.");
  }

  async function checkLoginBridge(normalizedEmail: string) {
    const response = await fetch("/api/auth/login-bridge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail, role }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message ?? "We could not verify your institute profile.");
    return data as { action: "sign_in" | "setup_existing" | "setup_new" };
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const normalizedEmail = email.trim().toLowerCase();

    try {
      if (mode === "register" && !needsOtp) {
        const bridge = await checkLoginBridge(normalizedEmail);
        if (bridge.action === "sign_in") {
          throw new Error("This account is already set up. Use Sign in with email or Google.");
        }
        if (bridge.action === "setup_existing") {
          setExistingSetup(true);
          const requested = await authClient.emailOtp.requestPasswordReset({ email: normalizedEmail });
          if (requested.error) throw new Error(requested.error.message ?? "We could not send your setup code.");
          setNeedsOtp(true);
          setNotice("We sent a one-time setup code to your email. Enter it to finish creating your password.");
          return;
        }

        await checkRegistration();
        setExistingSetup(false);
        const result = await authClient.signUp.email({
          name: name.trim(),
          email: normalizedEmail,
          password,
          requestedRole: role,
        });
        if (result.error) throw new Error(result.error.message ?? "We could not create your account.");
        setNeedsOtp(true);
        setNotice("We sent a verification code to your email. It is valid for five minutes.");
        return;
      }

      if (mode === "register") {
        const result = existingSetup
          ? await authClient.emailOtp.resetPassword({ email: normalizedEmail, otp, password })
          : await authClient.emailOtp.verifyEmail({ email: normalizedEmail, otp });
        if (result.error) throw new Error(result.error.message ?? "That code is invalid or expired.");
        const signedIn = await authClient.signIn.email({ email: normalizedEmail, password });
        if (signedIn.error) throw new Error(signedIn.error.message ?? "Your email is verified. Sign in to finish setup.");
        await activateAccount();
        window.location.replace(roles.find((item) => item.value === role)?.path ?? "/login");
        return;
      }

      const bridge = await checkLoginBridge(normalizedEmail);
      if (bridge.action !== "sign_in") {
        setMode("register");
        setExistingSetup(bridge.action === "setup_existing");
        setNotice("Your institute profile is ready, but account setup is not complete. Create a password and verify the code we send to your email.");
        return;
      }

      const result = await authClient.signIn.email({ email: normalizedEmail, password });
      if (result.error) throw new Error("Sign-in failed. Check your email and password, or verify your email first.");
      try {
        const access = await checkRole();
        window.location.replace(access.redirectTo);
      } catch (cause) {
        await authClient.signOut();
        throw cause;
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setBusy(true);
    setError("");
    try {
      const callbackURL = new URL("/auth/complete", window.location.origin);
      callbackURL.searchParams.set("role", role);
      const result = await authClient.signIn.social({ provider: "google", callbackURL: callbackURL.toString() });
      if (result.error) throw new Error(result.error.message ?? "Google sign-in could not be started.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Google sign-in failed.");
      setBusy(false);
    }
  }

  function changeMode(nextMode: "signin" | "register") {
    setMode(nextMode);
    setNeedsOtp(false);
    setExistingSetup(false);
    setOtp("");
    setError("");
    setNotice("");
  }

  return (
    <main className="tst-page">
      <header className="tst-nav"><div className="tst-nav-container"><Link href="/" className="tst-brand-link"><span className="tst-brand-title">OpsCopilot</span></Link></div></header>
      <section className="tst-main-content" style={{ minHeight: "80vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div className="tst-auth-card" style={{ width: "min(100%, 520px)" }}>
          <div className="tst-tab-switch">
            <button type="button" className={`tst-tab-btn ${mode === "signin" ? "active" : ""}`} onClick={() => changeMode("signin")}>Sign in</button>
            <button type="button" className={`tst-tab-btn ${mode === "register" ? "active" : ""}`} onClick={() => changeMode("register")}>Create account</button>
          </div>
          <div className="tst-card-heading-wrap">
            <h1 className="tst-card-title">{needsOtp ? "Verify your email" : mode === "signin" ? "Sign in to your institute" : existingSetup ? "Finish account setup" : "Create your institute account"}</h1>
            <p className="tst-card-subtitle">Use your institute email and the role assigned to your account.</p>
          </div>

          <form className="tst-form" onSubmit={submit}>
            <div className="tst-form-group">
              <label className="tst-label" htmlFor="role">Portal</label>
              <select id="role" className="tst-input tst-select" value={role} disabled={needsOtp} onChange={(event) => setRole(event.target.value as typeof role)}>
                {roles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            {mode === "register" && !needsOtp && !existingSetup && <div className="tst-form-group">
              <label className="tst-label" htmlFor="name">Full name</label>
              <input id="name" className="tst-input" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
            </div>}
            <div className="tst-form-group">
              <label className="tst-label" htmlFor="email">Email address</label>
              <input id="email" type="email" className="tst-input" autoComplete="email" required value={email} disabled={needsOtp} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
            </div>
            {needsOtp ? <div className="tst-form-group">
              <label className="tst-label" htmlFor="otp">6-digit email code</label>
              <input id="otp" inputMode="numeric" autoComplete="one-time-code" className="tst-input" required minLength={6} maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} placeholder="000000" />
            </div> : <div className="tst-form-group">
              <label className="tst-label" htmlFor="password">{mode === "signin" ? "Password" : "Create password"}</label>
              <input id="password" type="password" className="tst-input" autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 10 characters" />
            </div>}
            {error && <p role="alert" style={{ color: "#b42318", margin: "4px 0 12px" }}>{error}</p>}
            {notice && <p role="status" style={{ color: "#147d4b", margin: "4px 0 12px" }}>{notice}</p>}
            <button type="button" className="tst-google-btn" disabled={busy || mode === "register" || needsOtp} onClick={signInWithGoogle}>
              <svg aria-hidden="true" viewBox="0 0 48 48" width="20" height="20"><path fill="#FFC107" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.9 6-15Z"/><path fill="#FF3D00" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.1c-1.8 1.2-4.1 2-6.8 2-5.3 0-9.8-3.6-11.4-8.4H5.7v5.3A20 20 0 0 0 24 44Z"/><path fill="#4CAF50" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.7a20 20 0 0 0 0 17.8l6.9-5.3Z"/><path fill="#1976D2" d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6 29.5 4 24 4A20 20 0 0 0 5.7 15.1l6.9 5.3C14.2 15.6 18.7 12 24 12Z"/></svg>
              Continue with Google
            </button>
            <button type="submit" className="tst-btn-amber-lg" disabled={busy}>
              {busy ? "Please wait…" : needsOtp ? "Verify code and finish setup" : mode === "signin" ? "Sign in with email" : existingSetup ? "Send setup code" : "Create account and send code"}
            </button>
          </form>
          <p className="tst-card-footer" style={{ marginTop: 18 }}>New accounts require an active institute profile or invitation. Contact your institute administrator if you need access.</p>
        </div>
      </section>
    </main>
  );
}

export default function AuthPage() {
  return <Suspense fallback={<main className="tst-page" />}><AuthForm /></Suspense>;
}
