"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, Bot, Download, Eye, FileText, Loader2, Minus, Plus, Send, ShieldCheck, Sparkles, Upload, Users2, X, Zap,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { APP_TZ } from "@/lib/tz";
import type { ConsultantOption, EasySubmissionRow, VendorOption } from "@/lib/easy/data";
import { categoryLabel, defaultTemplate, fillFields, renderBody, signOff, type EmailTemplateDto, type TemplateVars } from "@/lib/email-templates/render";
import { AccessDialog } from "./access-dialog";

interface Requirement {
  technology: string;
  jobDescription: string | null;
  clientName: string | null;
  implementationName: string | null;
  clientLocation: string | null;
  payRate: string | null;
}

interface ConsultantState {
  loading: boolean;
  error?: string;
  consultants: ConsultantOption[];
  requirement?: Requirement;
  technology?: string | null;
  /** Vendors in each consultant's share; 0 means there's nobody to send a resume to */
  vendorCounts?: Record<string, number>;
}
/** This consultant's share when the requirement's vendors are split between its consultants */
interface VendorSplit { consultants: number; total: number; primaryTotal: number; mine: number }
interface VendorState { loading: boolean; error?: string; vendors: VendorOption[]; hidden: number; split?: VendorSplit | null }

type Notify = (message: string, type: "success" | "error") => void;

/** The signed-in user: their name, signature and own templates for the vendor email */
interface Sender { name: string; email: string; signature: string; templates: EmailTemplateDto[] }

const resumeHref = (file: string) => `/api/resumes/${file}`;
const consultantHref = (id: string) => `/admin/students?consultant=${id}`;
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: APP_TZ });

function ExpandButton({ open, onClick, label }: { open: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded-md border transition-colors",
        open ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-indigo-400 hover:text-indigo-600",
      )}
    >
      {open ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
    </button>
  );
}

function AtsBadge({ before, after, missing }: { before: number; after: number; missing: string[] }) {
  const color = after >= 80 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : after >= 60 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-rose-50 text-rose-700 border-rose-200";
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-bold tabular-nums", color)}
      title={`ATS match with the job description: ${before}% before → ${after}% after.${missing.length ? `\nStill missing: ${missing.join(", ")}` : ""}`}
    >
      ATS {after}%<span className="font-medium opacity-70">(was {before}%)</span>
    </span>
  );
}

interface PreviewData {
  html: string;
  file: string;
  fileName: string;
  atsBefore: number;
  atsAfter: number;
  keywords: { term: string; count: number; priority: string | null; evidence: string | null; note: string | null }[];
  total: number;
  found: number;
  mentions: number;
}

