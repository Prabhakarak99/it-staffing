"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Loader2, MailCheck, Send } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { FollowUpItem } from "@/lib/followups/data";
import { MAX_FOLLOWUPS, type FollowUpKind } from "@/lib/followups/templates";

const TABS: { kind: FollowUpKind; label: string; hint: string }[] = [
  { kind: "submission", label: "Submissions", hint: "Submitted a week ago: ask the vendor for an update. A second follow-up comes due a week after the first." },
  { kind: "interview", label: "Interviews", hint: "Interview was yesterday: ask the vendor for feedback. A second follow-up comes due a week after the first." },
];

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export function FollowUpsView({ initialItems, userId, canSeeAll, gmail, dayLabel }: {
  initialItems: FollowUpItem[];
  userId: string;
  /** Managers can also look at every recruiter's list (sending stays with each recruiter) */
  canSeeAll: boolean;
  /** Connected Gmail address, or null (follow-ups then go from the company mailbox as new emails) */
  gmail: string | null;
  dayLabel: string;
}) {
  const { toast, show, hide } = useToast();
  const [items, setItems] = useState(initialItems);
  const [tab, setTab] = useState<FollowUpKind>("submission");
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [preview, setPreview] = useState<Set<string>>(new Set());

  const load = (next: "mine" | "all") => {
    setLoading(true);
    return fetch(`/api/follow-ups?scope=${next}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Could not load follow-ups");
        setItems(d);
      })
      .catch((err: Error) => show(err.message, "error"))
      .finally(() => setLoading(false));
  };

  const changeScope = (next: "mine" | "all") => {
    setScope(next);
    void load(next);
  };

  const togglePreview = (key: string) =>
    setPreview((p) => {
      const n = new Set(p);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const send = async (item: FollowUpItem) => {
    setSending(item.key);
    const res = await fetch("/api/follow-ups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: item.kind, id: item.id }),
    });
    const d = await res.json().catch(() => ({}));
    setSending(null);
    if (!res.ok) {
      show(d.error ?? "Could not send the follow-up", "error");
      return load(scope);
    }
    show(
      d.inThread
        ? `Follow-up ${d.sequence} sent to ${item.vendorName || item.vendorEmail}, as a reply in "${d.subject}"`
        : `Follow-up ${d.sequence} sent to ${item.vendorName || item.vendorEmail} as a new email (the original wasn't found in Sent)`,
      "success",
    );
    return load(scope);
  };

  const shown = items.filter((i) => i.kind === tab);
  const showRecruiter = scope === "all";
  const cols = showRecruiter ? 8 : 7;
  const current = TABS.find((t) => t.kind === tab)!;

  return (
    <>
      <Header title="Follow-ups" subtitle={`Vendor follow-ups due today · ${dayLabel}`} />
      <div className="space-y-4 p-6">
        <div className={cn("flex flex-wrap items-center gap-3 rounded-2xl border px-5 py-3 text-[12.5px]", gmail ? "border-indigo-100 bg-indigo-50/60 text-slate-600" : "border-amber-200 bg-amber-50 text-amber-800")}>
          {gmail ? <MailCheck className="h-4 w-4 text-indigo-600" /> : <AlertTriangle className="h-4 w-4" />}
          {gmail ? (
            <p>Follow-ups go from <b>{gmail}</b> as a reply in your original email to the vendor (the rate confirmation in your Sent folder). Max {MAX_FOLLOWUPS} per submission and per interview.</p>
          ) : (
            <p>Your Gmail isn&apos;t connected, so follow-ups go from the company mailbox as new emails, not as replies in your thread. <Link href="/admin/mailbox" className="font-semibold underline">Connect Gmail in Mailbox</Link>.</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {TABS.map((t) => {
              const due = items.filter((i) => i.kind === t.kind && i.state === "due").length;
              return (
                <button
                  key={t.kind}
                  type="button"
                  onClick={() => setTab(t.kind)}
                  className={cn("flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition", t.kind === tab ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100")}
                >
                  {t.label}
                  <span className={cn("rounded-full px-1.5 text-[11px] font-bold", t.kind === tab ? "bg-white/20" : "bg-slate-100 text-slate-600")}>{due}</span>
                </button>
              );
            })}
          </div>
          {canSeeAll && (
            <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              {(["mine", "all"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => changeScope(s)}
                  className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition", s === scope ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100")}
                >
                  {s === "mine" ? "Mine" : "All recruiters"}
                </button>
              ))}
            </div>
          )}
          {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          <p className="text-[12px] text-slate-500">{current.hint}</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-slate-800">
                <tr>
                  {["Consultant", "Technology / Client", "Vendor", tab === "submission" ? "Submitted" : "Interview", "Follow-up", ...(showRecruiter ? ["Recruiter"] : []), "", ""].map((h, i) => (
                    <th key={`${h}${i}`} className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-300">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.length === 0 ? (
                  <tr>
                    <td colSpan={cols} className="px-4 py-12 text-center text-slate-400">
                      {tab === "submission" ? "No submission follow-ups due today." : "No interview follow-ups due today."}
                    </td>
                  </tr>
                ) : (
                  shown.map((i) => {
                    const open = preview.has(i.key);
                    const mineToSend = i.recruiterId === userId;
                    return (
                      <Fragment key={i.key}>
                        <tr className={cn("hover:bg-slate-50", open && "bg-indigo-50/40", i.state === "sent" && "bg-emerald-50/40")}>
                          <td className="whitespace-nowrap px-4 py-2.5">
                            <p className="font-semibold text-slate-800">{i.consultantName}</p>
                            <p className="font-mono text-[11px] text-slate-400">{i.submissionCode}</p>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11.5px] font-semibold text-indigo-700">{i.technology}</span>
                            {i.clientName && <p className="mt-0.5 text-[11px] text-slate-500">{i.clientName}</p>}
                          </td>
                          <td className="px-4 py-2.5 text-slate-700">
                            {i.vendorCompany}
                            <p className="text-[11px] text-slate-400">{i.vendorName} · {i.vendorEmail}</p>
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                            {i.dayLabel}
                            {i.interviewLevel && <p className="text-[11px] text-slate-400">{i.interviewLevel}</p>}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5">
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">{i.sequence} of {MAX_FOLLOWUPS}</span>
                            {i.state === "due" && i.daysLate > 0 && (
                              <span className="ml-1.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">{i.daysLate} day{i.daysLate === 1 ? "" : "s"} late</span>
                            )}
                          </td>
                          {showRecruiter && <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{i.recruiterName}</td>}
                          <td className="px-2 py-2.5">
                            <button
                              type="button"
                              onClick={() => togglePreview(i.key)}
                              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                              aria-expanded={open}
                            >
                              {open ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} Email
                            </button>
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right">
                            {i.state === "sent" ? (
                              <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700">
                                <CheckCircle2 className="h-4 w-4" /> Sent {i.sentAt ? fmtTime(i.sentAt) : ""}
                              </span>
                            ) : mineToSend ? (
                              <Button size="sm" onClick={() => send(i)} disabled={!!sending}>
                                {sending === i.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                {sending === i.key ? "Sending…" : "Send follow-up"}
                              </Button>
                            ) : (
                              <span className="text-[11px] text-slate-400" title="Follow-ups go from the recruiter's own mailbox">Recruiter sends</span>
                            )}
                          </td>
                        </tr>
                        {open && (
                          <tr>
                            <td colSpan={cols} className="bg-slate-50/80 px-4 py-3">
                              <div className="max-w-2xl rounded-xl border border-slate-200 bg-white p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">To {i.vendorEmail}</p>
                                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">{i.body}</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </>
  );
}
