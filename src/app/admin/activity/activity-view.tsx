"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Globe, LogIn, LogOut, MousePointerClick, Search, ShieldAlert } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { APP_TZ, APP_TZ_LABEL } from "@/lib/tz";
import type { ActivityFilters, ActivityRow, ActivityUserSummary } from "@/lib/activity/data";

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: APP_TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" });

const KINDS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  login: { label: "Signed in", icon: LogIn, cls: "bg-emerald-50 text-emerald-700" },
  logout: { label: "Signed out", icon: LogOut, cls: "bg-slate-100 text-slate-600" },
  login_failed: { label: "Failed sign-in", icon: ShieldAlert, cls: "bg-rose-50 text-rose-700" },
  page: { label: "Opened tab", icon: MousePointerClick, cls: "bg-indigo-50 text-indigo-700" },
};

const inputCls = "h-9 rounded-xl border border-slate-200 bg-white px-3 text-[13px] shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

export function ActivityView({ filters, rows, total, summary, users, pageSize }: {
  filters: ActivityFilters;
  rows: ActivityRow[];
  total: number;
  summary: ActivityUserSummary[];
  users: { id: string; name: string }[];
  pageSize: number;
}) {
  const router = useRouter();
  const [q, setQ] = useState(filters.q);

  const go = (patch: Partial<Record<keyof ActivityFilters, string | number | null>>) => {
    const next = { ...filters, page: 1, ...patch };
    const sp = new URLSearchParams();
    if (next.userId) sp.set("user", String(next.userId));
    if (next.kind) sp.set("kind", String(next.kind));
    sp.set("from", String(next.from));
    sp.set("to", String(next.to));
    if (next.q) sp.set("q", String(next.q));
    if (Number(next.page) > 1) sp.set("page", String(next.page));
    router.push(`/admin/activity?${sp}`);
  };

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const logins = summary.reduce((n, s) => n + s.logins, 0);
  const failed = summary.reduce((n, s) => n + s.failed, 0);
  const ips = new Set(summary.flatMap((s) => s.ips)).size;

  return (
    <>
      <Header title="Activity" subtitle={`Who signed in, from which IP address, and which tabs they opened (times in ${APP_TZ_LABEL})`} />
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            From
            <input type="date" value={filters.from} max={filters.to} onChange={(e) => e.target.value && go({ from: e.target.value })} className={cn(inputCls, "mt-1 block")} />
          </label>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            To
            <input type="date" value={filters.to} min={filters.from} onChange={(e) => e.target.value && go({ to: e.target.value })} className={cn(inputCls, "mt-1 block")} />
          </label>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            User
            <select value={filters.userId ?? ""} onChange={(e) => go({ userId: e.target.value || null })} className={cn(inputCls, "mt-1 block min-w-[180px]")}>
              <option value="">Everyone</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Event
            <select value={filters.kind ?? ""} onChange={(e) => go({ kind: e.target.value || null })} className={cn(inputCls, "mt-1 block")}>
              <option value="">All events</option>
              {Object.entries(KINDS).map(([id, k]) => <option key={id} value={id}>{k.label}</option>)}
            </select>
          </label>
          <form className="relative min-w-[220px] flex-1" onSubmit={(e) => { e.preventDefault(); go({ q: q.trim() || null }); }}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email, IP address, tab… (Enter)" className={cn(inputCls, "w-full pl-9")} />
          </form>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "People active", value: summary.length, color: "text-slate-800" },
            { label: "Sign-ins", value: logins, color: "text-emerald-700" },
            { label: "Failed sign-ins", value: failed, color: failed ? "text-rose-600" : "text-slate-400" },
            { label: "IP addresses", value: ips, color: "text-indigo-700" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{s.label}</p>
              <p className={cn("mt-1 text-2xl font-bold tabular-nums", s.color)}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* One line per person */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <p className="border-b border-slate-100 px-4 py-2.5 text-[12px] font-semibold text-slate-700">By person</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-slate-800">
                <tr>
                  {["User", "Last sign-in", "Sign-in IP", "Last seen", "Last tab", "Sign-ins", "Tabs opened", "Failed", "IP addresses"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-300">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">No activity on these dates.</td></tr>
                )}
                {summary.map((s) => (
                  <tr key={s.userId} className="cursor-pointer hover:bg-slate-50" onClick={() => go({ userId: s.userId })} title="Show only this person">
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-slate-800">{s.name || s.email}</p>
                      <p className="text-[11px] text-slate-400">{s.email}{s.role ? ` · ${s.role}` : ""}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{s.lastLogin ? fmtWhen(s.lastLogin) : "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[12px] text-slate-700">{s.lastIp ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{s.lastSeen ? fmtWhen(s.lastSeen) : "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{s.lastTab ?? "—"}</td>
                    <td className="px-4 py-2.5 tabular-nums">{s.logins}</td>
                    <td className="px-4 py-2.5 tabular-nums">{s.pages}</td>
                    <td className={cn("px-4 py-2.5 tabular-nums", s.failed ? "font-semibold text-rose-600" : "text-slate-400")}>{s.failed}</td>
                    <td className="px-4 py-2.5 font-mono text-[11.5px] text-slate-600" title={s.ips.join(", ")}>
                      {s.ips.slice(0, 2).join(", ")}{s.ips.length > 2 ? ` +${s.ips.length - 2}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Every event */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <p className="text-[12px] font-semibold text-slate-700">Activity log <span className="font-normal text-slate-400">· {total} event{total === 1 ? "" : "s"}</span></p>
            <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
              <Button size="sm" variant="ghost" disabled={filters.page <= 1} onClick={() => go({ page: filters.page - 1 })}><ChevronLeft className="h-3.5 w-3.5" /></Button>
              Page {filters.page} of {pages}
              <Button size="sm" variant="ghost" disabled={filters.page >= pages} onClick={() => go({ page: filters.page + 1 })}><ChevronRight className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-slate-800">
                <tr>
                  {["Time", "User", "Event", "Tab", "IP address", "Device"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-300">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">Nothing recorded for these filters.</td></tr>
                )}
                {rows.map((r) => {
                  const k = KINDS[r.kind] ?? KINDS.page;
                  const Icon = k.icon;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-slate-600">{fmtWhen(r.at)}</td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-slate-800">{r.name || r.email}</p>
                        {r.name && <p className="text-[11px] text-slate-400">{r.email}</p>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold", k.cls)}>
                          <Icon className="h-3 w-3" /> {k.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700" title={r.path ?? undefined}>{r.tab ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[12px] text-slate-700">
                        {r.ip ? (
                          <button type="button" onClick={() => { setQ(r.ip!); go({ q: r.ip }); }} className="inline-flex items-center gap-1 hover:text-indigo-600" title="Show everything from this IP">
                            <Globe className="h-3 w-3 text-slate-400" /> {r.ip}
                          </button>
                        ) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{r.device ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
