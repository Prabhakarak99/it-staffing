"use client";

import { useRef, useState } from "react";
import { Copy, Loader2, Mail, PenLine, Plus, Save, Star, Trash2, X } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  TEMPLATE_CATEGORIES, TEMPLATE_FIELDS, categoryLabel, renderBody, fillFields,
  type EmailTemplateDto, type TemplateCategory, type TemplateVars,
} from "@/lib/email-templates/render";

interface Setup { signature: string; templates: EmailTemplateDto[] }
interface Draft { id: string | null; name: string; category: TemplateCategory; subject: string; body: string; isDefault: boolean }

const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  submission: "bg-indigo-50 text-indigo-700 border-indigo-200",
  "followup-submission": "bg-sky-50 text-sky-700 border-sky-200",
  "followup-interview": "bg-violet-50 text-violet-700 border-violet-200",
  general: "bg-slate-50 text-slate-600 border-slate-200",
};

const STARTERS: Record<TemplateCategory, { subject: string; body: string }> = {
  submission: {
    subject: "{technology} - {consultantName} - {client}",
    body: "Hi {firstName},\n\nPlease find attached the resume of {consultantName} for the {technology} position with {client}.\n\nConsultant: {consultantName}\nVisa: {visa}\nLocation: {location}\nRate: {rate}\n\nPlease review and let me know a good time to connect.\n\n{signature}",
  },
  "followup-submission": {
    subject: "Follow-up: {consultantName} - {technology}",
    body: "Hi {firstName},\n\nHope you are doing well.\n\nI am following up on {consultantName}'s profile that I submitted on {date} for the {technology} position with {client}. Could you please share any update or feedback from the client?\n\n{signature}",
  },
  "followup-interview": {
    subject: "Interview feedback: {consultantName} - {technology}",
    body: "Hi {firstName},\n\nThank you for arranging {consultantName}'s {interviewLevel} interview on {date} for the {technology} position with {client}. Could you please share the feedback and next steps?\n\n{signature}",
  },
  general: { subject: "", body: "Hi {firstName},\n\n\n\n{signature}" },
};

const fieldGroups = [...new Set(TEMPLATE_FIELDS.map((f) => f.group))];

