"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { Calendar, Loader2, Search, X, Clock } from "lucide-react";
import { validateOptionalUrl } from "@/lib/validators";

const INTERVIEW_LEVELS = ["Screening", "Level 1", "Level 2", "Level 3", "Final"];
const INTERVIEW_STATUSES = ["Rejected", "Moved To Next Round", "Confirmation"];
const TECH_FEEDBACKS = [
  "Technically Strong", "Average", "Poor Technical Skills",
  "Taking AI support", "Other",
];

interface MySubmission {
  id: string;
  submissionId: string;
  technology: string;
  vendorCompany: string;
  vendorRecruiterName: string;
  vendorRecruiterEmail: string;
  vendorRecruiterPhone: string;
  implementationName: string | null;
  implementationEmail: string | null;
  implementationPhone: string | null;
  clientName: string | null;
  clientLocation: string | null;
  consultant: { firstName: string; lastName: string };
}

interface TechSupportPerson {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
}

interface Props {
  recruiterId: string;
  recruiterName: string;
  nextInterviewId: string;
  mySubmissions: MySubmission[];
}

const EMPTY_FORM = {
  submissionId: "",
  interviewStartDate: "",
  interviewEndDate: "",
  interviewLevel: "",
  interviewStatus: "",
  techSupportId: "",
  amount: "",
  techSupportFeedback: "",
  otterLink: "",
  interviewQuestions: "",
  interviewFeedback: "",
};

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

