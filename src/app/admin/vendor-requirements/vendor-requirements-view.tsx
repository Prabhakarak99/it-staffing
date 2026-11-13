"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, Building2, CircleSlash, Inbox, Loader2, Mail, Phone, RefreshCw, Search, Send, Users2,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { APP_TZ, dayKeyOf } from "@/lib/tz";
import { REQ_TECHNOLOGIES, type RequirementRow, type RequirementTally } from "@/lib/requirements/constants";
import type { Sender } from "../vendor-management/vendor-consultants";
import { SendResumeDialog } from "./send-resume-dialog";

const PAGE = 100;
const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: APP_TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const WINDOWS = [
  { id: "today", label: "Today", days: 0 },
  { id: "7", label: "7 days", days: 7 },
  { id: "30", label: "30 days", days: 30 },
] as const;

const SHOW = [
  { id: "all", label: "All I can see" },
  { id: "inbox", label: "From my inbox" },
  { id: "consultant", label: "Consultant inboxes" },
  { id: "match", label: "My consultants' technologies" },
] as const;

const KNOWN_TECH = new Set(REQ_TECHNOLOGIES.filter((t) => t !== "Others"));

export function VendorRequirementsView({ initialRows, initialTech, initialWindow, days, manager, tally, myBook, aiReady, inboxes, myInbox, sender }: {
  initialRows: RequirementRow[];
  /** Filters already chosen by a link from the Requirement Report */
  initialTech: string;
  initialWindow: (typeof WINDOWS)[number]["id"];
  days: number;
  manager: boolean;
  /** Managers: what was read from each kind of inbox and why some isn't listed (as of page load) */
  tally: RequirementTally | null;
  /** Recruiters: their In-Market consultants (Pre-Marketing), which decide the technologies they see */
  myBook: { name: string; technology: string }[] | null;
  aiReady: boolean;
  /** Connected inboxes being read */
  inboxes: number;
  myInbox: { email: string; scannedAt: string | null } | null;
  /** The signed-in user, their signature and templates, for sending resumes */
  sender: Sender;
}) {
  const { toast, show, hide } = useToast();
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [tech, setTech] = useState(initialTech);
  const [windowId, setWindowId] = useState<(typeof WINDOWS)[number]["id"]>(initialWindow);
  const [showId, setShowId] = useState<(typeof SHOW)[number]["id"]>("all");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(PAGE);
  const [scanning, setScanning] = useState(false);
  /** Requirement whose Send Resume popup is open */
  const [sendFor, setSendFor] = useState<RequirementRow | null>(null);
  // "Now" for the date filters, moved forward on every refresh
  const [now, setNow] = useState(() => Date.now());

  const reload = useCallback(async () => {
    const res = await fetch("/api/vendor-requirements", { cache: "no-store" });
    if (res.ok) setRows(await res.json());
    setNow(Date.now());
  }, []);

  // New ones arrive every few minutes from the inbox reader
  useEffect(() => {
    const t = setInterval(() => void reload(), 2 * 60_000);
    return () => clearInterval(t);
  }, [reload]);

  const scanNow = async () => {
    setScanning(true);
    const res = await fetch("/api/vendor-requirements", { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setScanning(false);
    if (!res.ok) return show(d.error ?? "Could not read your inbox", "error");
    await reload();
    show(d.added ? `${d.added} new requirement${d.added === 1 ? "" : "s"} found in your inbox` : `Checked ${d.checked} email${d.checked === 1 ? "" : "s"}: no new requirements`, "success");
  };

  const today = dayKeyOf(new Date(now));
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const w = WINDOWS.find((x) => x.id === windowId)!;
    const cutoff = now - w.days * 86_400_000;
    return rows.filter((r) => {
      if (w.days === 0 ? dayKeyOf(new Date(r.receivedAt)) !== today : new Date(r.receivedAt).getTime() < cutoff) return false;
      // "Others" also covers requirements with no technology or one outside the list, as the report counts them
      if (tech && (tech === "Others" ? !!r.technology && KNOWN_TECH.has(r.technology) : r.technology !== tech)) return false;
      if (showId === "inbox" && !r.mine) return false;
      if (showId === "consultant" && !r.source?.consultant) return false;
      if (showId === "match" && r.myConsultants.length === 0) return false;
      if (!q) return true;
      return [r.jobTitle, r.technology, r.clientName, r.location, r.vendorName, r.vendorCompany, r.vendorEmail, r.subject, r.jobDescription, r.source?.name, r.source?.consultant, r.source?.email]
        .some((f) => f?.toLowerCase().includes(q));
    });
  }, [rows, query, tech, windowId, showId, today, now]);

  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const inLast = (d: number) => rows.filter((r) => new Date(r.receivedAt).getTime() >= now - d * 86_400_000).length;
  const stats = manager
    ? [
        { label: "Today", value: rows.filter((r) => dayKeyOf(new Date(r.receivedAt)) === today).length, color: "text-sky-700" },
        { label: `Last ${days} days`, value: rows.length, color: "text-indigo-700" },
        { label: "From my inbox", value: rows.filter((r) => r.mine).length, color: "text-violet-700" },
        { label: "Nobody's technology", value: rows.filter((r) => r.audience.kind === "unassigned").length, color: "text-slate-500" },
      ]
    : [
        { label: "Today", value: rows.filter((r) => dayKeyOf(new Date(r.receivedAt)) === today).length, color: "text-sky-700" },
        { label: "Last 7 days", value: inLast(7), color: "text-indigo-700" },
        { label: `Last ${days} days`, value: rows.length, color: "text-violet-700" },
        { label: "Your technologies", value: new Set(rows.map((r) => r.technology).filter(Boolean)).size, color: "text-emerald-700" },
      ];
  const cols = manager
    ? ["Received", "Requirement", "Type / Rate", "Vendor", "Source inbox", "Shared with", ""]
    : ["Received", "Requirement", "Type / Rate", "Vendor", ""];
  const th = "whitespace-nowrap px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-300";

  return (
    <>
      <Header title="Vendor Requirements" subtitle={manager ? "Requirement emails from vendors, read from the team's connected inboxes" : "Vendor requirements for your consultants' technologies"} />
      <div className="space-y-4 p-4 sm:p-6">
        {myBook && (
          myBook.length === 0 ? (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-[12.5px] text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                <b>No In-Market consultants are assigned to you</b>, so no requirements are shown. Requirements appear for the technologies of the consultants you market:
                in <b>Pre-Marketing</b> you must be the consultant&apos;s recruiter, and the consultant&apos;s status must be <b>In-Market</b> with a technology set. Ask your manager to assign them.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-slate-500">
              <span>Showing requirements for your consultants:</span>
              {myBook.map((c) => (
                <span key={c.name + c.technology} className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px]">
                  <b className="text-slate-700">{c.name}</b> · <span className="text-indigo-700">{c.technology}</span>
                </span>
              ))}
            </div>
          )
        )}
        {tally && (
          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-[12px] text-slate-600 shadow-sm sm:grid-cols-2">
            {([["Recruiter inboxes", tally.recruiter], ["Consultant inboxes", tally.consultant]] as const).map(([label, t]) => (
              <p key={label}>
                <b className="text-slate-800">{label}:</b> {t.stored} read in the last {days} days · <b className="text-emerald-700">{t.shown} listed</b>
                {t.stored - t.shown > 0 && (
                  <span className="text-slate-400"> · hidden: {t.submitted} already submitted to that vendor, {t.fullTime} full-time only, {t.internal} from our own company</span>
                )}
              </p>
            ))}
          </div>
        )}
        {/* Status */}
        <div className={cn(
          "flex flex-wrap items-center gap-3 rounded-2xl border px-5 py-3 text-[12.5px]",
          myInbox && aiReady ? "border-indigo-100 bg-indigo-50/60 text-slate-600" : "border-amber-200 bg-amber-50 text-amber-800",
        )}>
          {myInbox && aiReady ? <Inbox className="h-4 w-4 text-indigo-600" /> : <AlertTriangle className="h-4 w-4" />}
          <p className="min-w-0 flex-1">
            {!aiReady ? (
              <>No AI provider is set up, so requirement emails can&apos;t be read yet. An admin can add one under Administration → AI Settings.</>
            ) : myInbox ? (
              <>
                Reading <b>{myInbox.email}</b> and {Math.max(0, inboxes - 1)} other inbox{inboxes - 1 === 1 ? "" : "es"} every few minutes.
                {myInbox.scannedAt && <> Your inbox was last checked {fmtWhen(myInbox.scannedAt)} CT.</>}
              </>
            ) : (
              <>Your Gmail isn&apos;t connected, so requirements in your inbox aren&apos;t read. <Link href="/admin/mailbox" className="font-semibold underline">Connect Gmail in Mailbox</Link>. You still see requirements shared from {inboxes} connected inbox{inboxes === 1 ? "" : "es"}.</>
            )}
          </p>
          {myInbox && aiReady && (
            <Button size="sm" variant="outline" onClick={scanNow} disabled={scanning}>
              {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} {scanning ? "Reading inbox…" : "Check my inbox now"}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
              <p className={cn("mt-1 text-2xl font-bold tabular-nums", color)}>{value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }}
              placeholder="Search title, skills, client, vendor, JD…"
              className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[13px] shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <select value={tech} onChange={(e) => { setTech(e.target.value); setLimit(PAGE); }}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[13px] shadow-sm focus:border-indigo-400 focus:outline-none">
            <option value="">All technologies</option>
            {REQ_TECHNOLOGIES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <Segmented options={WINDOWS} value={windowId} onChange={(v) => { setWindowId(v); setLimit(PAGE); }} />
          {manager && <Segmented options={SHOW} value={showId} onChange={(v) => { setShowId(v); setLimit(PAGE); }} />}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-slate-800">
                <tr>
                  {cols.map((h) => <th key={h} className={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 && (
                  <tr><td colSpan={cols.length} className="px-4 py-14 text-center text-slate-400">
                    {rows.length === 0
                      ? manager ? "No requirement emails yet. New ones show up here a few minutes after they arrive." : "No requirements for your consultants' technologies yet. New ones show up here as vendors send them."
                      : "No requirements match these filters."}
                  </td></tr>
                )}
                {filtered.slice(0, limit).map((r) => {
                  const isOpen = open.has(r.id);
                  return (
                    <Fragment key={r.id}>
                      <tr className={cn("cursor-pointer align-top hover:bg-slate-50", isOpen && "bg-indigo-50/40")} onClick={() => toggle(r.id)}>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fmtWhen(r.receivedAt)}</td>
                        <td className="min-w-[260px] px-4 py-3">
                          <p className="font-semibold text-slate-800">{r.jobTitle ?? r.subject}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {r.technology && <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700">{r.technology}</span>}
                            {r.clientName && <span className="text-[11.5px] text-slate-600">Client: {r.clientName}</span>}
                          </div>
                          {(r.location || r.workMode) && <p className="mt-0.5 text-[11.5px] text-slate-500">{[r.location, r.workMode].filter(Boolean).join(" · ")}</p>}
                          {r.myConsultants.length > 0 && (
                            <p className="mt-1 text-[11px] font-medium text-emerald-700">Your consultants: {r.myConsultants.join(", ")}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {r.employmentType && <p className="font-medium">{r.employmentType}</p>}
                          {r.rate && <p className="text-[11.5px]">{r.rate}</p>}
                          {r.duration && <p className="text-[11.5px] text-slate-400">{r.duration}</p>}
                          {!r.employmentType && !r.rate && !r.duration && <span className="text-slate-300">—</span>}
                        </td>
                        <td className="min-w-[200px] px-4 py-3">
                          <p className="font-medium text-slate-800">{r.vendorName ?? "—"}</p>
                          {r.vendorCompany && <p className="flex items-center gap-1 text-[11.5px] text-slate-600"><Building2 className="h-3 w-3" />{r.vendorCompany}</p>}
                          {r.vendorEmail && (
                            <a href={`mailto:${r.vendorEmail}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-[11.5px] text-indigo-600 hover:underline">
                              <Mail className="h-3 w-3" />{r.vendorEmail}
                            </a>
                          )}
                          {r.vendorPhone && <p className="flex items-center gap-1 text-[11.5px] text-slate-500"><Phone className="h-3 w-3" />{r.vendorPhone}</p>}
                        </td>
                        {r.source && (<>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-700">
                            {r.source.consultant ? `${r.source.consultant}'s Gmail` : r.mine && !manager ? "Your inbox" : r.source.name}
                          </p>
                          {r.source.consultant && <p className="text-[11px] text-slate-500">Recruiter: {r.mine && !manager ? "you" : r.source.name}</p>}
                          {r.source.email && <p className="text-[11px] text-slate-400">{r.source.email}</p>}
                          {r.alsoReceivedBy.length > 0 && <p className="text-[11px] text-slate-400">Also: {r.alsoReceivedBy.join(", ")}</p>}
                        </td>
                        <td className="px-4 py-3"><AudienceBadge row={r} /></td>
                        </>)}
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={(e) => { e.stopPropagation(); setSendFor(r); }}
                            title="Pick your consultants: their resumes are updated for this JD and emailed to the vendor"
                          >
                            <Send className="h-3.5 w-3.5" /> Send Resume
                          </Button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={cols.length} className="bg-slate-50/80 px-4 py-4">
                            <div className="max-w-4xl space-y-2 rounded-xl border border-slate-200 bg-white p-4">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Subject: <span className="normal-case tracking-normal text-slate-600">{r.subject}</span></p>
                              {r.visa && <p className="text-[12px] text-slate-600"><b>Visa:</b> {r.visa}</p>}
                              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">{r.jobDescription}</p>
                              <p className="pt-1 text-[11px] text-slate-400">From {r.fromEmail} · received {fmtWhen(r.receivedAt)} CT</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > limit && (
            <div className="border-t border-slate-100 px-4 py-3 text-center">
              <Button size="sm" variant="outline" onClick={() => setLimit((l) => l + PAGE)}>Show more ({filtered.length - limit} left)</Button>
            </div>
          )}
        </div>
      </div>
      {sendFor && (
        <SendResumeDialog
          req={sendFor}
          sender={sender}
          aiReady={aiReady}
          onClose={() => setSendFor(null)}
          onDone={(sent) => {
            setSendFor(null);
            show(`Sent ${sent} resume${sent === 1 ? "" : "s"} to ${sendFor.vendorName ?? sendFor.vendorEmail ?? "the vendor"}. The requirement moves off the list. Add it in Submissions as usual.`, "success");
            void reload();
          }}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </>
  );
}

function AudienceBadge({ row }: { row: RequirementRow }) {
  const { kind, names } = row.audience;
  const map = {
    shared: { icon: Users2, label: `${names.length} recruiter${names.length === 1 ? "" : "s"}`, cls: "bg-sky-50 text-sky-700 border-sky-200", tip: `Recruiters working ${row.technology} consultants: ${names.join(", ")}` },
    unassigned: { icon: CircleSlash, label: "No recruiter", cls: "bg-slate-50 text-slate-500 border-slate-200", tip: `Nobody has a ${row.technology ?? ""} consultant in market, so only managers see it` },
  }[kind];
  const Icon = map.icon;
  return (
    <span title={map.tip} className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-semibold", map.cls)}>
      <Icon className="h-3 w-3" /> {map.label}
    </span>
  );
}

function Segmented<T extends string>({ options, value, onChange }: { options: readonly { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-0.5 rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
      {options.map((o) => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)}
          className={cn("whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition", o.id === value ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
