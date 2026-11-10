"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, X } from "lucide-react";
import { VENDOR_REQ_SCREEN } from "@/lib/requirements/constants";

interface NewRequirement {
  id: string;
  jobTitle: string | null;
  technology: string | null;
  clientName: string | null;
  vendorCompany: string | null;
  source: string;
  mine: boolean;
}

const POLL_MS = 60_000;
const SHOW_MS = 9_000;
const MAX_SHOWN = 3;

/**
 * Checks once a minute for requirement emails stored since the last check (only ones this user may
 * see) and pops each up in the corner for a few seconds. Clicking one opens Vendor Requirements.
 */
export function RequirementNotifier() {
  const router = useRouter();
  const [items, setItems] = useState<NewRequirement[]>([]);
  const since = useRef<string | null>(null);

  useEffect(() => {
    let stopped = false;
    const check = async () => {
      if (document.hidden) return; // a background tab catches up on its next visible check
      try {
        const first = since.current === null;
        // The first call only learns the server time: nothing older than this page load pops up
        const res = await fetch(`/api/vendor-requirements?since=${encodeURIComponent(since.current ?? new Date().toISOString())}`, { cache: "no-store" });
        if (!res.ok) return;
        const d = (await res.json()) as { now: string; items: NewRequirement[] };
        since.current = d.now;
        if (first || stopped || d.items.length === 0) return;
        setItems((cur) => [...d.items.filter((n) => !cur.some((c) => c.id === n.id)), ...cur].slice(0, MAX_SHOWN));
        for (const n of d.items) setTimeout(() => setItems((cur) => cur.filter((c) => c.id !== n.id)), SHOW_MS);
      } catch {
        // offline for a moment: try again next time
      }
    };
    void check();
    const t = setInterval(() => void check(), POLL_MS);
    const onVisible = () => { if (!document.hidden) void check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; clearInterval(t); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  if (items.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
      {items.map((n) => (
        <div key={n.id} className="pointer-events-auto flex items-start gap-3 rounded-xl border border-indigo-200 bg-white p-3 shadow-xl">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white"><BriefcaseBusiness className="h-4 w-4" /></span>
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => { setItems((cur) => cur.filter((c) => c.id !== n.id)); router.push(VENDOR_REQ_SCREEN.path); }}
          >
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-indigo-600">New vendor requirement</p>
            <p className="truncate text-[13px] font-semibold text-slate-800">{n.jobTitle ?? "New position"}{n.technology ? ` · ${n.technology}` : ""}</p>
            <p className="truncate text-[11.5px] text-slate-500">
              {[n.clientName && `Client: ${n.clientName}`, n.vendorCompany, n.mine ? "your inbox" : `via ${n.source}`].filter(Boolean).join(" · ")}
            </p>
          </button>
          <button type="button" aria-label="Dismiss" onClick={() => setItems((cur) => cur.filter((c) => c.id !== n.id))} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
