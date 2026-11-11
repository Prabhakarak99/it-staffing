"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Records each tab the user opens (Activity screen). Fire-and-forget; repeats of the same path are skipped. */
export function ActivityTracker() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!pathname || pathname === last.current) return;
    last.current = pathname;
    fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);
  return null;
}
