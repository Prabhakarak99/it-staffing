"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EasyAccessRow } from "@/app/api/easy-submissions/access/route";

function Switch({ on, disabled, onChange, label }: { on: boolean; disabled?: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50", on ? "bg-emerald-500" : "bg-slate-300")}
    >
      <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", on ? "left-[18px]" : "left-0.5")} />
    </button>
  );
}

/** Admin: switch Easy Submissions on or off for each user; off hides the tab for them */
export function AccessDialog({ onClose, notify }: { onClose: () => void; notify: (m: string, t: "success" | "error") => void }) {
  const [rows, setRows] = useState<EasyAccessRow[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/easy-submissions/access")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Could not load users");
        setRows(d);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter((r) => !q || `${r.name} ${r.email} ${r.roleName ?? ""}`.toLowerCase().includes(q));
  }, [rows, query]);

  const set = async (userIds: string[], enabled: boolean, key: string) => {
    setBusy(key);
    const res = await fetch("/api/easy-submissions/access", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds, enabled }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return notify(d.error ?? "Could not change access", "error");
    setRows(d);
    notify(`Easy Submissions ${enabled ? "turned on" : "turned off"} for ${userIds.length === 1 ? "1 user" : `${userIds.length} users`}`, "success");
  };

  const eligible = shown.filter((r) => r.roleHasScreen);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between rounded-t-2xl bg-slate-800 px-5 py-3">
          <div>
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-white"><ShieldCheck className="h-4 w-4" /> Easy Submissions Access</h2>
            <p className="text-[11px] text-slate-400">Turn the tab on or off for each user. Off hides the tab and blocks it for them.</p>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users…"
              className="h-8 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-[12.5px] focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <Button size="sm" variant="outline" disabled={!eligible.length || !!busy} onClick={() => set(eligible.map((r) => r.id), true, "all-on")}>All on</Button>
          <Button size="sm" variant="outline" disabled={!eligible.length || !!busy} onClick={() => set(eligible.map((r) => r.id), false, "all-off")}>All off</Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error ? (
            <p className="px-5 py-6 text-center text-[12.5px] font-medium text-rose-600">{error}</p>
          ) : !rows ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[12.5px] text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading users…</div>
          ) : shown.length === 0 ? (
            <p className="px-5 py-6 text-center text-[12.5px] text-slate-400">No users match</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {shown.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-slate-800">
                      {r.name}
                      {!r.isActive && <span className="ml-2 rounded bg-amber-50 px-1.5 text-[10px] font-semibold text-amber-700">Not activated</span>}
                    </p>
                    <p className="truncate text-[11.5px] text-slate-400">{r.roleName ?? "—"} · {r.email}</p>
                  </div>
                  {r.roleHasScreen ? (
                    <>
                      <span className={cn("text-[11.5px] font-semibold", r.enabled ? "text-emerald-700" : "text-slate-400")}>{r.enabled ? "On" : "Off"}</span>
                      {busy === r.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                      ) : (
                        <Switch on={r.enabled} disabled={!!busy} onChange={() => set([r.id], !r.enabled, r.id)} label={`Easy Submissions for ${r.name}`} />
                      )}
                    </>
                  ) : (
                    <span className="text-[11px] text-slate-400" title="Grant Easy Submissions to this role in User Roles first">Role has no access</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
