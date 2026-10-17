"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RealtimeRefresh() {
  const router = useRouter();

  useEffect(() => {
    const source = new EventSource("/api/events");
    source.addEventListener("change", () => router.refresh());
    return () => source.close();
  }, [router]);

  return null;
}
