"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Eye, FileText, Loader2, Mail, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RequirementRow } from "@/lib/requirements/constants";
import type { VendorMatch } from "@/lib/vendors/matches";
import { defaultTemplate, renderBody, fillFields, signOff, type TemplateVars } from "@/lib/email-templates/render";
import { ResumePreview } from "../easy-submissions/easy-view";
import type { Sender } from "../vendor-management/vendor-consultants";

type Step = "idle" | "updating" | "sending" | "sent" | "failed";
interface RowState { step: Step; error?: string }

const poll = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Send Resume for one requirement: pick one or more of your matched consultants, then one click
 * updates each resume for this JD (all at once) and emails the vendor, one email per consultant with
 * that consultant's updated resume attached.
 */
export function SendResumeDialog({ req, sender, aiReady, onClose, onDone }: {
  req: RequirementRow;
  sender: Sender;
  aiReady: boolean;
  onClose: () => void;
  onDone: (sent: number) => void;
}) {
  const api = `/api/vendor-requirements/${req.id}`;
  const to = req.vendorEmail ?? req.fromEmail;
  const role = req.jobTitle || req.technology || "the";
  const sig = signOff(sender.signature, sender.name, sender.email);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [consultants, setConsultants] = useState<VendorMatch[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [running, setRunning] = useState(false);
  const [previewing, setPreviewing] = useState<{ id: string; name: string } | null>(null);

  // The message is a template: {consultantName}, {visa}, {location} are filled in per consultant
  const builtIn = {
    subject: `${role} - {consultantName}${req.clientName ? ` - ${req.clientName}` : ""}`,
    body: [
      "Hi {firstName},",
      "",
      `Please find attached the resume of {consultantName} for the ${role} position${req.clientName ? ` with ${req.clientName}` : ""}.`,
      "",
      "Consultant: {consultantName}",
      "Visa: {visa}",
      "Location: {location}",
      ...(req.rate ? [`Rate: ${req.rate}`] : []),
      "",
      "Please review and let me know a good time to connect.",
      "",
      "{signature}",
    ].join("\n"),
  };
  const initialTemplate = defaultTemplate(sender.templates, "submission");
  const [templateId, setTemplateId] = useState(initialTemplate?.id ?? "");
  const [subject, setSubject] = useState(initialTemplate?.subject.trim() || builtIn.subject);
  const [body, setBody] = useState(initialTemplate?.body ?? builtIn.body);
  const pickTemplate = (id: string) => {
    const t = sender.templates.find((x) => x.id === id);
    setTemplateId(id);
    setSubject(t?.subject.trim() || builtIn.subject);
    setBody(t?.body ?? builtIn.body);
  };

  useEffect(() => {
    fetch(`${api}/consultants`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Could not load your consultants");
        const list = d.consultants as VendorMatch[];
        setConsultants(list);
        // Everyone ready to go is ticked; already-sent and no-resume aren't
        setSelected(new Set(list.filter((c) => c.resume && c.sentCount === 0).map((c) => c.id)));
      })
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [api]);

  const varsFor = (c: VendorMatch): TemplateVars => ({
    consultantName: c.name, technology: c.technology ?? req.technology ?? "", client: req.clientName ?? "", visa: c.visa ?? "",
    location: c.location ?? "", rate: req.rate ?? "", jobDescription: req.jobDescription, myName: sender.name, myEmail: sender.email, signature: sig,
  });
  const render = (c: VendorMatch) => ({
    subject: fillFields(subject, varsFor(c)).replace(/\s+-\s*$/, "").trim(),
    // Lines left empty (e.g. no visa on file) are dropped
    body: renderBody(body, varsFor(c)).replace(/^(Visa|Location|Rate):\s*$/gm, "").replace(/\n{3,}/g, "\n\n"),
  });

  const setRow = (id: string, s: RowState) => setRows((r) => ({ ...r, [id]: s }));
  const patch = (id: string, p: Partial<VendorMatch>) => setConsultants((list) => list.map((c) => (c.id === id ? { ...c, ...p } : c)));

  /** Updates the resume for this JD unless it already is, then sends; resolves true when sent */
  const runOne = async (c: VendorMatch): Promise<boolean> => {
    try {
      if (!c.tailored) {
        setRow(c.id, { step: "updating" });
        const start = await fetch(`${api}/tailor`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consultantId: c.id }) });
        const started = await start.json().catch(() => ({}));
        if (!start.ok) throw new Error(started.error ?? "Could not start the resume update");
        let done = false;
        for (let i = 0; i < 400 && !done; i++) {
          await poll(3000);
          const res = await fetch(`${api}/tailor?job=${started.jobId}`).catch(() => null);
          if (!res) continue;
          const d = await res.json().catch(() => ({}));
          if (!res.ok || d.status === "failed") throw new Error(d.error ?? "Could not update the resume");
          if (d.status === "done") {
            patch(c.id, { tailored: d.result });
            done = true;
          }
        }
        if (!done) throw new Error("The resume update took too long");
      }
      setRow(c.id, { step: "sending" });
      const msg = render(c);
      const res = await fetch(`${api}/send`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultantId: c.id, subject: msg.subject, body: msg.body }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Could not send");
      setRow(c.id, { step: "sent" });
      patch(c.id, { sentCount: c.sentCount + 1 });
      return true;
    } catch (err) {
      setRow(c.id, { step: "failed", error: err instanceof Error ? err.message : "Failed" });
      return false;
    }
  };

  // Ones already sent in this popup are never sent again (a retry only redoes the failed ones)
  const batch = consultants.filter((c) => selected.has(c.id) && rows[c.id]?.step !== "sent");
  const generateAndSend = async () => {
    setRunning(true);
    const results = await Promise.all(batch.map(runOne));
    setRunning(false);
    const sent = results.filter(Boolean).length;
    if (sent === batch.length) onDone(sent);
  };

  const finished = Object.values(rows).filter((r) => r.step === "sent").length;
  const failed = Object.values(rows).filter((r) => r.step === "failed").length;
  const sample = batch[0] ?? consultants[0];
  const preview = useMemo(() => (sample ? render(sample) : null), [sample, subject, body]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const field = "w-full rounded-lg border border-slate-200 text-[13px] focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-2 sm:p-6">
      <div className="absolute inset-0" onClick={() => !running && onClose()} aria-hidden="true" />
      {previewing && <ResumePreview id={previewing.id} consultant={previewing.name} onClose={() => setPreviewing(null)} />}
      <div className="relative flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 bg-slate-800 px-5 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-[14px] font-semibold text-white">Send resumes · {req.jobTitle ?? req.subject}</h2>
            <p className="truncate text-[11px] text-slate-400">
              To {req.vendorName ? `${req.vendorName} <${to}>` : to}{req.vendorCompany ? ` · ${req.vendorCompany}` : ""} · one email per consultant, each with their resume updated for this JD
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={running} className="text-slate-300 hover:text-white disabled:opacity-40" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1fr_1.1fr] lg:overflow-hidden">
          {/* Consultants */}
          <div className="border-b border-slate-100 lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <p className="px-4 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">Your consultants on {req.technology}</p>
            {loading ? (
              <p className="flex items-center gap-2 px-4 py-6 text-[12.5px] text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
            ) : loadError ? (
              <p className="px-4 py-6 text-[12.5px] text-rose-600">{loadError}</p>
            ) : consultants.length === 0 ? (
              <p className="px-4 py-6 text-[12.5px] text-slate-400">None of your In-Market consultants are on {req.technology}.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {consultants.map((c) => {
                  const st = rows[c.id];
                  const disabled = running || !c.resume || st?.step === "sent";
                  return (
                    <li key={c.id} className={cn("flex items-start gap-3 px-4 py-2.5", selected.has(c.id) && !st && "bg-indigo-50/40")}>
                      <input type="checkbox" className="mt-1 h-4 w-4 accent-indigo-600" checked={selected.has(c.id)} disabled={disabled} onChange={() => toggle(c.id)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-slate-800">{c.name}</p>
                        <p className="text-[11.5px] text-slate-500">{[c.visa, c.location].filter(Boolean).join(" · ") || "—"}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                          {!c.resume ? (
                            <Link href={`/admin/resumes?consultant=${c.id}`} className="font-medium text-rose-600 hover:underline">No resume: upload first</Link>
                          ) : c.tailored ? (
                            <button type="button" onClick={() => setPreviewing({ id: c.tailored!.id, name: c.name })} className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline">
                              <Eye className="h-3 w-3" /> Updated for this JD · ATS {c.tailored.atsAfter}%
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-500"><Sparkles className="h-3 w-3" /> Resume will be updated for this JD</span>
                          )}
                          {c.sentCount > 0 && !st && <span className="rounded bg-emerald-50 px-1.5 font-semibold text-emerald-700">Already sent</span>}
                        </div>
                        {st?.error && <p className="mt-1 text-[11px] font-medium text-rose-600">{st.error}</p>}
                      </div>
                      <StepBadge step={st?.step} />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Email */}
          <div className="space-y-3 p-4 lg:overflow-y-auto">
            <div className="flex items-end gap-2">
              <label className="block flex-1 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Template</span>
                <select value={templateId} onChange={(e) => pickTemplate(e.target.value)} disabled={running} className={cn(field, "h-9 bg-white px-2.5")}>
                  <option value="">Standard (built-in)</option>
                  {sender.templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isDefault ? " ★" : ""}</option>)}
                </select>
              </label>
              <Link href="/admin/email-templates" target="_blank" className="mb-2 whitespace-nowrap text-[11.5px] font-semibold text-indigo-600 hover:underline">Manage templates</Link>
            </div>
            <label className="block space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Subject</span>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={running} className={cn(field, "h-9 px-3")} />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Message</span>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} disabled={running} rows={10} className={cn(field, "resize-y p-3 font-[inherit] text-[12.5px] leading-relaxed")} />
            </label>
            <p className="text-[11px] text-slate-400">
              <code className="rounded bg-slate-100 px-1">{"{consultantName}"}</code>, <code className="rounded bg-slate-100 px-1">{"{visa}"}</code>, <code className="rounded bg-slate-100 px-1">{"{location}"}</code> and
              {" "}<code className="rounded bg-slate-100 px-1">{"{firstName}"}</code> are filled in for each email.
            </p>
            {preview && sample && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-1 flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500"><Mail className="h-3 w-3" /> Preview: email for {sample.name}</p>
                <p className="text-[12px] font-semibold text-slate-700">{preview.subject}</p>
                <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-line text-[12px] leading-relaxed text-slate-600">{preview.body.replace(/\{firstName\}/g, (req.vendorName ?? "").split(" ")[0] || "there")}</p>
                <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-500"><FileText className="h-3 w-3" /> Attached: {sample.name.replace(/\s+/g, "_")}_Resume.docx (updated for this JD)</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          {(finished > 0 || failed > 0) && (
            <p className={cn("mr-auto text-[12px] font-medium", failed ? "text-rose-600" : "text-emerald-700")}>
              {finished} sent{failed ? `, ${failed} failed (fix and try again)` : ""}
            </p>
          )}
          {!aiReady && <p className="mr-auto flex items-center gap-1 text-[12px] text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> No AI provider is set up</p>}
          <Button variant="ghost" onClick={() => (finished ? onDone(finished) : onClose())} disabled={running}>{finished ? "Done" : "Cancel"}</Button>
          <Button onClick={() => void generateAndSend()} disabled={running || batch.length === 0 || !aiReady || !subject.trim() || !body.trim()}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {running ? "Updating resumes & sending…" : `Generate & Send${batch.length ? ` (${batch.length})` : ""}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StepBadge({ step }: { step?: Step }) {
  if (!step || step === "idle") return null;
  const map = {
    updating: { cls: "bg-indigo-50 text-indigo-700", label: "Updating resume…", spin: true },
    sending: { cls: "bg-sky-50 text-sky-700", label: "Sending…", spin: true },
    sent: { cls: "bg-emerald-50 text-emerald-700", label: "Sent", spin: false },
    failed: { cls: "bg-rose-50 text-rose-700", label: "Failed", spin: false },
  }[step];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold", map.cls)}>
      {map.spin ? <Loader2 className="h-3 w-3 animate-spin" /> : step === "sent" ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {map.label}
    </span>
  );
}