export function EmailTemplatesView({ initial, me }: { initial: Setup; me: { name: string; email: string } }) {
  const { toast, show, hide } = useToast();
  const [setup, setSetup] = useState(initial);
  const [signature, setSignature] = useState(initial.signature);
  const [savingSig, setSavingSig] = useState(false);
  const [filter, setFilter] = useState<TemplateCategory | "all">("all");
  const [draft, setDraft] = useState<Draft | null>(null);

  const sample: TemplateVars = {
    firstName: "Krithika", vendorName: "Krithika Rao", company: "BN Associates",
    consultantName: "Anusha Patibandla", technology: "MES", client: "LTTS", visa: "H1B", location: "Dallas, TX",
    rate: "$65/hr C2C", jobDescription: "(job description)", date: "Mon, Nov 2", interviewLevel: "L1",
    myName: me.name, myEmail: me.email, signature: setup.signature || `Thanks & Regards,\n${me.name}\n${me.email}`,
  };

  const saveSignature = async () => {
    setSavingSig(true);
    const res = await fetch("/api/email-templates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signature }) });
    const d = await res.json().catch(() => ({}));
    setSavingSig(false);
    if (!res.ok) return show(d.error ?? "Could not save the signature", "error");
    setSetup(d);
    setSignature(d.signature);
    show("Signature saved", "success");
  };

  const remove = async (t: EmailTemplateDto) => {
    if (!window.confirm(`Delete the template "${t.name}"?`)) return;
    const res = await fetch(`/api/email-templates/${t.id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return show(d.error ?? "Could not delete", "error");
    setSetup(d);
    show("Template deleted", "success");
  };

  const shown = setup.templates.filter((t) => filter === "all" || t.category === filter);
  const sigDirty = signature.trim() !== setup.signature.trim();

  return (
    <>
      <Header title="Email Templates" subtitle="Your own signature and email templates. Only you can see and use them." />
      <div className="grid gap-5 p-4 sm:p-6 xl:grid-cols-[380px_1fr]">
        {/* Signature */}
        <section className="h-fit rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
            <PenLine className="h-4 w-4 text-indigo-600" />
            <h2 className="text-[14px] font-bold text-slate-800">My Signature</h2>
          </div>
          <div className="space-y-3 p-5">
            <p className="text-[12px] text-slate-500">
              Added to the end of your emails from Easy Submissions and Follow-ups, or wherever a template has <code className="rounded bg-slate-100 px-1">{"{signature}"}</code>.
            </p>
            <textarea
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              rows={7}
              placeholder={`Thanks & Regards,\n${me.name}\nSr. IT Recruiter | Your Company\n${me.email} | +1 (555) 000-0000`}
              className="w-full resize-y rounded-lg border border-slate-200 p-3 font-[inherit] text-[13px] leading-relaxed focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400">{signature.length} / 2000</span>
              <Button size="sm" onClick={saveSignature} disabled={savingSig || !sigDirty}>
                {savingSig ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save Signature
              </Button>
            </div>
          </div>
        </section>

        {/* Templates */}
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
            <Mail className="h-4 w-4 text-indigo-600" />
            <h2 className="text-[14px] font-bold text-slate-800">My Templates</h2>
            <span className="rounded-full bg-slate-100 px-2 text-[11px] font-bold text-slate-600">{setup.templates.length}</span>
            <Button size="sm" className="ml-auto" onClick={() => setDraft({ id: null, name: "", category: filter === "all" ? "submission" : filter, isDefault: false, ...STARTERS[filter === "all" ? "submission" : filter] })}>
              <Plus className="h-3.5 w-3.5" /> New Template
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-5 py-2.5">
            {[{ id: "all" as const, label: "All" }, ...TEMPLATE_CATEGORIES].map((c) => {
              const n = c.id === "all" ? setup.templates.length : setup.templates.filter((t) => t.category === c.id).length;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setFilter(c.id)}
                  className={cn("rounded-lg px-2.5 py-1 text-[12px] font-medium transition", filter === c.id ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100")}
                >
                  {c.label} <span className="opacity-70">({n})</span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2">
            {shown.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-[13px] text-slate-400">
                No templates yet. Click <b>New Template</b> to create one. Each starts from a ready-made draft you can change.
              </div>
            )}
            {shown.map((t) => (
              <article key={t.id} className="flex flex-col rounded-xl border border-slate-200 p-4 transition hover:border-indigo-200 hover:shadow-sm">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-[13.5px] font-bold text-slate-800">
                      {t.isDefault && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Default" />}
                      <span className="truncate">{t.name}</span>
                    </p>
                    <span className={cn("mt-1 inline-block rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold", CATEGORY_COLORS[t.category])}>
                      {categoryLabel(t.category)}{t.isDefault ? " · default" : ""}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <IconBtn title="Edit" onClick={() => setDraft({ ...t })}><PenLine className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn title="Duplicate" onClick={() => setDraft({ ...t, id: null, name: `${t.name} (copy)`, isDefault: false })}><Copy className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn title="Delete" danger onClick={() => remove(t)}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                  </div>
                </div>
                {t.subject && <p className="mt-2 truncate text-[12px] text-slate-600"><span className="font-semibold text-slate-500">Subject:</span> {t.subject}</p>}
                <p className="mt-1 line-clamp-4 whitespace-pre-line text-[12px] leading-relaxed text-slate-500">{t.body}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      {draft && (
        <TemplateEditor
          draft={draft}
          sample={sample}
          onClose={() => setDraft(null)}
          onSaved={(d, msg) => { setSetup(d); setDraft(null); show(msg, "success"); }}
          onError={(msg) => show(msg, "error")}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </>
  );
}

function IconBtn({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick}
      className={cn("rounded-md p-1.5 text-slate-400 transition", danger ? "hover:bg-rose-50 hover:text-rose-600" : "hover:bg-slate-100 hover:text-indigo-600")}>
      {children}
    </button>
  );
}

function TemplateEditor({ draft: initial, sample, onClose, onSaved, onError }: {
  draft: Draft;
  sample: TemplateVars;
  onClose: () => void;
  onSaved: (setup: Setup, message: string) => void;
  onError: (message: string) => void;
}) {
  const [d, setD] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [focus, setFocus] = useState<"subject" | "body">("body");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  /** Inserts {field} at the cursor of the subject or the message, whichever was last used */
  const insert = (key: string) => {
    const token = `{${key}}`;
    const el = focus === "subject" ? subjectRef.current : bodyRef.current;
    const field = focus === "subject" ? "subject" : "body";
    const value = d[field];
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    set(field, value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const changeCategory = (category: TemplateCategory) => {
    // A new, untouched template follows the category's starter draft
    const untouched = !initial.id && d.body === STARTERS[d.category].body && d.subject === STARTERS[d.category].subject;
    setD((p) => ({ ...p, category, ...(untouched ? STARTERS[category] : {}) }));
  };

  const save = async () => {
    setSaving(true);
    const res = await fetch(d.id ? `/api/email-templates/${d.id}` : "/api/email-templates", {
      method: d.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(d),
    });
    const r = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return onError(r.error ?? "Could not save the template");
    onSaved(r, d.id ? "Template updated" : "Template created");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-2 sm:p-6" onClick={onClose}>
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-slate-800 px-5 py-3">
          <h2 className="text-[14px] font-semibold text-white">{d.id ? "Edit Template" : "New Template"}</h2>
          <button type="button" onClick={onClose} className="text-slate-300 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-2 lg:overflow-hidden">
          <div className="space-y-3 p-5 lg:overflow-y-auto">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input compact id="tpl-name" label="Template name" value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. MES submission" autoFocus />
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Used for</span>
                <select value={d.category} onChange={(e) => changeCategory(e.target.value as TemplateCategory)}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                  {TEMPLATE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </label>
            </div>
            <p className="text-[11px] text-slate-400">{TEMPLATE_CATEGORIES.find((c) => c.id === d.category)?.hint}</p>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Subject</span>
              <input ref={subjectRef} value={d.subject} onFocus={() => setFocus("subject")} onChange={(e) => set("subject", e.target.value)}
                placeholder={d.category.startsWith("followup") ? "Optional" : ""}
                className="h-9 rounded-lg border border-slate-200 px-3 text-[13px] focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
              {d.category.startsWith("followup") && (
                <span className="text-[11px] text-slate-400">Follow-ups reply in your original email thread and keep its &quot;Re:&quot; subject. This subject is used only when the original isn&apos;t found.</span>
              )}
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Message</span>
              <textarea ref={bodyRef} value={d.body} onFocus={() => setFocus("body")} onChange={(e) => set("body", e.target.value)} rows={13}
                className="w-full resize-y rounded-lg border border-slate-200 p-3 font-[inherit] text-[12.5px] leading-relaxed focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            </label>

            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">Insert a field ({focus === "subject" ? "into the subject" : "into the message"})</p>
              <div className="space-y-1.5">
                {fieldGroups.map((g) => (
                  <div key={g} className="flex flex-wrap items-center gap-1">
                    <span className="w-20 shrink-0 text-[10.5px] font-medium text-slate-400">{g}</span>
                    {TEMPLATE_FIELDS.filter((f) => f.group === g).map((f) => (
                      <button key={f.key} type="button" onClick={() => insert(f.key)} title={`{${f.key}}`}
                        className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-700">
                        {f.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-[12.5px] text-slate-700">
              <input type="checkbox" checked={d.isDefault} onChange={(e) => set("isDefault", e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
              Use as my default for <b>{categoryLabel(d.category)}</b> (picked automatically)
            </label>
          </div>

          <div className="border-t border-slate-100 bg-slate-50 p-5 lg:overflow-y-auto lg:border-l lg:border-t-0">
            <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">Preview with sample details</p>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="border-b border-slate-100 pb-2 text-[12.5px] text-slate-700">
                <span className="font-semibold text-slate-500">Subject: </span>
                {d.subject.trim() ? fillFields(d.subject, sample) : <i className="text-slate-400">Re: (original email subject)</i>}
              </p>
              <p className="whitespace-pre-line pt-3 text-[12.5px] leading-relaxed text-slate-700">{renderBody(d.body, sample)}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !d.name.trim() || !d.body.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {d.id ? "Save Changes" : "Create Template"}
          </Button>
        </div>
      </div>
    </div>
  );
}
