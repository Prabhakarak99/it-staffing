"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, Bot, FileText, Loader2, Minus, Plus, Send, Sparkles, Upload, Users2, X, Zap,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { ConsultantOption, EasySubmissionRow, VendorOption } from "@/lib/easy/data";

interface Requirement {
  technology: string;
  jobDescription: string | null;
  clientName: string | null;
  implementationName: string | null;
  clientLocation: string | null;
  payRate: string | null;
}

interface ConsultantState { loading: boolean; error?: string; consultants: ConsultantOption[]; requirement?: Requirement }
interface VendorState { loading: boolean; error?: string; vendors: VendorOption[]; hidden: number }

type Notify = (message: string, type: "success" | "error") => void;

const resumeHref = (file: string) => `/api/resumes/${file}`;
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

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

export function EasySubmissionsView({ submissions, showRecruiter, dayLabel, ai, sender }: {
  submissions: EasySubmissionRow[];
  showRecruiter: boolean;
  dayLabel: string;
  ai: { label: string; model: string } | null;
  sender: { name: string; email: string };
}) {
  const { toast, show, hide } = useToast();
  const [openSubs, setOpenSubs] = useState<Set<string>>(new Set());
  const [consultants, setConsultants] = useState<Record<string, ConsultantState>>({});

  const loadConsultants = (subId: string) => {
    setConsultants((c) => ({ ...c, [subId]: { loading: true, consultants: c[subId]?.consultants ?? [], requirement: c[subId]?.requirement } }));
    fetch(`/api/easy-submissions/${subId}/consultants`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Could not load consultants");
        setConsultants((c) => ({ ...c, [subId]: { loading: false, consultants: d.consultants, requirement: d.requirement } }));
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
                          <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11.5px] text-slate-600">{s.submissionId}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-slate-800">{s.consultantName}</td>
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
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </>
  );
}

