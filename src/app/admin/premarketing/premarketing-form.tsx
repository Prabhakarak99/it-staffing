"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  Send, Loader2, Search, X, User, FileCheck,
  BookOpen, GraduationCap, CalendarRange, UserSearch,
  CheckCircle2, ChevronRight,
} from "lucide-react";
import { validateOptionalEmail } from "@/lib/validators";

const VISA_STATUSES = ["OPT", "CPT", "H1B", "GC", "H4Ead", "Citizen"];

interface Consultant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  technology: string | null;
}

interface Recruiter {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

const EMPTY = {
  consultantId: "",
  consultantName: "",
  consultantEmail: "",
  consultantTechnology: "",
  dlAvailable: "",
  visaAvailable: "",
  ssnAvailable: "",
  marketingSheetReady: "",
  marketingSheetExplained: "",
  marketingSheetReverseKT: "",
  allTrainingSessionsCompleted: "",
  allTrainingAssignmentsCompleted: "",
  marketingEmail: "",
  marketingVisaStatus: "",
  marketingStartDate: "",
  marketingEndDate: "",
  recruiterId: "",
  recruiterName: "",
};

const BOOL_FIELDS = [
  "dlAvailable", "visaAvailable", "ssnAvailable",
  "marketingSheetReady", "marketingSheetExplained", "marketingSheetReverseKT",
  "allTrainingSessionsCompleted", "allTrainingAssignmentsCompleted",
] as const;

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export function PreMarketingForm({ onSuccess }: { onSuccess?: () => void } = {}) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof EMPTY, string>>>({});
  const [isPending, startTransition] = useTransition();
  const { toast, show, hide } = useToast();
  const router = useRouter();

  const [consultantQuery, setConsultantQuery] = useState("");
  const [consultantResults, setConsultantResults] = useState<Consultant[]>([]);
  const [isConsultantSearching, setIsConsultantSearching] = useState(false);
  const [showConsultantDropdown, setShowConsultantDropdown] = useState(false);
  const consultantRef = useRef<HTMLDivElement>(null);
  const consultantDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [recruiterQuery, setRecruiterQuery] = useState("");
  const [recruiterResults, setRecruiterResults] = useState<Recruiter[]>([]);
  const [isRecruiterSearching, setIsRecruiterSearching] = useState(false);
  const [showRecruiterDropdown, setShowRecruiterDropdown] = useState(false);
  const recruiterRef = useRef<HTMLDivElement>(null);
  const recruiterDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchConsultants = useCallback(async (q: string) => {
    if (!q.trim()) { setConsultantResults([]); setShowConsultantDropdown(false); return; }
    setIsConsultantSearching(true);
    try {
      const res = await fetch(`/api/students/search?q=${encodeURIComponent(q)}`);
      setConsultantResults(await res.json());
      setShowConsultantDropdown(true);
    } catch { setConsultantResults([]); }
    finally { setIsConsultantSearching(false); }
  }, []);

  const searchRecruiters = useCallback(async (q: string) => {
    if (!q.trim()) { setRecruiterResults([]); setShowRecruiterDropdown(false); return; }
    setIsRecruiterSearching(true);
    try {
      const res = await fetch(`/api/recruiters/search?q=${encodeURIComponent(q)}`);
      setRecruiterResults(await res.json());
      setShowRecruiterDropdown(true);
    } catch { setRecruiterResults([]); }
    finally { setIsRecruiterSearching(false); }
  }, []);

  useEffect(() => {
    if (consultantDebounce.current) clearTimeout(consultantDebounce.current);
    consultantDebounce.current = setTimeout(() => searchConsultants(consultantQuery), 300);
    return () => { if (consultantDebounce.current) clearTimeout(consultantDebounce.current); };
  }, [consultantQuery, searchConsultants]);

