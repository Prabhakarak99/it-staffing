"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bot, ChevronDown, ChevronRight, Download, FileText, Loader2, Search, Sparkles, Upload, X } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { APP_TZ } from "@/lib/tz";
import type { AiResumeRow, ResumeConsultant } from "@/lib/resumes/data";

type Notify = (message: string, type: "success" | "error") => void;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { timeZone: APP_TZ, month: "short", day: "numeric", year: "numeric" });
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: APP_TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const fileUrl = (file: string) => `/api/resumes/${file}`;

export function ResumesView({ consultants: initial, showRecruiter, ai, initialId }: {
  consultants: ResumeConsultant[];
  /** POC / Manager / Admin see every consultant, so show who each is assigned to */
  showRecruiter: boolean;
  ai: { label: string; model: string } | null;
  initialId: string | null;
}) {
  const { toast, show, hide } = useToast();
  const [consultants, setConsultants] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [query, setQuery] = useState("");

  const selected = consultants.find((c) => c.id === selectedId) ?? null;
  const patch = (id: string, changes: Partial<ResumeConsultant>) =>
    setConsultants((list) => list.map((c) => (c.id === id ? { ...c, ...changes } : c)));

  const select = (id: string | null) => {
    setSelectedId(id);
    const url = id ? `/admin/resumes?consultant=${id}` : "/admin/resumes";
    window.history.replaceState(null, "", url);
    if (id) window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return consultants.filter((c) => !q || `${c.name} ${c.technology ?? ""} ${c.recruiterName ?? ""}`.toLowerCase().includes(q));
  }, [consultants, query]);

  const uploaded = consultants.filter((c) => c.resume).length;
  const cols = showRecruiter ? 7 : 6;

  return (
    <>
      <Header title="Resumes" subtitle={showRecruiter ? "Every consultant's resume and AI resumes" : "Resumes of the consultants assigned to you"} />
      <div className="space-y-4 p-6">
        {/* Consultant picker */}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
          <label htmlFor="consultant" className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Consultant</label>
          <select
            id="consultant"
            value={selectedId ?? ""}
            onChange={(e) => select(e.target.value || null)}
            className="h-9 min-w-[260px] flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] sm:max-w-md"
          >
            <option value="">Select a consultant…</option>
            {consultants.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.technology ? ` · ${c.technology}` : ""}{c.resume ? "" : " · no resume"}
              </option>
            ))}
          </select>
          {selected && <Button size="sm" variant="ghost" onClick={() => select(null)}><X className="h-3.5 w-3.5" /> Close</Button>}
          <p className="ml-auto text-[12px] text-slate-500">
            <b className="text-slate-800">{uploaded}</b> of <b className="text-slate-800">{consultants.length}</b> consultants have a resume
          </p>
        </div>

        {selected && (
          <ConsultantPanel
            key={selected.id}
            consultant={selected}
            ai={ai}
            notify={show}
            onResume={(resume) => patch(selected.id, { resume })}
            onGenerated={() => patch(selected.id, { aiCount: selected.aiCount + 1 })}
          />
        )}

        {/* Every consultant and their uploaded resume */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
            <h2 className="text-[14px] font-semibold text-slate-800">Consultants</h2>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search consultant, technology…"
                className="h-8 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-[12.5px] focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-slate-800">
                <tr>
                  {["Consultant", "Technology", "Status", ...(showRecruiter ? ["Recruiter"] : []), "Resume Uploaded", "AI Resumes", ""].map((h, i) => (
                    <th key={`${h}${i}`} className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-300">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.length === 0 ? (
                  <tr>
                    <td colSpan={cols} className="px-4 py-12 text-center text-slate-400">
                      {consultants.length === 0 ? "No consultants are assigned to you yet." : "No consultants match"}
                    </td>
                  </tr>
                ) : (
                  shown.map((c) => (
                    <tr key={c.id} className={cn("hover:bg-slate-50", c.id === selectedId && "bg-indigo-50/50")}>
                      <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-slate-800">{c.name}</td>
                      <td className="px-4 py-2.5 text-slate-600">{c.technology || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{c.status || "—"}</td>
                      {showRecruiter && <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{c.recruiterName ?? "—"}</td>}
                      <td className="px-4 py-2.5">
                        {c.resume ? (
                          <a href={fileUrl(c.resume.file)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium text-indigo-600 hover:underline">
                            <FileText className="h-3.5 w-3.5 shrink-0" />
                            <span className="max-w-[220px] truncate">{c.resume.name}</span>
                          </a>
                        ) : (
                          <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-600">Not uploaded</span>
                        )}
                        {c.resume?.updatedAt && <p className="text-[11px] text-slate-400">{fmtDate(c.resume.updatedAt)}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">{c.aiCount}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Button size="sm" variant="outline" onClick={() => select(c.id)}>Open</Button>
                      </td>
                    </tr>
                  ))
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

/* ── One consultant: resume upload, generate for a JD, AI resume table ─────── */

function ConsultantPanel({ consultant, ai, notify, onResume, onGenerated }: {
  consultant: ResumeConsultant;
  ai: { label: string; model: string } | null;
  notify: Notify;
  onResume: (resume: ResumeConsultant["resume"]) => void;
  onGenerated: () => void;
}) {
  const [rows, setRows] = useState<AiResumeRow[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = () =>
    fetch(`/api/consultant-resumes/${consultant.id}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Could not load AI resumes");
        setRows(d);
      })
      .catch((err: Error) => setLoadError(err.message));

  useEffect(() => {
    void load();
    // Remounted per consultant (key), so this runs once for each
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upload = async (file: File) => {
    setUploading(true);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/students/${consultant.id}/resume`, { method: "POST", body });
    const d = await res.json().catch(() => ({}));
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
    if (!res.ok) return notify(d.error ?? "Could not upload the resume", "error");
    onResume({ file: d.resumeFile, name: d.resumeFileName ?? file.name, updatedAt: d.resumeUpdatedAt ?? new Date().toISOString() });
    notify(`Resume uploaded for ${consultant.name}`, "success");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      {/* Uploaded resume */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[16px] font-bold text-slate-900">{consultant.name}</p>
          <p className="text-[12px] text-slate-500">{[consultant.technology, consultant.status, consultant.recruiterName && `Recruiter: ${consultant.recruiterName}`].filter(Boolean).join(" · ") || "—"}</p>

          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Uploaded resume</p>
            {consultant.resume ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <a href={fileUrl(consultant.resume.file)} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-indigo-600 hover:underline">
                  <FileText className="h-4 w-4 shrink-0" /> <span className="truncate">{consultant.resume.name}</span>
                </a>
                {consultant.resume.updatedAt && <span className="text-[11px] text-slate-400">uploaded {fmtDate(consultant.resume.updatedAt)}</span>}
              </div>
            ) : (
              <p className="mt-1.5 text-[12.5px] font-medium text-rose-600">No resume uploaded yet</p>
            )}
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
            <Button size="sm" variant="outline" className="mt-3" onClick={() => fileInput.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {consultant.resume ? "Replace resume" : "Upload resume"}
            </Button>
            <p className="mt-1.5 text-[11px] text-slate-400">PDF or Word (.docx), up to 10 MB</p>
          </div>
        </div>

        <GenerateForm
          consultant={consultant}
          ai={ai}
          notify={notify}
          onDone={() => {
            onGenerated();
            void load();
          }}
        />
      </div>

      {/* AI resumes and their JDs */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h3 className="text-[14px] font-semibold text-slate-800">AI resumes &amp; job descriptions</h3>
          <p className="text-[11.5px] text-slate-400">Every AI resume for {consultant.name}, with the JD it was written for</p>
        </div>
        {loadError ? (
          <p className="px-5 py-8 text-center text-[12.5px] font-medium text-rose-600">{loadError}</p>
        ) : !rows ? (
          <div className="flex items-center justify-center gap-2 py-10 text-[12.5px] text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-[12.5px] text-slate-400">No AI resumes yet. Generate one for a JD.</p>
        ) : (
          <AiResumeTable rows={rows} />
        )}
      </div>
    </div>
  );
}

function GenerateForm({ consultant, ai, notify, onDone }: {
  consultant: ResumeConsultant;
  ai: { label: string; model: string } | null;
  notify: Notify;
  onDone: () => void;
}) {
  const [jobTitle, setJobTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [technology, setTechnology] = useState(consultant.technology ?? "");
  const [jdText, setJdText] = useState("");
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const jdInput = useRef<HTMLInputElement>(null);

  const ready = !!ai && !!consultant.resume && (!!jdText.trim() || !!jdFile);

  const generate = async () => {
    setRunning(true);
    const body = new FormData();
    body.append("jobTitle", jobTitle);
    body.append("clientName", clientName);
    body.append("technology", technology);
    body.append("jdText", jdText);
    if (jdFile) body.append("jdFile", jdFile);
    const res = await fetch(`/api/consultant-resumes/${consultant.id}/tailor`, { method: "POST", body });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setRunning(false);
      return notify(d.error ?? "Could not start the AI resume", "error");
    }

    // The AI takes a minute or two; check every few seconds
    for (;;) {
      await new Promise((r) => setTimeout(r, 3000));
      const poll = await fetch(`/api/consultant-resumes/${consultant.id}/tailor?job=${d.jobId}`, { cache: "no-store" });
      const p = await poll.json().catch(() => ({}));
      if (!poll.ok || p.status === "failed") {
        setRunning(false);
        return notify(p.error ?? "Could not create the AI resume", "error");
      }
      if (p.status === "done") break;
    }
    setRunning(false);
    setJobTitle("");
    setClientName("");
    setJdText("");
    setJdFile(null);
    if (jdInput.current) jdInput.current.value = "";
    notify(`AI resume ready for ${consultant.name}`, "success");
    onDone();
  };

  const input = "h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[13px] focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="flex items-center gap-2 text-[14px] font-semibold text-slate-800"><Sparkles className="h-4 w-4 text-indigo-600" /> Generate a resume for a JD</p>
      {!ai ? (
        <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> No AI provider is set up. An admin can add one under Administration → AI Settings.
        </p>
      ) : (
        <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-slate-400"><Bot className="h-3.5 w-3.5" /> Uses {ai.label} ({ai.model}). Takes 1–2 minutes.</p>
      )}
      {!consultant.resume && <p className="mt-2 text-[12px] font-medium text-rose-600">Upload {consultant.name}&apos;s resume first.</p>}

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <input className={input} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Job title" maxLength={200} disabled={running} />
        <input className={input} value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client" maxLength={200} disabled={running} />
        <input className={input} value={technology} onChange={(e) => setTechnology(e.target.value)} placeholder="Technology" maxLength={100} disabled={running} />
      </div>
      <textarea
        value={jdText}
        onChange={(e) => setJdText(e.target.value)}
        rows={7}
        disabled={running}
        placeholder="Paste the job description here…"
        className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input ref={jdInput} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={(e) => setJdFile(e.target.files?.[0] ?? null)} />
        <Button size="sm" variant="outline" onClick={() => jdInput.current?.click()} disabled={running}>
          <Upload className="h-3.5 w-3.5" /> {jdFile ? "Change JD file" : "Upload JD file"}
        </Button>
        {jdFile && (
          <span className="flex min-w-0 items-center gap-1 text-[12px] text-slate-600">
            <FileText className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{jdFile.name}</span>
            <button
              type="button"
              onClick={() => { setJdFile(null); if (jdInput.current) jdInput.current.value = ""; }}
              className="text-slate-400 hover:text-rose-600"
              aria-label="Remove JD file"
              disabled={running}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
        <Button size="sm" className="ml-auto" onClick={generate} disabled={!ready || running}>
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {running ? "Writing resume…" : "Generate AI Resume"}
        </Button>
      </div>
      <p className="mt-1.5 text-[11px] text-slate-400">Paste the JD or upload it (PDF, Word or .txt). An uploaded JD file is saved with the resume.</p>
    </div>
  );
}

function AiResumeTable({ rows }: { rows: AiResumeRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]">
        <thead className="bg-slate-50">
          <tr>
            {["", "Created", "Job", "ATS score", "AI Resume", "JD"].map((h, i) => (
              <th key={`${h}${i}`} className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => {
            const isOpen = open === r.id;
            const job = [r.jobTitle, r.technology].filter(Boolean).join(" · ") || "—";
            return (
              <Fragment key={r.id}>
                <tr className={cn("hover:bg-slate-50", isOpen && "bg-indigo-50/40")}>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : r.id)}
                      className="text-slate-400 hover:text-indigo-600"
                      aria-expanded={isOpen}
                      aria-label={isOpen ? "Hide job description" : "Show job description"}
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                    {fmtDateTime(r.createdAt)}
                    {r.createdBy && <p className="text-[11px] text-slate-400">{r.createdBy}</p>}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {job}
                    <p className="text-[11px] text-slate-400">
                      {[r.clientName, r.submissionCode ? `from ${r.submissionCode}` : "Resumes tab"].filter(Boolean).join(" · ")}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className="text-slate-400">{r.atsBefore}%</span>
                    <span className="mx-1 text-slate-300">→</span>
                    <span className={cn("font-bold", r.atsAfter >= 80 ? "text-emerald-600" : r.atsAfter >= 60 ? "text-amber-600" : "text-rose-600")}>{r.atsAfter}%</span>
                  </td>
                  <td className="px-3 py-2">
                    <a href={fileUrl(r.resume.file)} className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline" title={r.resume.name}>
                      <Download className="h-3.5 w-3.5" /> .docx
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    {r.jd ? (
                      <a href={fileUrl(r.jd.file)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline" title={r.jd.name}>
                        <FileText className="h-3.5 w-3.5" /> File
                      </a>
                    ) : (
                      <button type="button" onClick={() => setOpen(isOpen ? null : r.id)} className="font-medium text-indigo-600 hover:underline">
                        {isOpen ? "Hide" : "View"}
                      </button>
                    )}
                  </td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={6} className="bg-slate-50/80 px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Job description</p>
                      <p className="mt-1 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 text-[12px] leading-relaxed text-slate-700">
                        {r.jobDescription || "The JD wasn't saved for this resume."}
                      </p>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
