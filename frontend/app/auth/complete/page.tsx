"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/auth/auth-client";

function AuthCompleteContent() {
  const params = useSearchParams();
  const [message, setMessage] = useState("Checking your institute access…");

  useEffect(() => {
    let active = true;
    async function finish() {
      const session = await authClient.getSession();
      if (session.error || !session.data?.user) throw new Error("Google sign-in did not complete. Please try again.");
      const role = params.get("role") ?? "";
      const activation = await fetch("/api/auth/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const activationData = await activation.json();
      if (!activation.ok) {
        await authClient.signOut();
        throw new Error(activationData.message ?? "Your account could not be activated for this role.");
      }
      const response = await fetch("/api/auth/role-check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await response.json();
      if (!response.ok) {
        await authClient.signOut();
        throw new Error(data.message ?? "This account does not have access to the selected portal.");
      }
      if (active) window.location.replace(data.redirectTo ?? "/login");
    }
    finish().catch((error: unknown) => {
      if (active) setMessage(error instanceof Error ? error.message : "Unable to verify your access.");
    });
    return () => { active = false; };
  }, [params]);

  return <main className="tst-page" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}><p role="status">{message}</p></main>;
}

export default function AuthCompletePage() {
  return <Suspense fallback={<main className="tst-page" />}><AuthCompleteContent /></Suspense>;
}