  useEffect(() => {
    if (recruiterDebounce.current) clearTimeout(recruiterDebounce.current);
    recruiterDebounce.current = setTimeout(() => searchRecruiters(recruiterQuery), 300);
    return () => { if (recruiterDebounce.current) clearTimeout(recruiterDebounce.current); };
  }, [recruiterQuery, searchRecruiters]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (consultantRef.current && !consultantRef.current.contains(e.target as Node))
        setShowConsultantDropdown(false);
      if (recruiterRef.current && !recruiterRef.current.contains(e.target as Node))
        setShowRecruiterDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectConsultant = (c: Consultant) => {
    setForm((p) => ({
      ...p,
      consultantId: c.id,
      consultantName: `${c.firstName} ${c.lastName}`,
      consultantEmail: c.email,
      consultantTechnology: c.technology ?? "",
    }));
    setConsultantQuery(`${c.firstName} ${c.lastName}`);
    setShowConsultantDropdown(false);
  };

  const clearConsultant = () => {
    setForm((p) => ({ ...p, consultantId: "", consultantName: "", consultantEmail: "", consultantTechnology: "" }));
    setConsultantQuery("");
    setConsultantResults([]);
  };

  const selectRecruiter = (r: Recruiter) => {
    setForm((p) => ({ ...p, recruiterId: r.id, recruiterName: `${r.firstName} ${r.lastName}` }));
    setRecruiterQuery(`${r.firstName} ${r.lastName}`);
    setShowRecruiterDropdown(false);
  };

  const clearRecruiter = () => {
    setForm((p) => ({ ...p, recruiterId: "", recruiterName: "" }));
    setRecruiterQuery("");
    setRecruiterResults([]);
  };

  const toggle = (field: keyof typeof EMPTY, value: string) =>
    setForm((p) => ({ ...p, [field]: p[field] === value ? "" : value }));

  const validate = () => {
    const errs: Partial<Record<keyof typeof EMPTY, string>> = {};
    if (!form.consultantId) errs.consultantId = "Select a consultant to continue";
    if (form.marketingStartDate && !form.recruiterId) errs.recruiterId = "Recruiter required when start date is set";
    if (form.marketingStartDate && form.marketingEndDate && new Date(form.marketingEndDate) <= new Date(form.marketingStartDate))
      errs.marketingEndDate = "End date must be after start date";
    const emailErr = validateOptionalEmail(form.marketingEmail);
    if (emailErr) errs.marketingEmail = emailErr;
    return errs;
  };

  const submit = () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    startTransition(async () => {
      try {
        const res = await fetch("/api/premarketing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consultantId: form.consultantId,
            dlAvailable: form.dlAvailable,
            visaAvailable: form.visaAvailable,
            ssnAvailable: form.ssnAvailable,
            marketingSheetReady: form.marketingSheetReady,
            marketingSheetExplained: form.marketingSheetExplained,
            marketingSheetReverseKT: form.marketingSheetReverseKT,
            allTrainingSessionsCompleted: form.allTrainingSessionsCompleted,
            allTrainingAssignmentsCompleted: form.allTrainingAssignmentsCompleted,
            marketingEmail: form.marketingEmail,
            marketingVisaStatus: form.marketingVisaStatus,
            marketingStartDate: form.marketingStartDate,
            marketingEndDate: form.marketingEndDate,
            recruiterId: form.recruiterId,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to save");
        show(`Pre-marketing record saved for ${form.consultantName}`, "success");
        setForm(EMPTY);
        setConsultantQuery("");
        setRecruiterQuery("");
        router.refresh();
        onSuccess?.();
      } catch (err: unknown) {
        show(err instanceof Error ? err.message : "Error saving record", "error");
      }
    });
  };

  // Completion score
  const filled = BOOL_FIELDS.filter((f) => form[f] === "Yes").length;

  // Yes/No pill toggle row
  const YesNoRow = ({ field, label }: { field: keyof typeof EMPTY; label: string }) => {
    const val = form[field];
    return (
      <div className="flex items-center justify-between py-3.5 border-b border-slate-100 last:border-0">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => toggle(field, "Yes")}
            className={cn(
              "px-5 py-1.5 text-xs font-semibold transition-all duration-150",
              val === "Yes"
                ? "bg-emerald-500 text-white"
                : "bg-white text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"
            )}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => toggle(field, "No")}
            className={cn(
              "px-5 py-1.5 text-xs font-semibold transition-all duration-150 border-l border-slate-200",
              val === "No"
                ? "bg-rose-500 text-white"
                : "bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-700"
            )}
          >
            No
          </button>
        </div>
      </div>
    );
  };

  const SectionCard = ({
    title, icon, accentColor, children,
  }: {
    title: string;
    icon: React.ReactNode;
    accentColor: string;
    children: React.ReactNode;
  }) => (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden`}>
      <div className={`flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 ${accentColor}`}>
        {icon}
        <span className="text-xs font-bold uppercase tracking-widest text-slate-600">{title}</span>
      </div>
      <div className="px-5">{children}</div>
    </div>
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Form header */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
              <Send className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">New Pre-Marketing Entry</h2>
              <p className="text-xs text-indigo-200 mt-0.5">Track consultant readiness before going to market</p>
            </div>
          </div>
          {/* Readiness progress */}
          <div className="hidden sm:flex flex-col items-end gap-1">
            <span className="text-xs text-indigo-200 font-medium">{filled} / 8 checks completed</span>
            <div className="flex gap-1">
              {BOOL_FIELDS.map((f) => (
                <div
                  key={f}
                  className={cn(
                    "h-1.5 w-5 rounded-full transition-all duration-300",
                    form[f] === "Yes" ? "bg-emerald-400" : form[f] === "No" ? "bg-rose-400/60" : "bg-white/20"
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">

        {/* Consultant Search */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
            <User className="h-4 w-4 text-indigo-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Consultant</span>
            <span className="ml-1 text-rose-500 text-xs font-bold">*</span>
          </div>
          <div className="p-5">
            <div ref={consultantRef} className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name or email…"
                value={consultantQuery}
                onChange={(e) => { setConsultantQuery(e.target.value); if (form.consultantId) clearConsultant(); }}
                className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-9 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
              {isConsultantSearching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
              {form.consultantId && !isConsultantSearching && (
                <button type="button" onClick={clearConsultant} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              )}
              {showConsultantDropdown && consultantResults.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                  {consultantResults.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); selectConsultant(c); }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-indigo-50 transition-colors"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                          {initials(`${c.firstName} ${c.lastName}`)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{c.firstName} {c.lastName}</p>
                          <p className="text-xs text-slate-500">{c.email}{c.technology ? ` · ${c.technology}` : ""}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {showConsultantDropdown && consultantResults.length === 0 && !isConsultantSearching && (
                <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-5 text-center text-sm text-slate-400 shadow-lg">
                  No consultants found
                </div>
              )}
            </div>

            {errors.consultantId && (
              <p className="mt-2 text-xs text-rose-500 flex items-center gap-1">
                <span className="h-3 w-3 rounded-full bg-rose-100 text-rose-500 inline-flex items-center justify-center text-[10px] font-bold">!</span>
                {errors.consultantId}
              </p>
            )}

            {/* Selected consultant card */}
            {form.consultantId && (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-sm font-bold text-white shadow-sm">
                  {initials(form.consultantName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{form.consultantName}</p>
                  <p className="text-xs text-slate-500 truncate">{form.consultantEmail}</p>
                </div>
                {form.consultantTechnology && (
                  <span className="shrink-0 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                    {form.consultantTechnology}
                  </span>
                )}
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
              </div>
            )}
          </div>
        </div>

        {/* Two-column checklist sections */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

          {/* Document Availability */}
          <SectionCard title="Document Availability" icon={<FileCheck className="h-4 w-4 text-blue-500" />} accentColor="bg-blue-50">
            <YesNoRow field="dlAvailable" label="Driver's License (DL)" />
            <YesNoRow field="visaAvailable" label="Visa Copy" />
            <YesNoRow field="ssnAvailable" label="Social Security (SSN)" />
          </SectionCard>

          {/* Marketing Sheet */}
          <SectionCard title="Marketing Sheet" icon={<BookOpen className="h-4 w-4 text-violet-500" />} accentColor="bg-violet-50">
            <YesNoRow field="marketingSheetReady" label="Marketing Sheet Ready" />
            <YesNoRow field="marketingSheetExplained" label="Explained to Consultant" />
            <YesNoRow field="marketingSheetReverseKT" label="Reverse KT Completed" />
          </SectionCard>

          {/* Training Completion */}
          <SectionCard title="Training Completion" icon={<GraduationCap className="h-4 w-4 text-amber-500" />} accentColor="bg-amber-50">
            <YesNoRow field="allTrainingSessionsCompleted" label="All Training Sessions Done" />
            <YesNoRow field="allTrainingAssignmentsCompleted" label="All Assignments Submitted" />
          </SectionCard>

          {/* Marketing Details */}
          <SectionCard title="Marketing Details" icon={<CalendarRange className="h-4 w-4 text-teal-500" />} accentColor="bg-teal-50">
            <div className="py-4 space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Marketing Email</label>
                <input
                  type="email"
                  placeholder="marketing@example.com"
                  value={form.marketingEmail}
                  onChange={(e) => setForm((p) => ({ ...p, marketingEmail: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                {errors.marketingEmail && <p className="text-xs text-rose-500">{errors.marketingEmail}</p>}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Visa Status</label>
                <div className="flex flex-wrap gap-2">
                  {VISA_STATUSES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, marketingVisaStatus: p.marketingVisaStatus === v ? "" : v }))}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-150",
                        form.marketingVisaStatus === v
                          ? "border-indigo-500 bg-indigo-500 text-white"
                          : "border-slate-300 bg-white text-slate-600 hover:border-indigo-400 hover:text-indigo-600"
                      )}
                    >
                      {v === "H4Ead" ? "H4 EAD" : v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Start Date</label>
                  <input
                    type="date"
                    value={form.marketingStartDate}
                    onChange={(e) => setForm((p) => ({ ...p, marketingStartDate: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 mt-5 shrink-0" />
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">End Date</label>
                  <input
                    type="date"
                    value={form.marketingEndDate}
                    onChange={(e) => setForm((p) => ({ ...p, marketingEndDate: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  {errors.marketingEndDate && <p className="text-xs text-rose-500">{errors.marketingEndDate}</p>}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Recruiter */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
            <UserSearch className="h-4 w-4 text-rose-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Assigned Recruiter</span>
            {form.marketingStartDate && <span className="ml-1 text-rose-500 text-xs font-bold">*</span>}
          </div>
          <div className="p-5">
            <div ref={recruiterRef} className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search recruiter by name…"
                value={recruiterQuery}
                onChange={(e) => { setRecruiterQuery(e.target.value); if (form.recruiterId) clearRecruiter(); }}
                className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-9 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              {isRecruiterSearching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
              {form.recruiterId && !isRecruiterSearching && (
                <button type="button" onClick={clearRecruiter} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              )}
              {showRecruiterDropdown && recruiterResults.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                  {recruiterResults.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); selectRecruiter(r); }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition-colors"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-700">
                          {initials(`${r.firstName} ${r.lastName}`)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{r.firstName} {r.lastName}</p>
                          <p className="text-xs text-slate-500">{r.email}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {showRecruiterDropdown && recruiterResults.length === 0 && !isRecruiterSearching && (
                <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-5 text-center text-sm text-slate-400 shadow-lg">
                  No recruiters found
                </div>
              )}
            </div>
            {errors.recruiterId && <p className="mt-2 text-xs text-rose-500">{errors.recruiterId}</p>}
            {form.recruiterId && (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white">
                  {initials(form.recruiterName)}
                </div>
                <span className="text-sm font-semibold text-slate-800">{form.recruiterName}</span>
                <CheckCircle2 className="ml-auto h-4 w-4 text-rose-500" />
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">
              {filled}
            </span>
            <span>of 8 readiness checks confirmed</span>
          </div>
          <Button onClick={submit} disabled={isPending} className="px-6">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isPending ? "Saving…" : "Save Pre-Marketing"}
          </Button>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  );
}
