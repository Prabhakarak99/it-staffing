"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Eye, FileText, Loader2, Send, Sparkles, Users2, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { APP_TZ } from "@/lib/tz";
import type { VendorMatch } from "@/lib/vendors/matches";
import { defaultTemplate, fillFields, renderBody, signOff, type EmailTemplateDto, type TemplateVars } from "@/lib/email-templates/render";
import { AtsBadge, ResumePreview } from "../easy-submissions/easy-view";

export interface Sender { name: string; email: string; signature: string; templates: EmailTemplateDto[] }
interface VendorLite { id: string; name: string; companyName: string; email: string; clients: string | null; jd: { text: string; title: string | null } | null }
type Notify = (message: string, type?: "success" | "error") => void;

const resumeHref = (file: string) => `/api/resumes/${file}`;
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: APP_TZ, month: "short", day: "numeric" });

/** The "+" panel under a vendor: matched consultants, AI resume for this vendor's JD, and send */
export function VendorConsultants({ vendor, aiReady, sender, notify, onSent }: {
  vendor: VendorLite;
  aiReady: boolean;
  sender: Sender;
  notify: Notify;
  onSent: () => void;
}) {
  const [state, setState] = useState<{ loading: boolean; error?: string; consultants: VendorMatch[]; technologies: string[] }>({ loading: true, consultants: [], technologies: [] });
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [previewing, setPreviewing] = useState<{ id: string; name: string } | null>(null);
  const [composeFor, setComposeFor] = useState<VendorMatch | null>(null);

  const load = useCallback(() => {
    fetch(`/api/vendor-management/${vendor.id}/consultants`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Could not load consultants");
        setState({ loading: false, consultants: d.consultants, technologies: d.technologies });
      })
      .catch((err: Error) => setState({ loading: false, error: err.message, consultants: [], technologies: [] }));
  }, [vendor.id]);
  useEffect(load, [load]);

  const patch = (id: string, p: Partial<VendorMatch>) =>
    setState((s) => ({ ...s, consultants: s.consultants.map((c) => (c.id === id ? { ...c, ...p } : c)) }));

  /** AI resume for this vendor's JD: start, then poll every 3 s */
  const tailor = async (c: VendorMatch) => {
    setBusy((s) => new Set(s).add(c.id));
    const done = () => setBusy((s) => { const n = new Set(s); n.delete(c.id); return n; });
    const start = await fetch(`/api/vendor-management/${vendor.id}/tailor`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consultantId: c.id }),
    }).catch(() => null);
    const started = await start?.json().catch(() => ({}));
    if (!start?.ok) { done(); return notify(started?.error ?? "Could not start the update", "error"); }
    for (let i = 0; i < 400; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const res = await fetch(`/api/vendor-management/${vendor.id}/tailor?job=${started.jobId}`).catch(() => null);
      if (!res) continue;
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.status === "failed") { done(); return notify(`${c.name}: ${d.error ?? "Could not update the resume"}`, "error"); }
      if (d.status === "done") {
        done();
        patch(c.id, { tailored: d.result });
        return notify(`Resume updated for ${c.name}: ATS ${d.result.atsBefore}% → ${d.result.atsAfter}%`, "success");
      }
    }
    done();
    notify("The update is taking too long. Reopen this vendor in a few minutes to see it.", "error");
  };

  const noJd = !vendor.jd;
  const blockReason = (c: VendorMatch) =>
    !aiReady ? "No AI provider configured"
      : noJd ? "This vendor has no job description. Add one with the pencil icon."
      : !c.resume ? "Upload the consultant's resume first (Resumes tab)"
      : null;

  if (state.loading) return <div className="flex items-center gap-2 py-3 text-[12px] text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Finding matching consultants…</div>;
  if (state.error) return <p className="py-3 text-[12px] font-medium text-rose-600">{state.error}</p>;

  return (
    <div className="overflow-hidden rounded-xl border border-sky-200 bg-white">
      {previewing && <ResumePreview id={previewing.id} consultant={previewing.name} onClose={() => setPreviewing(null)} />}
      {composeFor && (
        <ResumeEmailDialog
          vendor={vendor}
          consultant={composeFor}
          sender={sender}
          onClose={() => setComposeFor(null)}
          onSent={(attached) => {
            patch(composeFor.id, { sentCount: composeFor.sentCount + 1, lastSentAt: new Date().toISOString() });
            notify(`Sent ${composeFor.name}'s resume (${attached}) to ${vendor.name}`, "success");
            setComposeFor(null);
            onSent();
          }}
        />
      )}
      <div className="flex flex-wrap items-center gap-2 border-b border-sky-100 px-4 py-2.5">
        <Users2 className="h-4 w-4 text-sky-600" />
        <p className="text-[12.5px] font-bold text-slate-800">
          {state.consultants.length} matched consultant{state.consultants.length === 1 ? "" : "s"}
        </p>
        <span className="text-[11px] text-slate-400">
          {state.technologies.length ? `In-Market on ${state.technologies.join(", ")}` : "This vendor has no technologies yet"}
        </span>
        {noJd && <span className="ml-auto text-[11.5px] font-medium text-amber-700">No job description, so AI resume updates are off</span>}
      </div>
      {state.consultants.length === 0 ? (
        <p className="px-4 py-6 text-center text-[12px] text-slate-400">
          {state.technologies.length ? "No In-Market consultants on these technologies." : "Add technologies to this vendor (pencil icon) to see matching consultants."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50">
              <tr>
                {["Consultant", "Visa / Location", "Resume", "Updated Resume (AI)", ""].map((h, i) => (
                  <th key={i} className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.consultants.map((c) => {
                const blocked = blockReason(c);
                const isBusy = busy.has(c.id);
                return (
                  <tr key={c.id} className="align-top">
                    <td className="px-3 py-2">
                      <p className="font-semibold text-slate-800">{c.name}</p>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {c.technology && <span className="rounded bg-indigo-50 px-1.5 text-[10px] font-semibold text-indigo-700">{c.technology}</span>}
                        {c.sentCount > 0 && (
                          <span className="rounded bg-emerald-50 px-1.5 text-[10px] font-semibold text-emerald-700">
                            Sent{c.sentCount > 1 ? ` ${c.sentCount}×` : ""}{c.lastSentAt ? ` · ${fmtDay(c.lastSentAt)}` : ""}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{c.visa ?? "—"}<p className="text-[11px] text-slate-400">{c.location ?? ""}</p></td>
                    <td className="px-3 py-2">
                      {c.resume ? (
                        <a href={resumeHref(c.resume.file)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] font-medium text-indigo-600 hover:underline">
                          <FileText className="h-3.5 w-3.5" /> {c.resume.name}
                        </a>
                      ) : (
                        <Link href={`/admin/resumes?consultant=${c.id}`} className="text-[11.5px] text-slate-400 hover:text-indigo-600 hover:underline">No resume · upload</Link>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {c.tailored ? (
                        <div className="flex flex-col items-start gap-1">
                          <button type="button" onClick={() => setPreviewing({ id: c.tailored!.id, name: c.name })}
                            className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-700 hover:underline" title="Preview">
                            <Eye className="h-3.5 w-3.5" /> {c.tailored.name}
                          </button>
                          <AtsBadge before={c.tailored.atsBefore} after={c.tailored.atsAfter} missing={c.tailored.missing} />
                        </div>
                      ) : (
                        <span className="text-[11.5px] text-slate-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <div className="flex justify-end gap-1.5">
                        <span className="inline-block" title={blocked ?? "Rewrite the resume for this vendor's job description with AI"}>
                          <Button size="sm" variant="outline" onClick={() => void tailor(c)} disabled={!!blocked || isBusy}>
                            {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                            {isBusy ? "Updating… (2–4 min)" : c.tailored ? "Update Again" : "Update Resume"}
                          </Button>
                        </span>
                        <span className="inline-block" title={!c.resume && !c.tailored ? "No resume to attach" : `Email ${c.name}'s resume to ${vendor.name}`}>
                          <Button size="sm" onClick={() => setComposeFor(c)} disabled={(!c.resume && !c.tailored) || isBusy}>
                            <Send className="h-3.5 w-3.5" /> Send Email
                          </Button>
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ResumeEmailDialog({ vendor, consultant, sender, onClose, onSent }: {
  vendor: VendorLite;
  consultant: VendorMatch;
  sender: Sender;
  onClose: () => void;
  onSent: (attached: string) => void;
}) {
  const client = vendor.clients?.split(",")[0]?.trim() || "";
  const tech = consultant.technology ?? "";
  const role = vendor.jd?.title || tech;
  const sig = signOff(sender.signature, sender.name, sender.email);
  const builtIn = {
    subject: `${role} - ${consultant.name}${client ? ` - ${client}` : ""}`,
    body: [
      "Hi {firstName},",
      "",
      `Please find attached the resume of ${consultant.name} for the ${role} position${client ? ` with ${client}` : ""}.`,
      "",
      `Consultant: ${consultant.name}`,
      ...(consultant.visa ? [`Visa: ${consultant.visa}`] : []),
      ...(consultant.location ? [`Location: ${consultant.location}`] : []),
      "",
      "Please review and let me know a good time to connect.",
      "",
      sig,
    ].join("\n"),
  };
  // Vendor fields stay as {firstName} / {company}: the server fills them in
  const vars: TemplateVars = {
    consultantName: consultant.name, technology: tech, client, visa: consultant.visa ?? "", location: consultant.location ?? "",
    rate: "", jobDescription: vendor.jd?.text ?? "", myName: sender.name, myEmail: sender.email, signature: sig,
  };
  const apply = (t: EmailTemplateDto | null) => (t ? { subject: fillFields(t.subject, vars).trim() || builtIn.subject, body: renderBody(t.body, vars) } : builtIn);
  const initial = defaultTemplate(sender.templates, "submission");
  const [templateId, setTemplateId] = useState(initial?.id ?? "");
  const [subject, setSubject] = useState(() => apply(initial).subject);
  const [body, setBody] = useState(() => apply(initial).body);
  const [useTailored, setUseTailored] = useState(!!consultant.tailored);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const pick = (id: string) => {
    const next = apply(sender.templates.find((t) => t.id === id) ?? null);
    setTemplateId(id);
    setSubject(next.subject);
    setBody(next.body);
  };

  const send = async () => {
    setError("");
    setSending(true);
    const res = await fetch(`/api/vendor-management/${vendor.id}/send`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consultantId: consultant.id, subject, body, useTailored }),
    });
    const d = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) return setError(d.error ?? "Could not send");
    onSent(d.attached);
  };

  const attachName = useTailored && consultant.tailored ? consultant.tailored.name : consultant.resume?.name;
  const field = "w-full rounded-lg border border-slate-200 text-[13px] focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between rounded-t-2xl bg-slate-800 px-5 py-3">
          <div>
            <h2 className="text-[14px] font-semibold text-white">Send {consultant.name}&apos;s resume</h2>
            <p className="text-[11px] text-slate-400">To {vendor.name} &lt;{vendor.email}&gt; · {vendor.companyName}</p>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div className="flex items-end gap-2">
            <label className="block flex-1 space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Template</span>
              <select value={templateId} onChange={(e) => pick(e.target.value)} className={cn(field, "h-9 bg-white px-2.5")}>
                <option value="">Standard (built-in)</option>
                {sender.templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isDefault ? " ★" : ""}</option>)}
              </select>
            </label>
            <Link href="/admin/email-templates" target="_blank" className="mb-2 whitespace-nowrap text-[11.5px] font-semibold text-indigo-600 hover:underline">Manage templates</Link>
          </div>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className={cn(field, "h-9 px-3")} />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Message</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={13} className={cn(field, "resize-y p-3 font-[inherit] text-[12.5px] leading-relaxed")} />
          </label>
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
            <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Attached: <b>{attachName ?? "—"}</b></span>
            {consultant.tailored && (
              <label className="ml-auto flex items-center gap-1.5">
                <input type="checkbox" checked={useTailored} onChange={(e) => setUseTailored(e.target.checked)} className="h-3.5 w-3.5 accent-indigo-600" />
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" /> Use the AI-updated resume
              </label>
            )}
          </div>
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={send} disabled={sending || !attachName || !subject.trim() || !body.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