function ConsultantPanel({ sub, state, aiReady, sender, notify, onUpdate, onReload }: {
  sub: EasySubmissionRow;
  state: ConsultantState | undefined;
  aiReady: boolean;
  sender: { name: string; email: string };
  notify: Notify;
  onUpdate: (consultantId: string, patch: Partial<ConsultantOption>) => void;
  onReload: () => void;
}) {
  const [openConsultants, setOpenConsultants] = useState<Set<string>>(new Set());
  const [vendors, setVendors] = useState<Record<string, VendorState>>({});
  const [tailoring, setTailoring] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState<string | null>(null);

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
        setVendors((v) => ({ ...v, [consultantId]: { loading: false, vendors: d.vendors, hidden: d.hidden } }));
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

  /** Starts the AI update in the background, then polls every 3 s until it finishes */
  const tailor = async (c: ConsultantOption) => {
    setTailoring((s) => new Set(s).add(c.id));
    const done = () => setTailoring((s) => { const n = new Set(s); n.delete(c.id); return n; });
    const start = await fetch(`/api/easy-submissions/${sub.id}/tailor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consultantId: c.id }),
    });
    const started = await start.json().catch(() => ({}));
    if (!start.ok) { done(); return notify(started.error ?? "Could not start the update", "error"); }

    for (let i = 0; i < 100; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const res = await fetch(`/api/easy-submissions/${sub.id}/tailor?job=${started.jobId}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.status === "failed") { done(); return notify(d.error ?? "Could not update the resume", "error"); }
      if (d.status === "done") {
        done();
        onUpdate(c.id, { tailored: d.result });
        return notify(`Resume updated for ${c.name}: ATS ${d.result.atsBefore}% → ${d.result.atsAfter}%`, "success");
      }
    }
    done();
    notify("The update is taking too long. Refresh the page in a minute to see it.", "error");
  };

  const cols = ["Consultant", "Technology", "Visa / Location", "Resume", "Updated Resume (AI)", "Assigned Recruiter", ""];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
        <Users2 className="h-4 w-4 text-indigo-600" />
        <p className="text-[12.5px] font-bold text-slate-800">
          {state.consultants.length} consultant{state.consultants.length === 1 ? "" : "s"} on {sub.technology}
        </p>
        <span className="text-[11px] text-slate-400">In-Market, any recruiter</span>
        {!state.requirement?.jobDescription && (
          <span className="ml-auto flex items-center gap-1 text-[11.5px] font-medium text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" /> No job description on this submission, so AI updates are off
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
            {state.consultants.map((c) => {
              const open = openConsultants.has(c.id);
              const busy = tailoring.has(c.id);
              const canTailor = aiReady && !!c.resume && !!state.requirement?.jobDescription;
              return (
                <Fragment key={c.id}>
                  <tr className={cn("hover:bg-slate-50", open && "bg-sky-50/40")}>
                    <td className="px-3 py-2"><ExpandButton open={open} onClick={() => toggle(c.id)} label="Show vendors for this client" /></td>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-slate-800">{c.name}</p>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {c.isOriginal && <span className="rounded bg-indigo-100 px-1.5 text-[10px] font-semibold text-indigo-700">Submitted</span>}
                        {c.projectStatus && <span className="rounded bg-slate-100 px-1.5 text-[10px] text-slate-500">{c.projectStatus}</span>}
                        {c.sentCount > 0 && <span className="rounded bg-emerald-50 px-1.5 text-[10px] font-semibold text-emerald-700">Sent to {c.sentCount}</span>}
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
                          <a href={resumeHref(c.tailored.file)} className="inline-flex max-w-[200px] items-center gap-1 text-[12px] font-medium text-emerald-700 hover:underline" title={c.tailored.name}>
                            <Sparkles className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{c.tailored.name}</span>
                          </a>
                          <AtsBadge before={c.tailored.atsBefore} after={c.tailored.atsAfter} missing={c.tailored.missing} />
                        </div>
                      ) : (
                        <span className="text-[11.5px] text-slate-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">{c.recruiterName ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant={c.tailored ? "outline" : "default"}
                        onClick={() => tailor(c)}
                        disabled={!canTailor || busy}
                        title={!aiReady ? "No AI provider configured" : !c.resume ? "Upload a resume first" : !state.requirement?.jobDescription ? "Submission has no job description" : "Rewrite the resume for this job with AI and score it"}
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                        {busy ? "Updating… (≈1 min)" : c.tailored ? "Update Again" : "Update Resume"}
                      </Button>
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
  sender: { name: string; email: string };
  notify: Notify;
  onSent: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [composeFor, setComposeFor] = useState<VendorOption[] | null>(null);

  if (!state || (state.loading && state.vendors.length === 0)) {
    return <div className="flex items-center gap-2 py-3 text-[12.5px] text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Finding vendors…</div>;
  }
  if (state.error) return <p className="py-2 text-[12.5px] font-medium text-rose-600">{state.error}</p>;

  const all = state.vendors.map((v) => v.email);
  const toggle = (email: string) => setSelected((s) => { const n = new Set(s); if (n.has(email)) n.delete(email); else n.add(email); return n; });
  const where = sub.clientName || sub.implementationName ? [sub.clientName, sub.implementationName].filter(Boolean).join(" / ") : sub.technology;

  return (
    <div className="overflow-hidden rounded-xl border border-sky-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-sky-100 px-4 py-2.5">
        <p className="mr-auto text-[12.5px] font-bold text-slate-800">
          {state.vendors.length} vendor{state.vendors.length === 1 ? "" : "s"} for {where}
          <span className="ml-2 text-[11px] font-normal text-slate-400">
            for {consultant.name}{state.hidden ? ` · ${state.hidden} already submitted / sent, hidden` : ""}
          </span>
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
        <div className="max-h-[360px] overflow-auto">
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 bg-slate-100">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input type="checkbox" className="h-3.5 w-3.5 accent-indigo-600" checked={selected.size === all.length} onChange={(e) => setSelected(e.target.checked ? new Set(all) : new Set())} />
                </th>
                {["Vendor", "Company", "Email", "Phone", "Found in", ""].map((h, i) => (
                  <th key={i} className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.vendors.map((v) => (
                <tr key={v.email} className={cn("hover:bg-slate-50", selected.has(v.email) && "bg-indigo-50/40")}>
                  <td className="px-3 py-2"><input type="checkbox" className="h-3.5 w-3.5 accent-indigo-600" checked={selected.has(v.email)} onChange={() => toggle(v.email)} /></td>
                  <td className="px-3 py-2 font-semibold text-slate-800">{v.name ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{v.company ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{v.email}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">{v.phone ?? "—"}</td>
                  <td className="px-3 py-2 text-[11px] text-slate-400">{v.sources.join(", ")}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setComposeFor([v])} className="inline-flex items-center gap-1 text-[12px] font-semibold text-indigo-600 hover:underline">
                      <Send className="h-3 w-3" /> Send
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

function SendDialog({ sub, consultant, requirement, vendors, sender, onClose, onDone }: {
  sub: EasySubmissionRow;
  consultant: ConsultantOption;
  requirement: Requirement | undefined;
  vendors: VendorOption[];
  sender: { name: string; email: string };
  onClose: () => void;
  onDone: (sent: number, failed: number) => void;
}) {
  const client = sub.clientName || sub.implementationName;
  const [subject, setSubject] = useState(`${sub.technology} - ${consultant.name}${client ? ` - ${client}` : ""}`);
  const [body, setBody] = useState(
    [
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
      "Thanks,",
      sender.name,
      sender.email,
      ...(requirement?.jobDescription ? ["", "--- Job Description ---", requirement.jobDescription.trim()] : []),
    ].join("\n"),
  );
  const [useTailored, setUseTailored] = useState(!!consultant.tailored);
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
          <div className="flex flex-wrap gap-1.5">
            {vendors.map((v) => (
              <span key={v.email} className="rounded-lg bg-slate-100 px-2 py-1 text-[11.5px] text-slate-700" title={v.email}>
                {v.name ?? v.email}{v.company ? ` · ${v.company}` : ""}
              </span>
            ))}
          </div>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="h-9 w-full rounded-lg border border-slate-200 px-3 text-[13px] focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Message</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={14} className="w-full resize-y rounded-lg border border-slate-200 p-3 font-[inherit] text-[12.5px] leading-relaxed focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            <span className="text-[11px] text-slate-400">{"{firstName}"} and {"{company}"} are filled in for each vendor.</span>
          </label>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12.5px]">
            <p className="font-semibold text-slate-700">Attachment</p>
            {consultant.tailored && (
              <label className="mt-1.5 flex items-center gap-2">
                <input type="radio" checked={useTailored} onChange={() => setUseTailored(true)} className="accent-indigo-600" />
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" /> AI-updated: {consultant.tailored.name}
                <span className="text-[11px] text-slate-400">ATS {consultant.tailored.atsAfter}%</span>
              </label>
            )}
            {consultant.resume && (
              <label className="mt-1.5 flex items-center gap-2">
                <input type="radio" checked={!useTailored || !consultant.tailored} onChange={() => setUseTailored(false)} className="accent-indigo-600" />
                <FileText className="h-3.5 w-3.5 text-slate-500" /> Original: {consultant.resume.name}
              </label>
            )}
            {!attachment && <p className="mt-1 font-medium text-rose-600">No resume to attach. Upload one first.</p>}
          </div>
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">{error}</p>}
        </div>
        <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-3">
          <p className="mr-auto text-[11px] text-slate-400">Sent from your Gmail if connected, otherwise from the company mailbox with replies to {sender.email}.</p>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={send} disabled={sending || !attachment || !subject.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {sending ? "Sending…" : `Send to ${vendors.length}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