/** The AI-updated resume in a scrollable popup, with the JD keywords and how often each appears */
function ResumePreview({ id, consultant, onClose }: { id: string; consultant: string; onClose: () => void }) {
  const [data, setData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/tailored-resumes/${id}/preview`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!live) return;
        if (!r.ok) setError(d.error ?? "Could not load the resume");
        else setData(d);
      })
      .catch(() => live && setError("Could not load the resume"));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => { live = false; window.removeEventListener("keydown", onKey); };
  }, [id, onClose]);

  const ats = data?.atsAfter ?? 0;
  const atsColor = ats >= 80 ? "text-emerald-700 bg-emerald-50 border-emerald-200" : ats >= 60 ? "text-amber-700 bg-amber-50 border-amber-200" : "text-rose-700 bg-rose-50 border-rose-200";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-2 sm:p-6" onClick={onClose}>
      <div className="flex h-full max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-3">
          <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold text-slate-800">{consultant} · Updated Resume (AI)</p>
            {data && <p className="truncate text-[11.5px] text-slate-400">{data.fileName}</p>}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {data && (
              <a href={resumeHref(data.file)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50">
                <Download className="h-3.5 w-3.5" /> Download
              </a>
            )}
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!data ? (
          <div className="flex flex-1 items-center justify-center text-[13px] text-slate-500">
            {error ?? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading resume…</>}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col-reverse md:flex-row">
            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100 p-3 sm:p-6">
              <div
                className="mx-auto max-w-[820px] rounded-md bg-white px-6 py-8 text-[13px] leading-relaxed text-slate-800 shadow-sm sm:px-10 [&_h1]:mb-1 [&_h1]:text-[20px] [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:border-b [&_h2]:border-slate-200 [&_h2]:pb-1 [&_h2]:text-[14px] [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-wide [&_h3]:mt-3 [&_h3]:font-semibold [&_li]:mb-0.5 [&_p]:mb-1.5 [&_strong]:font-semibold [&_table]:w-full [&_td]:align-top [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: data.html }}
              />
            </div>

            <aside className="flex max-h-[38%] shrink-0 flex-col border-b border-slate-200 md:max-h-none md:w-72 md:border-b-0 md:border-l">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">JD Keywords</p>
                <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-[13px] text-slate-700"><b className="text-[18px] tabular-nums text-slate-900">{data.found}</b> / {data.total} in this resume</span>
                  <span className="text-[11.5px] text-slate-500">{data.mentions} mentions</span>
                </div>
                <span className={cn("mt-2 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-bold tabular-nums", atsColor)}>
                  ATS {data.atsAfter}%<span className="font-medium opacity-70">(was {data.atsBefore}%)</span>
                </span>
              </div>
              <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
                {data.keywords.length === 0 && <li className="px-2 py-3 text-[12px] text-slate-400">No keywords were saved for this resume.</li>}
                {data.keywords.map((k, i) => {
                  const main = k.priority === "main";
                  const notHeld = k.evidence === "none";
                  const low = main && !notHeld && k.count < 10;
                  const heading = k.priority && k.priority !== data.keywords[i - 1]?.priority;
                  return (
                    <Fragment key={k.term}>
                      {heading && (
                        <li className="px-2 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          {k.priority === "main" ? "Main skills · target 10–15×" : k.priority === "required" ? "Required" : "Preferred"}
                        </li>
                      )}
                      <li
                        className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-[12px] hover:bg-slate-50"
                        title={[k.term, k.note, notHeld ? "Not in the consultant's resume, so it isn't claimed. Confirm with the consultant." : ""].filter(Boolean).join("\n")}
                      >
                        <span className={cn("min-w-0 truncate", main && "font-semibold", k.count ? "text-slate-700" : "text-rose-600")}>
                          {k.term}
                          {notHeld && <span className="ml-1 text-[10px] font-medium text-slate-400">not in background</span>}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded px-1.5 text-[11px] font-bold tabular-nums",
                            !k.count ? "bg-rose-50 text-rose-600" : low ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700",
                          )}
                        >
                          {k.count ? `×${k.count}` : "missing"}
                        </span>
                      </li>
                    </Fragment>
                  );
                })}
              </ul>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

export function EasySubmissionsView({ submissions, showRecruiter, dayLabel, ai, canManageAccess, sender }: {
  submissions: EasySubmissionRow[];
  showRecruiter: boolean;
  dayLabel: string;
  ai: { label: string; model: string } | null;
  /** Admin: turn the feature on / off per user */
  canManageAccess: boolean;
  sender: Sender;
}) {
  const { toast, show, hide } = useToast();
  const [openSubs, setOpenSubs] = useState<Set<string>>(new Set());
  const [consultants, setConsultants] = useState<Record<string, ConsultantState>>({});
  const [managingAccess, setManagingAccess] = useState(false);

  const loadConsultants = (subId: string) => {
    setConsultants((c) => ({ ...c, [subId]: { ...c[subId], loading: true, consultants: c[subId]?.consultants ?? [] } }));
    fetch(`/api/easy-submissions/${subId}/consultants`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Could not load consultants");
        setConsultants((c) => ({ ...c, [subId]: { loading: false, consultants: d.consultants, requirement: d.requirement, technology: d.technology, vendorCounts: d.vendorCounts } }));
      })
      .catch((err: Error) => setConsultants((c) => ({ ...c, [subId]: { loading: false, consultants: [], error: err.message } })));
  };

  const toggleSub = (subId: string) => {
    setOpenSubs((s) => {
      const n = new Set(s);
      if (n.has(subId)) n.delete(subId);
      else n.add(subId);
      return n;
    });
    if (!consultants[subId]) loadConsultants(subId);
  };

  const updateConsultant = (subId: string, consultantId: string, patch: Partial<ConsultantOption>) =>
    setConsultants((c) => ({
      ...c,
      [subId]: { ...c[subId], consultants: c[subId].consultants.map((x) => (x.id === consultantId ? { ...x, ...patch } : x)) },
    }));

  return (
    <>
      <Header title="Easy Submissions" subtitle={`Today's submissions · ${dayLabel}`} />
      <div className="space-y-4 p-6">
        <div className={cn("flex flex-wrap items-center gap-3 rounded-2xl border px-5 py-3 text-[12.5px]", ai ? "border-indigo-100 bg-indigo-50/60 text-slate-600" : "border-amber-200 bg-amber-50 text-amber-800")}>
          {ai ? <Bot className="h-4 w-4 text-indigo-600" /> : <AlertTriangle className="h-4 w-4" />}
          {ai ? (
            <p>Click <b>+</b> on a submission to see every In-Market consultant on that technology, then <b>+</b> on a consultant to see vendors for the same client. AI resume updates use <b>{ai.label}</b> ({ai.model}).</p>
          ) : (
            <p>No AI provider is set up, so <b>Update Resume</b> is off. An admin can add an OpenAI / Claude / Gemini key under <b>Administration → AI Settings</b>.</p>
          )}
          {canManageAccess && (
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => setManagingAccess(true)}>
              <ShieldCheck className="h-3.5 w-3.5" /> Manage Access
            </Button>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-slate-800">
                <tr>
                  <th className="w-10 px-3 py-2.5" />
                  {["Submission", "Consultant", "Technology", "Client / Implementation", "Vendor", "Time", ...(showRecruiter ? ["Recruiter"] : []), "Status"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-300">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {submissions.length === 0 ? (
                  <tr>
                    <td colSpan={showRecruiter ? 9 : 8} className="px-4 py-12 text-center text-slate-400">
                      No submissions today yet. <Link href="/admin/submissions/list" className="font-semibold text-indigo-600 hover:underline">Create a submission</Link> and it shows up here.
                    </td>
                  </tr>
                ) : (
                  submissions.map((s) => {
                    const open = openSubs.has(s.id);
                    return (
                      <Fragment key={s.id}>
                        <tr className={cn("hover:bg-slate-50", open && "bg-indigo-50/40")}>
                          <td className="px-3 py-2.5"><ExpandButton open={open} onClick={() => toggleSub(s.id)} label="Show consultants for this requirement" /></td>
                          <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11.5px]">
                            <Link href={`/admin/submissions/${s.id}`} className="font-semibold text-indigo-600 hover:underline" title="Open this submission">
                              {s.submissionId}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-slate-800">
                            <Link href={consultantHref(s.consultantId)} target="_blank" className="hover:text-indigo-600 hover:underline" title="Open consultant profile">{s.consultantName}</Link>
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5"><span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11.5px] font-semibold text-indigo-700">{s.technology}</span></td>
                          <td className="px-4 py-2.5 text-slate-700">
                            {s.clientName || "—"}
                            {s.implementationName && <p className="text-[11px] text-slate-400">via {s.implementationName}</p>}
                          </td>
                          <td className="px-4 py-2.5 text-slate-700">{s.vendorCompany}<p className="text-[11px] text-slate-400">{s.vendorRecruiterName}</p></td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{fmtTime(s.submittedAt)}</td>
                          {showRecruiter && <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{s.recruiterName}</td>}
                          <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{s.status}</td>
                        </tr>
                        {open && (
                          <tr>
                            <td colSpan={showRecruiter ? 9 : 8} className="bg-slate-50/80 px-4 py-3">
                              <ConsultantPanel
                                sub={s}
                                state={consultants[s.id]}
                                aiReady={!!ai}
                                sender={sender}
                                notify={show}
                                onUpdate={(cid, patch) => updateConsultant(s.id, cid, patch)}
                                onReload={() => loadConsultants(s.id)}
                              />
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
      {managingAccess && <AccessDialog onClose={() => setManagingAccess(false)} notify={show} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </>
  );
}

function ConsultantPanel({ sub, state, aiReady, sender, notify, onUpdate, onReload }: {
  sub: EasySubmissionRow;
  state: ConsultantState | undefined;
  aiReady: boolean;
  sender: Sender;
  notify: Notify;
  onUpdate: (consultantId: string, patch: Partial<ConsultantOption>) => void;
  onReload: () => void;
}) {
  const [openConsultants, setOpenConsultants] = useState<Set<string>>(new Set());
  const [vendors, setVendors] = useState<Record<string, VendorState>>({});
  const [tailoring, setTailoring] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<{ id: string; consultant: string } | null>(null);

  if (!state || (state.loading && state.consultants.length === 0)) {
    return <div className="flex items-center gap-2 py-4 text-[12.5px] text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading consultants…</div>;
  }
  if (state.error) return <p className="py-3 text-[12.5px] font-medium text-rose-600">{state.error}</p>;

  const loadVendors = (consultantId: string) => {
    setVendors((v) => ({ ...v, [consultantId]: { loading: true, vendors: v[consultantId]?.vendors ?? [], hidden: 0 } }));
    fetch(`/api/easy-submissions/${sub.id}/vendors?consultantId=${consultantId}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Could not load vendors");
        setVendors((v) => ({ ...v, [consultantId]: { loading: false, vendors: d.vendors, hidden: d.hidden, split: d.split } }));
      })
      .catch((err: Error) => setVendors((v) => ({ ...v, [consultantId]: { loading: false, vendors: [], hidden: 0, error: err.message } })));
  };

  const toggle = (consultantId: string) => {
    setOpenConsultants((s) => {
      const n = new Set(s);
      if (n.has(consultantId)) n.delete(consultantId);
      else n.add(consultantId);
      return n;
    });
    if (!vendors[consultantId]) loadVendors(consultantId);
  };

  const upload = async (c: ConsultantOption, file: File) => {
    setUploading(c.id);
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch(`/api/students/${c.id}/resume`, { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    setUploading(null);
    if (!res.ok) return notify(d.error ?? "Upload failed", "error");
    onUpdate(c.id, { resume: { file: d.resumeFile, name: d.resumeFileName } });
    notify(`Resume uploaded for ${c.name}`, "success");
  };

  /**
   * Starts the AI update in the background, then polls every 3 s until it finishes. `quiet` skips the
   * per-consultant message (Generate All shows one summary instead). Resolves true when it worked.
   */
  const tailor = async (c: ConsultantOption, quiet = false): Promise<boolean> => {
    setTailoring((s) => new Set(s).add(c.id));
    const done = () => setTailoring((s) => { const n = new Set(s); n.delete(c.id); return n; });
    const fail = (message: string) => { done(); if (!quiet) notify(message, "error"); return false; };
    const start = await fetch(`/api/easy-submissions/${sub.id}/tailor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consultantId: c.id }),
    }).catch(() => null);
    const started = await start?.json().catch(() => ({}));
    if (!start?.ok) return fail(started?.error ?? "Could not start the update");

    for (let i = 0; i < 400; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const res = await fetch(`/api/easy-submissions/${sub.id}/tailor?job=${started.jobId}`).catch(() => null);
      if (!res) continue; // a network blip: keep checking
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.status === "failed") return fail(`${c.name}: ${d.error ?? "Could not update the resume"}`);
      if (d.status === "done") {
        done();
        onUpdate(c.id, { tailored: d.result });
        if (!quiet) notify(`Resume updated for ${c.name}: ATS ${d.result.atsBefore}% → ${d.result.atsAfter}%`, "success");
        return true;
      }
    }
    return fail("The update is taking too long. Refresh the page in a few minutes to see it.");
  };

  /** Why a consultant's resume can't be generated, or null when it can */
  const blockReason = (c: ConsultantOption) =>
    !aiReady ? "No AI provider configured"
      : !state.requirement?.jobDescription ? "Submission has no job description"
      : state.vendorCounts?.[c.id] === 0 ? "No vendors for generating resume"
      : !c.resume ? "Upload a resume first"
      : null;
  const eligible = state.consultants.filter((c) => !blockReason(c) && !tailoring.has(c.id));
  const skipped = state.consultants.filter((c) => blockReason(c));

  /** Generate All: every consultant who has vendors and a resume, all at the same time */
  const generateAll = async () => {
    const batch = eligible;
    if (batch.length === 0) return;
    notify(`Generating ${batch.length} resume${batch.length === 1 ? "" : "s"} at once. This takes a few minutes.`, "success");
    const results = await Promise.all(batch.map((c) => tailor(c, true)));
    const ok = results.filter(Boolean).length;
    const failed = batch.filter((_, i) => !results[i]).map((c) => c.name);
    notify(
      failed.length
        ? `${ok} of ${batch.length} resumes generated. Failed: ${failed.join(", ")}. Try those again from their row.`
        : `All ${ok} resume${ok === 1 ? "" : "s"} generated`,
      failed.length ? "error" : "success",
    );
  };
  const generateAllTitle =
    !aiReady ? "No AI provider configured"
      : !state.requirement?.jobDescription ? "Submission has no job description"
      : eligible.length === 0
        ? (tailoring.size ? "Resumes are being generated" : "No vendors for generating resume")
        : `Generate updated resumes for ${eligible.length} consultant${eligible.length === 1 ? "" : "s"} at the same time${skipped.length ? `. Skipped: ${skipped.map((c) => `${c.name} (${blockReason(c)})`).join(", ")}` : ""}`;

  const cols = ["Consultant", "Technology", "Visa / Location", "Resume", "Updated Resume (AI)", "Assigned Recruiter", ""];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {previewing && <ResumePreview id={previewing.id} consultant={previewing.consultant} onClose={() => setPreviewing(null)} />}
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
        <Users2 className="h-4 w-4 text-indigo-600" />
        <p className="text-[12.5px] font-bold text-slate-800">
          {state.technology
            ? <>{state.consultants.length} more consultant{state.consultants.length === 1 ? "" : "s"} on {state.technology}</>
            : <>No technology on {sub.consultantName}&apos;s profile</>}
        </p>
        <span className="text-[11px] text-slate-400">Same technology as {sub.consultantName}&apos;s profile · In-Market (or recently submitted), any recruiter</span>
        {!state.requirement?.jobDescription && (
          <span className="flex items-center gap-1 text-[11.5px] font-medium text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" /> No job description on this submission, so AI updates are off
          </span>
        )}
        {state.consultants.length > 0 && (
          <span className="ml-auto inline-block" title={generateAllTitle}>
            <Button size="sm" onClick={() => void generateAll()} disabled={eligible.length === 0}>
              {tailoring.size > 0 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {eligible.length > 0
                ? `Generate All Resumes (${eligible.length})`
                : tailoring.size > 0 ? `Generating ${tailoring.size}…` : "Generate All Resumes"}
            </Button>
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead className="bg-slate-100">
            <tr>
              <th className="w-10 px-3 py-2" />
              {cols.map((h, i) => <th key={i} className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {state.consultants.length === 0 && (
              <tr>
                <td colSpan={cols.length + 1} className="px-4 py-8 text-center text-slate-400">
                  {state.technology ? (
                    <>No other In-Market consultants on {state.technology}.</>
                  ) : (
                    <>
                      {sub.consultantName}&apos;s profile has no technology, so there is nothing to match on. Set it under{" "}
                      <Link href="/admin/students" className="font-semibold text-indigo-600 hover:underline">Consultants</Link>, then reopen this row.
                    </>
                  )}
                </td>
              </tr>
            )}
            {state.consultants.map((c) => {
              const open = openConsultants.has(c.id);
              const busy = tailoring.has(c.id);
              const blocked = blockReason(c);
              const vendorCount = state.vendorCounts?.[c.id];
              return (
                <Fragment key={c.id}>
                  <tr className={cn("hover:bg-slate-50", open && "bg-sky-50/40")}>
                    <td className="px-3 py-2"><ExpandButton open={open} onClick={() => toggle(c.id)} label="Show vendors for this client" /></td>
                    <td className="px-3 py-2">
                      <Link href={consultantHref(c.id)} target="_blank" className="font-semibold text-slate-800 hover:text-indigo-600 hover:underline" title="Open consultant profile">{c.name}</Link>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {c.projectStatus && <span className="rounded bg-slate-100 px-1.5 text-[10px] text-slate-500">{c.projectStatus}</span>}
                        {c.sentCount > 0 && <span className="rounded bg-emerald-50 px-1.5 text-[10px] font-semibold text-emerald-700">Sent to {c.sentCount}</span>}
                        {vendorCount !== undefined && (
                          <span className={cn("rounded px-1.5 text-[10px] font-semibold", vendorCount ? "bg-sky-50 text-sky-700" : "bg-rose-50 text-rose-600")}>
                            {vendorCount ? `${vendorCount} vendor${vendorCount === 1 ? "" : "s"}` : "No vendors"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{c.technology ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{c.visaStatus ?? "—"}<p className="text-[11px] text-slate-400">{c.location ?? ""}</p></td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col items-start gap-1">
                        {c.resume ? (
                          <a href={resumeHref(c.resume.file)} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-[180px] items-center gap-1 truncate text-[12px] font-medium text-indigo-600 hover:underline" title={c.resume.name}>
                            <FileText className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{c.resume.name}</span>
                          </a>
                        ) : (
                          <span className="text-[11.5px] text-slate-400">No resume</span>
                        )}
                        <label className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-indigo-600">
                          {uploading === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                          {c.resume ? "Replace" : "Upload"}
                          <input
                            type="file"
                            accept=".pdf,.docx"
                            className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(c, f); }}
                          />
                        </label>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {c.tailored ? (
                        <div className="flex flex-col items-start gap-1">
                          <button
                            type="button"
                            onClick={() => setPreviewing({ id: c.tailored!.id, consultant: c.name })}
                            className="inline-flex max-w-[200px] items-center gap-1 text-left text-[12px] font-medium text-emerald-700 hover:underline"
                            title={`Preview ${c.tailored.name}`}
                          >
                            <Eye className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{c.tailored.name}</span>
                          </button>
                          <AtsBadge before={c.tailored.atsBefore} after={c.tailored.atsAfter} missing={c.tailored.missing} />
                        </div>
                      ) : (
                        <span className="text-[11.5px] text-slate-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">{c.recruiterName ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {/* Wrapped so the reason shows on hover even while the button is disabled */}
                      <span className="inline-block" title={blocked ?? "Rewrite the resume for this job with AI and score it"}>
                        <Button size="sm" variant="outline" onClick={() => void tailor(c)} disabled={!!blocked || busy}>
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                          {busy ? "Generating… (2–4 min)" : c.tailored ? "Update Again" : "Generate Resume"}
                        </Button>
                      </span>
                    </td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={cols.length + 1} className="bg-sky-50/50 px-4 py-3">
                        <VendorPanel
                          sub={sub}
                          consultant={c}
                          requirement={state.requirement}
                          state={vendors[c.id]}
                          sender={sender}
                          notify={notify}
                          onSent={() => { loadVendors(c.id); onReload(); }}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VendorPanel({ sub, consultant, requirement, state, sender, notify, onSent }: {
  sub: EasySubmissionRow;
  consultant: ConsultantOption;
  requirement: Requirement | undefined;
  state: VendorState | undefined;
  sender: Sender;
  notify: Notify;
  onSent: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [composeFor, setComposeFor] = useState<VendorOption[] | null>(null);

  if (!state || (state.loading && state.vendors.length === 0)) {
    return <div className="flex items-center gap-2 py-3 text-[12.5px] text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Finding vendors…</div>;
  }
  if (state.error) return <p className="py-2 text-[12.5px] font-medium text-rose-600">{state.error}</p>;

  const toggle = (email: string) => setSelected((s) => { const n = new Set(s); if (n.has(email)) n.delete(email); else n.add(email); return n; });
  const setGroup = (emails: string[], on: boolean) =>
    setSelected((s) => { const n = new Set(s); emails.forEach((e) => (on ? n.add(e) : n.delete(e))); return n; });
  const where = sub.clientName || sub.implementationName ? [sub.clientName, sub.implementationName].filter(Boolean).join(" / ") : sub.technology;
  const primary = state.vendors.filter((v) => v.primary);
  const secondary = state.vendors.filter((v) => !v.primary);

  return (
    <div className="overflow-hidden rounded-xl border border-sky-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-sky-100 px-4 py-2.5">
        <p className="mr-auto text-[12.5px] font-bold text-slate-800">
          {state.vendors.length} vendor{state.vendors.length === 1 ? "" : "s"} for {where} · {primary.length} primary
          <span className="ml-2 text-[11px] font-normal text-slate-400">
            for {consultant.name}{state.hidden ? ` · ${state.hidden} already have this requirement (same vendor company) or were already sent, hidden` : ""}
          </span>
          {state.split && (
            <span
              className="mt-0.5 block text-[11px] font-medium text-sky-700"
              title="Each vendor is given to one consultant on this requirement, so no vendor gets every consultant. Primary and secondary vendors are split separately."
            >
              {consultant.name}&apos;s share: {state.split.mine} of {state.split.total} vendors ({state.split.primaryTotal} primary), split across {state.split.consultants} consultants
            </span>
          )}
        </p>
        <Button size="sm" disabled={selected.size === 0} onClick={() => setComposeFor(state.vendors.filter((v) => selected.has(v.email)))}>
          <Send className="h-3.5 w-3.5" /> Submit to selected ({selected.size})
        </Button>
      </div>
      {state.vendors.length === 0 ? (
        <p className="px-4 py-6 text-center text-[12px] text-slate-400">
          No other vendors on file for this client. Add vendors in <Link href="/admin/vendor-management" className="font-semibold text-indigo-600 hover:underline">Vendor Management</Link> with this client or implementation partner.
        </p>
      ) : (
        <div className="max-h-[520px] overflow-auto">
          <VendorGroup
            title={`Primary · last submission on ${sub.technology}`}
            hint="Vendors whose most recent submission (or vendor book entry) is on this technology"
            tone="primary"
            vendors={primary}
            selected={selected}
            onToggle={toggle}
            onSetAll={(on) => setGroup(primary.map((v) => v.email), on)}
            onSend={(v) => setComposeFor([v])}
          />
          <VendorGroup
            title={`Secondary · other vendors for ${where}`}
            hint="Their last submission was on another technology, or they have no submission history"
            tone="secondary"
            vendors={secondary}
            selected={selected}
            onToggle={toggle}
            onSetAll={(on) => setGroup(secondary.map((v) => v.email), on)}
            onSend={(v) => setComposeFor([v])}
          />
        </div>
      )}

      {composeFor && (
        <SendDialog
          sub={sub}
          consultant={consultant}
          requirement={requirement}
          vendors={composeFor}
          sender={sender}
          onClose={() => setComposeFor(null)}
          onDone={(sent, failed) => {
            setComposeFor(null);
            setSelected(new Set());
            notify(failed ? `Sent ${sent}, failed ${failed}` : `Resume sent to ${sent} vendor${sent === 1 ? "" : "s"}`, failed ? "error" : "success");
            onSent();
          }}
        />
      )}
    </div>
  );
}

const fmtShortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit", timeZone: APP_TZ });

function VendorGroup({ title, hint, tone, vendors, selected, onToggle, onSetAll, onSend }: {
  title: string;
  hint: string;
  tone: "primary" | "secondary";
  vendors: VendorOption[];
  selected: Set<string>;
  onToggle: (email: string) => void;
  onSetAll: (on: boolean) => void;
  onSend: (v: VendorOption) => void;
}) {
  const picked = vendors.filter((v) => selected.has(v.email)).length;
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <div className={cn("sticky top-0 z-10 flex flex-wrap items-center gap-2 px-4 py-2", tone === "primary" ? "bg-emerald-50" : "bg-slate-100")}>
        <input
          type="checkbox"
          className="h-3.5 w-3.5 accent-indigo-600"
          disabled={vendors.length === 0}
          checked={vendors.length > 0 && picked === vendors.length}
          onChange={(e) => onSetAll(e.target.checked)}
          aria-label={`Select all ${tone} vendors`}
        />
        <p className={cn("text-[12px] font-bold", tone === "primary" ? "text-emerald-800" : "text-slate-700")}>
          {title} <span className="font-semibold">({vendors.length})</span>
        </p>
        <span className="text-[11px] text-slate-400">{hint}</span>
      </div>
      {vendors.length === 0 ? (
        <p className="px-4 py-3 text-[12px] text-slate-400">None</p>
      ) : (
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="w-10 px-3 py-1.5" />
              {["Vendor", "Company", "Email", "Phone", "Last Submission", "Found in", ""].map((h, i) => (
                <th key={i} className="whitespace-nowrap px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vendors.map((v) => (
              <tr key={v.email} className={cn("hover:bg-slate-50", selected.has(v.email) && "bg-indigo-50/40")}>
                <td className="px-3 py-2"><input type="checkbox" className="h-3.5 w-3.5 accent-indigo-600" checked={selected.has(v.email)} onChange={() => onToggle(v.email)} /></td>
                <td className="px-3 py-2 font-semibold text-slate-800">{v.name ?? "—"}</td>
                <td className="px-3 py-2 text-slate-600">{v.company ?? "—"}</td>
                <td className="px-3 py-2 text-slate-600">{v.email}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-500">{v.phone ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  {v.lastTechnology ? (
                    <>
                      <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold", tone === "primary" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600")}>{v.lastTechnology}</span>
                      {v.lastSubmittedAt && <span className="ml-1.5 text-[11px] text-slate-400">{fmtShortDate(v.lastSubmittedAt)}</span>}
                    </>
                  ) : (
                    <span className="text-[11px] text-slate-300">No submissions</span>
                  )}
                </td>
                <td className="px-3 py-2 text-[11px] text-slate-400">{v.sources.join(", ")}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => onSend(v)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-indigo-600 hover:underline">
                    <Send className="h-3 w-3" /> Send
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SendDialog({ sub, consultant, requirement, vendors, sender, onClose, onDone }: {
  sub: EasySubmissionRow;
  consultant: ConsultantOption;
  requirement: Requirement | undefined;
  vendors: VendorOption[];
  sender: Sender;
  onClose: () => void;
  onDone: (sent: number, failed: number) => void;
}) {
  const client = sub.clientName || sub.implementationName;
  const builtIn = {
    subject: `${sub.technology} - ${consultant.name}${client ? ` - ${client}` : ""}`,
    body: [
      "Hi {firstName},",
      "",
      `Please find attached the resume of ${consultant.name} for the ${sub.technology} position${client ? ` with ${client}` : ""}.`,
      "",
      `Consultant: ${consultant.name}`,
      ...(consultant.visaStatus ? [`Visa: ${consultant.visaStatus}`] : []),
      ...(consultant.location ? [`Location: ${consultant.location}`] : []),
      ...(requirement?.payRate ? [`Rate: ${requirement.payRate}`] : []),
      "",
      "Please review and let me know a good time to connect.",
      "",
      signOff(sender.signature, sender.name, sender.email),
      ...(requirement?.jobDescription ? ["", "--- Job Description ---", requirement.jobDescription.trim()] : []),
    ].join("\n"),
  };
  // Vendor fields ({firstName}, {vendorName}, {company}) stay in place: they're filled per vendor on send
  const vars: TemplateVars = {
    consultantName: consultant.name,
    technology: sub.technology,
    client: client ?? "",
    visa: consultant.visaStatus ?? "",
    location: consultant.location ?? "",
    rate: requirement?.payRate ?? "",
    jobDescription: requirement?.jobDescription?.trim() ?? "",
    myName: sender.name,
    myEmail: sender.email,
    signature: signOff(sender.signature, sender.name, sender.email),
  };
  const apply = (t: EmailTemplateDto | null) =>
    t ? { subject: fillFields(t.subject, vars).trim() || builtIn.subject, body: renderBody(t.body, vars) } : builtIn;

  const initialTemplate = defaultTemplate(sender.templates, "submission");
  const [templateId, setTemplateId] = useState(initialTemplate?.id ?? "");
  const [subject, setSubject] = useState(() => apply(initialTemplate).subject);
  const [body, setBody] = useState(() => apply(initialTemplate).body);
  const pickTemplate = (id: string) => {
    const next = apply(sender.templates.find((t) => t.id === id) ?? null);
    setTemplateId(id);
    setSubject(next.subject);
    setBody(next.body);
  };
  // The AI-updated resume when there is one, otherwise the original
  const useTailored = !!consultant.tailored;
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const attachment = useTailored && consultant.tailored ? consultant.tailored.name : consultant.resume?.name;

  const send = async () => {
    setError("");
    setSending(true);
    const res = await fetch(`/api/easy-submissions/${sub.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consultantId: consultant.id, vendors, subject, body, useTailored }),
    });
    const d = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) return setError(d.error ?? "Could not send");
    const results = (d.results ?? []) as { ok: boolean }[];
    onDone(results.filter((r) => r.ok).length, results.filter((r) => !r.ok).length);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between rounded-t-2xl bg-slate-800 px-5 py-3">
          <div>
            <h2 className="text-[14px] font-semibold text-white">Submit {consultant.name}</h2>
            <p className="text-[11px] text-slate-400">To {vendors.length} vendor{vendors.length === 1 ? "" : "s"}, each gets a separate email</p>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div className="flex items-end gap-2">
            <label className="block flex-1 space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Template</span>
              <select
                value={templateId}
                onChange={(e) => pickTemplate(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">Standard (built-in)</option>
                {sender.templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.isDefault ? " ★" : ""}{t.category === "general" ? ` · ${categoryLabel(t.category)}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <Link href="/admin/email-templates" target="_blank" className="mb-2 whitespace-nowrap text-[11.5px] font-semibold text-indigo-600 hover:underline">
              Manage templates
            </Link>
          </div>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="h-9 w-full rounded-lg border border-slate-200 px-3 text-[13px] focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Message</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={14} className="w-full resize-y rounded-lg border border-slate-200 p-3 font-[inherit] text-[12.5px] leading-relaxed focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
          </label>
          {!attachment && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">
              {consultant.name} has no resume to attach. Close this and upload one first.
            </p>
          )}
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={send} disabled={sending || !attachment || !subject.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {sending ? "Sending…" : `Send to ${vendors.length}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
