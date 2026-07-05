"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  Calendar, Loader2, Search, X, Clock, Layers, MessageSquare,
  Link2, Users, Building2,
} from "lucide-react";
import { validateOptionalUrl } from "@/lib/validators";

const INTERVIEW_LEVELS = ["Screening", "Level 1", "Level 2", "Level 3", "Final"];
const INTERVIEW_STATUSES = ["Rejected", "Moved To Next Round", "Confirmation"];
const TECH_FEEDBACKS = ["Technically Strong", "Average", "Poor Technical Skills", "Taking AI support", "Other"];

interface MySubmission {
  id: string; submissionId: string; technology: string; vendorCompany: string;
  vendorRecruiterName: string; vendorRecruiterEmail: string; vendorRecruiterPhone: string;
  implementationName: string | null; implementationEmail: string | null; implementationPhone: string | null;
  clientName: string | null; clientLocation: string | null;
  consultant: { firstName: string; lastName: string };
}

interface TechSupportPerson {
  id: string; firstName: string; lastName: string; email: string; phoneNumber: string | null;
}

interface ExistingInterview {
  id: string;
  interviewId: string;
  interviewStartDate: string;
  interviewEndDate: string;
  interviewLevel: string;
  interviewStatus: string;
  techSupportFeedback: string | null;
  amount: string | null;
  otterLink: string | null;
  interviewQuestions: string | null;
  interviewFeedback: string | null;
  submission: MySubmission;
  techSupport: TechSupportPerson | null;
}

interface Props {
  recruiterId: string; recruiterName: string; nextInterviewId: string; mySubmissions: MySubmission[];
  existingInterview?: ExistingInterview;
  onCancel?: () => void;
  onSuccess?: () => void;
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function PillChips({ label, value, options, onChange, required }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
  required?: boolean;
}) {
  const STATUS_COLOR: Record<string, string> = {
    Rejected: "border-rose-500 bg-rose-500 text-white",
    "Moved To Next Round": "border-amber-500 bg-amber-500 text-white",
    Confirmation: "border-emerald-500 bg-emerald-500 text-white",
  };
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}{required && " *"}
      </label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button key={opt} type="button" onClick={() => onChange(value === opt ? "" : opt)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition-all",
              value === opt
                ? (STATUS_COLOR[opt] ?? `border-indigo-500 bg-indigo-500 text-white shadow-sm`)
                : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50"
            )}>{opt}</button>
        ))}
      </div>
    </div>
  );
}

function SectionCard({ icon: Icon, title, subtitle, color, children }: {
  icon: React.ElementType; title: string; subtitle?: string; color: string; children: React.ReactNode;
}) {
  const colorMap: Record<string, { bg: string; border: string; icon: string }> = {
    indigo: { bg: "bg-indigo-50", border: "border-indigo-100", icon: "text-indigo-500" },
    violet: { bg: "bg-violet-50", border: "border-violet-100", icon: "text-violet-500" },
    amber:  { bg: "bg-amber-50",  border: "border-amber-100",  icon: "text-amber-500" },
    emerald:{ bg: "bg-emerald-50",border: "border-emerald-100",icon: "text-emerald-500" },
    slate:  { bg: "bg-slate-50",  border: "border-slate-100",  icon: "text-slate-500" },
    blue:   { bg: "bg-blue-50",   border: "border-blue-100",   icon: "text-blue-500" },
  };
  const c = colorMap[color] ?? colorMap.slate;
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={cn("flex items-center gap-2.5 rounded-t-xl border-b px-4 py-3", c.bg, c.border)}>
        <Icon className={cn("h-4 w-4 shrink-0", c.icon)} />
        <span className="text-xs font-bold uppercase tracking-widest text-slate-700">{title}</span>
        {subtitle && <span className="ml-1 text-[10px] text-slate-400">{subtitle}</span>}
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function calcDuration(start: string, end: string): string {
  if (!start || !end) return "";
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (diff <= 0) return "";
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hrs > 0 && mins > 0) return `${hrs} hr ${mins} min`;
  if (hrs > 0) return `${hrs} hr`;
  return `${mins} min`;
}