export function InterviewForm({ recruiterName, nextInterviewId, mySubmissions }: Props) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof EMPTY_FORM, string>>>({});
  const [isPending, startTransition] = useTransition();
  const { toast, show, hide } = useToast();
  const router = useRouter();

  // Selected submission details (auto-populated)
  const [selectedSub, setSelectedSub] = useState<MySubmission | null>(null);
  const [subQuery, setSubQuery] = useState("");
  const [showSubDropdown, setShowSubDropdown] = useState(false);
  const subRef = useRef<HTMLDivElement>(null);

  // Tech support search
  const [tsQuery, setTsQuery] = useState("");
  const [tsResults, setTsResults] = useState<TechSupportPerson[]>([]);
  const [tsSearching, setTsSearching] = useState(false);
  const [showTsDropdown, setShowTsDropdown] = useState(false);
  const [selectedTs, setSelectedTs] = useState<TechSupportPerson | null>(null);
  const tsRef = useRef<HTMLDivElement>(null);
  const tsDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter submissions client-side
  const filteredSubs = mySubmissions.filter((s) => {
    const q = subQuery.toLowerCase();
    return (
      s.submissionId.toLowerCase().includes(q) ||
      `${s.consultant.firstName} ${s.consultant.lastName}`.toLowerCase().includes(q)
    );
  });

  // Close dropdowns on outside click
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
      const data = await res.json();
      setTsResults(data);
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

  const clearSubmission = () => {
    setSelectedSub(null);
    setSubQuery("");
    setForm((p) => ({ ...p, submissionId: "" }));
  };

  const selectTechSupport = (ts: TechSupportPerson) => {
    setSelectedTs(ts);
    setTsQuery(`${ts.firstName} ${ts.lastName}`);
    setForm((p) => ({ ...p, techSupportId: ts.id }));
    setShowTsDropdown(false);
  };

  const clearTechSupport = () => {
    setSelectedTs(null);
    setTsQuery("");
    setForm((p) => ({ ...p, techSupportId: "" }));
  };

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
        const res = await fetch("/api/interviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            submissionId: form.submissionId,
            interviewStartDate: form.interviewStartDate,
            interviewEndDate: form.interviewEndDate,
            interviewLevel: form.interviewLevel,
            interviewStatus: form.interviewStatus,
            techSupportId: form.techSupportId || null,
            amount: form.amount,
            techSupportFeedback: form.techSupportFeedback,
            otterLink: form.otterLink,
            interviewQuestions: form.interviewQuestions,
            interviewFeedback: form.interviewFeedback,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to save interview");
        show(`Interview ${data.interviewId} created successfully`, "success");
        setForm(EMPTY_FORM);
        setSubQuery(""); setSelectedSub(null);
        setTsQuery(""); setSelectedTs(null);
        router.refresh();
      } catch (err: unknown) {
        show(err instanceof Error ? err.message : "Error saving interview", "error");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-indigo-600" />
          New Interview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Row 1 — Auto fields */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Interview ID *</label>
            <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-mono text-slate-600 select-none">
              {nextInterviewId}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Recruiter Name *</label>
            <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 select-none">
              {recruiterName}
            </div>
          </div>
        </div>

        {/* Submission search */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1" ref={subRef}>
            <label className="text-sm font-medium text-slate-700">Submission ID *</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Sub ID or consultant…"
                value={subQuery}
                onChange={(e) => { setSubQuery(e.target.value); setShowSubDropdown(true); if (selectedSub) clearSubmission(); }}
                onFocus={() => setShowSubDropdown(true)}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-9 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              {selectedSub && (
                <button type="button" onClick={clearSubmission} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              )}
              {showSubDropdown && filteredSubs.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {filteredSubs.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); selectSubmission(s); }}
                        className="flex w-full flex-col px-3 py-2 text-left hover:bg-blue-50 transition-colors"
                      >
                        <span className="text-sm font-semibold text-blue-700">{s.submissionId}</span>
                        <span className="text-xs text-slate-500">
                          {s.consultant.firstName} {s.consultant.lastName} · {s.technology}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {showSubDropdown && filteredSubs.length === 0 && subQuery && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-center text-sm text-slate-400 shadow-lg">
                  No submissions found
                </div>
              )}
            </div>
            {errors.submissionId && <p className="text-xs text-rose-500">{errors.submissionId}</p>}
          </div>

          {/* Consultant — auto-populated */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Consultant Name</label>
            <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 select-none">
              {selectedSub
                ? `${selectedSub.consultant.firstName} ${selectedSub.consultant.lastName}`
                : <span className="text-slate-400">Auto-populated from submission</span>}
            </div>
          </div>
        </div>

        {/* Interview Date/Time + Duration */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Interview Schedule</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 items-end">
            <div className="flex flex-col gap-1">
              <label htmlFor="startDate" className="text-sm font-medium text-slate-700">Start Date & Time *</label>
              <input
                id="startDate"
                type="datetime-local"
                value={form.interviewStartDate}
                onChange={set("interviewStartDate")}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              {errors.interviewStartDate && <p className="text-xs text-rose-500">{errors.interviewStartDate}</p>}
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="endDate" className="text-sm font-medium text-slate-700">End Date & Time *</label>
              <input
                id="endDate"
                type="datetime-local"
                value={form.interviewEndDate}
                onChange={set("interviewEndDate")}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              {errors.interviewEndDate && <p className="text-xs text-rose-500">{errors.interviewEndDate}</p>}
            </div>

            {/* Duration badge */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Duration</label>
              <div className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium ${
                duration
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-slate-200 bg-slate-50 text-slate-400"
              }`}>
                <Clock className="h-4 w-4 shrink-0" />
                {duration || "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Level + Status */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            id="interviewLevel"
            label="Interview Level *"
            options={INTERVIEW_LEVELS.map((l) => ({ value: l, label: l }))}
            placeholder="Select level"
            value={form.interviewLevel}
            onChange={set("interviewLevel")}
            error={errors.interviewLevel}
          />
          <Select
            id="interviewStatus"
            label="Interview Status *"
            options={INTERVIEW_STATUSES.map((s) => ({ value: s, label: s }))}
            placeholder="Select status"
            value={form.interviewStatus}
            onChange={set("interviewStatus")}
            error={errors.interviewStatus}
          />
        </div>

        {/* Tech Support section */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Tech Support</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Tech support search */}
            <div className="flex flex-col gap-1" ref={tsRef}>
              <label className="text-sm font-medium text-slate-700">Tech Support</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search tech support…"
                  value={tsQuery}
                  onChange={(e) => { setTsQuery(e.target.value); if (selectedTs) clearTechSupport(); }}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-9 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {tsSearching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
                {selectedTs && !tsSearching && (
                  <button type="button" onClick={clearTechSupport} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="h-4 w-4" />
                  </button>
                )}
                {showTsDropdown && tsResults.length > 0 && (
                  <ul className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {tsResults.map((ts) => (
                      <li key={ts.id}>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); selectTechSupport(ts); }}
                          className="flex w-full flex-col px-3 py-2 text-left hover:bg-blue-50 transition-colors"
                        >
                          <span className="text-sm font-medium text-slate-900">{ts.firstName} {ts.lastName}</span>
                          <span className="text-xs text-slate-500">{ts.email}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {showTsDropdown && tsResults.length === 0 && !tsSearching && tsQuery && (
                  <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-center text-sm text-slate-400 shadow-lg">
                    No tech support found
                  </div>
                )}
              </div>
            </div>

            <Input id="amount" label="Amount" placeholder="e.g. $500" value={form.amount} onChange={set("amount")} />

            <Select
              id="techSupportFeedback"
              label="Tech Support Feedback"
              options={TECH_FEEDBACKS.map((f) => ({ value: f, label: f }))}
              placeholder="Select feedback"
              value={form.techSupportFeedback}
              onChange={set("techSupportFeedback")}
            />
          </div>
        </div>

        {/* Otter Link + Interview Questions */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input id="otterLink" label="Otter Link" placeholder="https://otter.ai/…" value={form.otterLink} onChange={set("otterLink")} error={errors.otterLink} />
          <div /> {/* spacer */}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="interviewQuestions" className="text-sm font-medium text-slate-700">Interview Questions</label>
          <textarea
            id="interviewQuestions"
            rows={5}
            placeholder="List the interview questions asked…"
            value={form.interviewQuestions}
            onChange={set("interviewQuestions")}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-y"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="interviewFeedback" className="text-sm font-medium text-slate-700">Interview Feedback</label>
          <input
            id="interviewFeedback"
            type="text"
            placeholder="Overall feedback from the interview…"
            value={form.interviewFeedback}
            onChange={set("interviewFeedback")}
            className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* Vendor/Implementation/Client — auto-populated from submission (disabled) */}
        {selectedSub && (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Submission Details (auto-populated)
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: "Vendor Company",           value: selectedSub.vendorCompany },
                { label: "Vendor Recruiter Name",    value: selectedSub.vendorRecruiterName },
                { label: "Vendor Recruiter Email",   value: selectedSub.vendorRecruiterEmail },
                { label: "Vendor Recruiter Phone",   value: selectedSub.vendorRecruiterPhone },
                { label: "Implementation Name",      value: selectedSub.implementationName },
                { label: "Implementation Email",     value: selectedSub.implementationEmail },
                { label: "Implementation Phone",     value: selectedSub.implementationPhone },
                { label: "Client Name",              value: selectedSub.clientName },
                { label: "Client Location",          value: selectedSub.clientLocation },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">{label}</label>
                  <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 select-none truncate">
                    {value || <span className="text-slate-400">—</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={submit} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
            {isPending ? "Saving…" : "Schedule Interview"}
          </Button>
        </div>
      </CardContent>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </Card>
  );
}