function toDateTimeLocal(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const EMPTY_FORM = {
  submissionId: "", interviewStartDate: "", interviewEndDate: "",
  interviewLevel: "", interviewStatus: "", techSupportId: "",
  amount: "", techSupportFeedback: "", otterLink: "",
  interviewQuestions: "", interviewFeedback: "",
};

function buildInitialInterviewForm(existingInterview?: ExistingInterview) {
  if (!existingInterview) return EMPTY_FORM;
  return {
    submissionId: existingInterview.submission.id,
    interviewStartDate: toDateTimeLocal(existingInterview.interviewStartDate),
    interviewEndDate: toDateTimeLocal(existingInterview.interviewEndDate),
    interviewLevel: existingInterview.interviewLevel ?? "",
    interviewStatus: existingInterview.interviewStatus ?? "",
    techSupportId: existingInterview.techSupport?.id ?? "",
    amount: existingInterview.amount ?? "",
    techSupportFeedback: existingInterview.techSupportFeedback ?? "",
    otterLink: existingInterview.otterLink ?? "",
    interviewQuestions: existingInterview.interviewQuestions ?? "",
    interviewFeedback: existingInterview.interviewFeedback ?? "",
  };
}

export function InterviewForm({ recruiterName, nextInterviewId, mySubmissions, existingInterview, onCancel, onSuccess }: Props) {
  const [form, setForm] = useState(() => buildInitialInterviewForm(existingInterview));
  const [errors, setErrors] = useState<Partial<Record<keyof typeof EMPTY_FORM, string>>>({});
  const [isPending, startTransition] = useTransition();
  const { toast, show, hide } = useToast();
  const router = useRouter();
  const [selectedSub, setSelectedSub] = useState<MySubmission | null>(existingInterview?.submission ?? null);
  const [subQuery, setSubQuery] = useState(() =>
    existingInterview
      ? `${existingInterview.submission.submissionId} — ${existingInterview.submission.consultant.firstName} ${existingInterview.submission.consultant.lastName}`
      : ""
  );
  const [showSubDropdown, setShowSubDropdown] = useState(false);
  const subRef = useRef<HTMLDivElement>(null);
  const [tsQuery, setTsQuery] = useState(() =>
    existingInterview?.techSupport ? `${existingInterview.techSupport.firstName} ${existingInterview.techSupport.lastName}` : ""
  );
  const [tsResults, setTsResults] = useState<TechSupportPerson[]>([]);
  const [tsSearching, setTsSearching] = useState(false);
  const [showTsDropdown, setShowTsDropdown] = useState(false);
  const [selectedTs, setSelectedTs] = useState<TechSupportPerson | null>(existingInterview?.techSupport ?? null);
  const tsRef = useRef<HTMLDivElement>(null);
  const tsDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEdit = !!existingInterview;

  const filteredSubs = mySubmissions.filter((s) => {
    const q = subQuery.toLowerCase();
    return s.submissionId.toLowerCase().includes(q) ||
      `${s.consultant.firstName} ${s.consultant.lastName}`.toLowerCase().includes(q);
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (subRef.current && !subRef.current.contains(e.target as Node)) setShowSubDropdown(false);
      if (tsRef.current && !tsRef.current.contains(e.target as Node)) setShowTsDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const searchTechSupport = useCallback(async (q: string) => {
    if (!q.trim()) { setTsResults([]); setShowTsDropdown(false); return; }
    setTsSearching(true);
    try {
      const res = await fetch(`/api/tech-support/search?q=${encodeURIComponent(q)}`);
      setTsResults(await res.json());
      setShowTsDropdown(true);
    } catch { setTsResults([]); }
    finally { setTsSearching(false); }
  }, []);

  useEffect(() => {
    if (tsDebounce.current) clearTimeout(tsDebounce.current);
    tsDebounce.current = setTimeout(() => searchTechSupport(tsQuery), 300);
    return () => { if (tsDebounce.current) clearTimeout(tsDebounce.current); };
  }, [tsQuery, searchTechSupport]);

  const selectSubmission = (sub: MySubmission) => {
    setSelectedSub(sub);
    setSubQuery(`${sub.submissionId} — ${sub.consultant.firstName} ${sub.consultant.lastName}`);
    setForm((p) => ({ ...p, submissionId: sub.id }));
    setShowSubDropdown(false);
  };

  const clearSubmission = () => { setSelectedSub(null); setSubQuery(""); setForm((p) => ({ ...p, submissionId: "" })); };

  const selectTechSupport = (ts: TechSupportPerson) => {
    setSelectedTs(ts);
    setTsQuery(`${ts.firstName} ${ts.lastName}`);
    setForm((p) => ({ ...p, techSupportId: ts.id }));
    setShowTsDropdown(false);
  };

  const clearTechSupport = () => { setSelectedTs(null); setTsQuery(""); setForm((p) => ({ ...p, techSupportId: "" })); };

  const set = (field: keyof typeof EMPTY_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const duration = calcDuration(form.interviewStartDate, form.interviewEndDate);

  const validate = () => {
    const errs: typeof errors = {};
    if (!form.submissionId) errs.submissionId = "Select a submission";
    if (!form.interviewStartDate) errs.interviewStartDate = "Required";
    if (!form.interviewEndDate) errs.interviewEndDate = "Required";
    if (form.interviewStartDate && form.interviewEndDate && new Date(form.interviewEndDate) <= new Date(form.interviewStartDate))
      errs.interviewEndDate = "End must be after start";
    if (!form.interviewLevel) errs.interviewLevel = "Required";
    if (!form.interviewStatus) errs.interviewStatus = "Required";
    const otterErr = validateOptionalUrl(form.otterLink);
    if (otterErr) errs.otterLink = otterErr;
    return errs;
  };

  const submit = () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    startTransition(async () => {
      try {
        const payload = {
          submissionId: form.submissionId,
          interviewStartDate: form.interviewStartDate,
          interviewEndDate: form.interviewEndDate,
          interviewLevel: form.interviewLevel,
          interviewStatus: form.interviewStatus,
          techSupportId: form.techSupportId || null,
          amount: form.amount.trim() || null,
          techSupportFeedback: form.techSupportFeedback || null,
          otterLink: form.otterLink.trim() || null,
          interviewQuestions: form.interviewQuestions.trim() || null,
          interviewFeedback: form.interviewFeedback.trim() || null,
        };
        const res = await fetch(isEdit ? `/api/interviews/${existingInterview.id}` : "/api/interviews", {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Failed to ${isEdit ? "update" : "save"} interview`);
        show(`Interview ${data.interviewId} ${isEdit ? "updated" : "created"} successfully`, "success");
        onSuccess?.();
        if (!isEdit) {
          setForm(EMPTY_FORM);
          setSubQuery(""); setSelectedSub(null);
          setTsQuery(""); setSelectedTs(null);
        }
        router.refresh();
      } catch (err: unknown) {
        show(err instanceof Error ? err.message : `Error ${isEdit ? "updating" : "saving"} interview`, "error");
      }
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Gradient header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute -left-4 bottom-0 h-16 w-16 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm shadow-inner">
            <Calendar className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-white">{isEdit ? "Edit Interview" : "Schedule Interview"}</h2>
            <p className="text-sm text-white/70">{isEdit ? "Update interview details and save changes" : "Log and track a new interview session"}</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="rounded-xl bg-white/15 px-3 py-1.5 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/60">Interview ID</p>
              <p className="text-xs font-bold text-white font-mono">{existingInterview?.interviewId ?? nextInterviewId}</p>
            </div>
            <div className="rounded-xl bg-white/15 px-3 py-1.5 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/60">Recruiter</p>
              <p className="text-xs font-semibold text-white">{recruiterName}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">

        {/* Submission Selection */}
        <SectionCard icon={Users} title="Submission" color="indigo">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {/* Submission search */}
            <div ref={subRef}>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Submission ID *
              </label>
              {selectedSub ? (
                <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                    {initials(`${selectedSub.consultant.firstName} ${selectedSub.consultant.lastName}`)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-indigo-700">{selectedSub.submissionId}</p>
                    <p className="text-xs text-slate-600">{selectedSub.consultant.firstName} {selectedSub.consultant.lastName} · {selectedSub.technology}</p>
                  </div>
                  {!isEdit && (
                    <button type="button" onClick={clearSubmission}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-400 hover:text-slate-600 shadow-sm">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="Search by Sub ID or consultant…" value={subQuery}
                    onChange={(e) => { setSubQuery(e.target.value); setShowSubDropdown(true); if (selectedSub) clearSubmission(); }}
                    onFocus={() => setShowSubDropdown(true)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20" />
                  {selectedSub && (
                    <button type="button" onClick={clearSubmission} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  {showSubDropdown && filteredSubs.length > 0 && (
                    <ul className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                      {filteredSubs.map((s) => (
                        <li key={s.id}>
                          <button type="button" onMouseDown={(e) => { e.preventDefault(); selectSubmission(s); }}
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-indigo-50 transition-colors">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                              {initials(`${s.consultant.firstName} ${s.consultant.lastName}`)}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-indigo-700">{s.submissionId}</p>
                              <p className="text-xs text-slate-500">{s.consultant.firstName} {s.consultant.lastName} · {s.technology}</p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {showSubDropdown && filteredSubs.length === 0 && subQuery && (
                    <div className="absolute z-30 mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-center text-sm text-slate-400 shadow-xl">
                      No submissions found
                    </div>
                  )}
                </div>
              )}
              {errors.submissionId && <p className="mt-1 text-xs text-rose-500">{errors.submissionId}</p>}
            </div>

            {/* Consultant auto-populated */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Consultant</label>
              <div className="flex h-10 items-center rounded-xl border border-slate-100 bg-slate-50 px-3 text-sm text-slate-600">
                {selectedSub ? (
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[9px] font-bold text-indigo-700">
                      {initials(`${selectedSub.consultant.firstName} ${selectedSub.consultant.lastName}`)}
                    </div>
                    <span>{selectedSub.consultant.firstName} {selectedSub.consultant.lastName}</span>
                  </div>
                ) : <span className="text-slate-400">Auto-populated from submission</span>}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Schedule */}
        <SectionCard icon={Clock} title="Interview Schedule" color="violet">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 items-start">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Start Date & Time *</label>
              <input id="startDate" type="datetime-local" value={form.interviewStartDate} onChange={set("interviewStartDate")}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20" />
              {errors.interviewStartDate && <p className="mt-1 text-xs text-rose-500">{errors.interviewStartDate}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">End Date & Time *</label>
              <input id="endDate" type="datetime-local" value={form.interviewEndDate} onChange={set("interviewEndDate")}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20" />
              {errors.interviewEndDate && <p className="mt-1 text-xs text-rose-500">{errors.interviewEndDate}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Duration</label>
              <div className={cn("flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium",
                duration ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-100 bg-slate-50 text-slate-400")}>
                <Clock className="h-4 w-4 shrink-0" />
                {duration || "—"}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Level & Status */}
        <SectionCard icon={Layers} title="Level & Outcome" color="indigo">
          <div className="space-y-4">
            <div>
              <PillChips label="Interview Level *" value={form.interviewLevel} options={INTERVIEW_LEVELS}
                onChange={(v) => setForm((p) => ({ ...p, interviewLevel: v }))} required />
              {errors.interviewLevel && <p className="mt-1 text-xs text-rose-500">{errors.interviewLevel}</p>}
            </div>
            <div>
              <PillChips label="Interview Status *" value={form.interviewStatus} options={INTERVIEW_STATUSES}
                onChange={(v) => setForm((p) => ({ ...p, interviewStatus: v }))} required />
              {errors.interviewStatus && <p className="mt-1 text-xs text-rose-500">{errors.interviewStatus}</p>}
            </div>
          </div>
        </SectionCard>

        {/* Tech Support */}
        <SectionCard icon={Users} title="Tech Support" color="amber">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div ref={tsRef}>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tech Support Person</label>
              {selectedTs ? (
                <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                    {initials(`${selectedTs.firstName} ${selectedTs.lastName}`)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{selectedTs.firstName} {selectedTs.lastName}</p>
                    <p className="text-xs text-slate-500 truncate">{selectedTs.email}</p>
                  </div>
                  <button type="button" onClick={clearTechSupport}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-400 hover:text-slate-600 shadow-sm">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="Search tech support…" value={tsQuery}
                    onChange={(e) => { setTsQuery(e.target.value); if (selectedTs) clearTechSupport(); }}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-sm placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20" />
                  {tsSearching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
                  {showTsDropdown && tsResults.length > 0 && (
                    <ul className="absolute z-30 mt-1 max-h-40 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                      {tsResults.map((ts) => (
                        <li key={ts.id}>
                          <button type="button" onMouseDown={(e) => { e.preventDefault(); selectTechSupport(ts); }}
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-amber-50 transition-colors">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700">
                              {initials(`${ts.firstName} ${ts.lastName}`)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-900">{ts.firstName} {ts.lastName}</p>
                              <p className="text-xs text-slate-500">{ts.email}</p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {showTsDropdown && tsResults.length === 0 && !tsSearching && tsQuery && (
                    <div className="absolute z-30 mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-center text-sm text-slate-400 shadow-xl">
                      No tech support found
                    </div>
                  )}
                </div>
              )}
            </div>
            <Input compact id="amount" label="Amount" placeholder="e.g. $500" value={form.amount} onChange={set("amount")} />
            <div>
              <PillChips label="Tech Feedback" value={form.techSupportFeedback} options={TECH_FEEDBACKS}
                onChange={(v) => setForm((p) => ({ ...p, techSupportFeedback: v }))} />
            </div>
          </div>
        </SectionCard>

        {/* Notes & Links */}
        <SectionCard icon={MessageSquare} title="Questions & Feedback" color="blue">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Otter Link</label>
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 shrink-0 text-slate-400" />
              <input id="otterLink" type="text" placeholder="https://otter.ai/…" value={form.otterLink} onChange={set("otterLink")}
                className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20" />
            </div>
            {errors.otterLink && <p className="mt-1 text-xs text-rose-500">{errors.otterLink}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Interview Questions</label>
            <textarea id="interviewQuestions" rows={4} placeholder="List the interview questions asked…"
              value={form.interviewQuestions} onChange={set("interviewQuestions")}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 resize-y" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Interview Feedback</label>
            <input id="interviewFeedback" type="text" placeholder="Overall feedback from the interview…"
              value={form.interviewFeedback} onChange={set("interviewFeedback")}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20" />
          </div>
        </SectionCard>

        {/* Auto-populated submission details */}
        {selectedSub && (
          <SectionCard icon={Building2} title="Submission Details" subtitle="auto-populated" color="slate">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: "Vendor Company",          value: selectedSub.vendorCompany },
                { label: "Vendor Recruiter",        value: selectedSub.vendorRecruiterName },
                { label: "Vendor Email",            value: selectedSub.vendorRecruiterEmail },
                { label: "Vendor Phone",            value: selectedSub.vendorRecruiterPhone },
                { label: "Implementation Name",     value: selectedSub.implementationName },
                { label: "Implementation Email",    value: selectedSub.implementationEmail },
                { label: "Implementation Phone",    value: selectedSub.implementationPhone },
                { label: "Client Name",             value: selectedSub.clientName },
                { label: "Client Location",         value: selectedSub.clientLocation },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</label>
                  <div className="flex items-center rounded-lg bg-slate-50 border border-slate-100 px-3 h-9 text-sm text-slate-700">
                    {value || <span className="text-slate-300">—</span>}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        <div className="flex justify-end gap-2 pt-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
              Cancel
            </Button>
          )}
          <Button onClick={submit} disabled={isPending} className="px-8">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Schedule Interview"}
          </Button>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  );
}
