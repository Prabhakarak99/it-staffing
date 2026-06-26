"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { Send, Loader2, Search, X } from "lucide-react";
import { validateOptionalEmail } from "@/lib/validators";

const VISA_STATUSES = [
  { value: "OPT", label: "OPT" },
  { value: "CPT", label: "CPT" },
  { value: "H1B", label: "H1B" },
  { value: "GC", label: "GC" },
  { value: "H4Ead", label: "H4 EAD" },
  { value: "Citizen", label: "Citizen" },
];

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

export function PreMarketingForm() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof EMPTY, string>>>({});
  const [isPending, startTransition] = useTransition();
  const { toast, show, hide } = useToast();
  const router = useRouter();

  // Consultant search
  const [consultantQuery, setConsultantQuery] = useState("");
  const [consultantResults, setConsultantResults] = useState<Consultant[]>([]);
  const [isConsultantSearching, setIsConsultantSearching] = useState(false);
  const [showConsultantDropdown, setShowConsultantDropdown] = useState(false);
  const consultantRef = useRef<HTMLDivElement>(null);
  const consultantDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recruiter search
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

  // Close dropdowns on outside click
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
    setForm((p) => ({ ...p, consultantId: c.id, consultantName: `${c.firstName} ${c.lastName}` }));
    setConsultantQuery(`${c.firstName} ${c.lastName}`);
    setShowConsultantDropdown(false);
  };

  const clearConsultant = () => {
    setForm((p) => ({ ...p, consultantId: "", consultantName: "" }));
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

  const set = (field: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setRadio = (field: keyof typeof EMPTY, value: string) =>
    setForm((p) => ({ ...p, [field]: value }));

  const validate = () => {
    const errs: Partial<Record<keyof typeof EMPTY, string>> = {};
    if (!form.consultantId) errs.consultantId = "Select a consultant";
    if (form.marketingStartDate && !form.recruiterId) errs.recruiterId = "Recruiter is required when Marketing Start Date is set";
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
      } catch (err: unknown) {
        show(err instanceof Error ? err.message : "Error saving record", "error");
      }
    });
  };

  const RadioGroup = ({ field, label }: { field: keyof typeof EMPTY; label: string }) => (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="flex gap-4">
        {["Yes", "No"].map((v) => (
          <label key={v} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={field}
              value={v}
              checked={form[field] === v}
              onChange={() => setRadio(field, v)}
              className="h-4 w-4 accent-indigo-600"
            />
            <span className="text-sm text-slate-700">{v}</span>
          </label>
        ))}
      </div>
    </div>
  );

  const SearchBox = ({
    label,
    query,
    setQuery,
    results,
    isSearching,
    showDropdown,
    selectedId,
    onSelect,
    onClear,
    boxRef,
    error,
    required,
    renderItem,
  }: {
    label: string;
    query: string;
    setQuery: (v: string) => void;
    results: Array<{ id: string; firstName: string; lastName: string; email: string }>;
    isSearching: boolean;
    showDropdown: boolean;
    selectedId: string;
    onSelect: (item: { id: string; firstName: string; lastName: string; email: string }) => void;
    onClear: () => void;
    boxRef: React.RefObject<HTMLDivElement | null>;
    error?: string;
    required?: boolean;
    renderItem?: (item: { id: string; firstName: string; lastName: string; email: string }) => React.ReactNode;
  }) => (
    <div className="flex flex-col gap-1" ref={boxRef}>
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}{required && " *"}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder={`Search ${label.toLowerCase()}…`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (selectedId) onClear();
          }}
          className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-9 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        )}
        {selectedId && !isSearching && (
          <button type="button" onClick={onClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        )}
        {showDropdown && results.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
            {results.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); onSelect(item); }}
                  className="flex w-full flex-col px-3 py-2 text-left hover:bg-indigo-50 transition-colors"
                >
                  {renderItem ? renderItem(item) : (
                    <>
                      <span className="text-sm font-medium text-slate-900">{item.firstName} {item.lastName}</span>
                      <span className="text-xs text-slate-500">{item.email}</span>
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {showDropdown && results.length === 0 && !isSearching && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-4 text-center text-sm text-slate-400 shadow-lg">
            No results found
          </div>
        )}
      </div>
      {error && <p className="text-xs text-rose-500">{error}</p>}
      {selectedId && <p className="text-xs text-emerald-600">✓ {query} selected</p>}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5 text-indigo-600" />
          New Pre-Marketing Entry
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Consultant Search */}
        <SearchBox
          label="Consultant Name"
          query={consultantQuery}
          setQuery={setConsultantQuery}
          results={consultantResults}
          isSearching={isConsultantSearching}
          showDropdown={showConsultantDropdown}
          selectedId={form.consultantId}
          onSelect={selectConsultant}
          onClear={clearConsultant}
          boxRef={consultantRef}
          error={errors.consultantId}
          required
          renderItem={(c) => (
            <>
              <span className="text-sm font-medium text-slate-900">{c.firstName} {c.lastName}</span>
              <span className="text-xs text-slate-500">{c.email}</span>
            </>
          )}
        />

        {/* Document Availability */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Document Availability</p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <RadioGroup field="dlAvailable" label="DL Available" />
            <RadioGroup field="visaAvailable" label="Visa Available" />
            <RadioGroup field="ssnAvailable" label="SSN Available" />
          </div>
        </div>

        {/* Marketing Sheet */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Marketing Sheet</p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <RadioGroup field="marketingSheetReady" label="Marketing Sheet Ready" />
            <RadioGroup field="marketingSheetExplained" label="Marketing Sheet Explained" />
            <RadioGroup field="marketingSheetReverseKT" label="Marketing Sheet Reverse KT" />
          </div>
        </div>

        {/* Training */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Training Completion</p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <RadioGroup field="allTrainingSessionsCompleted" label="All Training Sessions Completed" />
            <RadioGroup field="allTrainingAssignmentsCompleted" label="All Training Assignments Completed" />
          </div>
        </div>

        {/* Marketing Details */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Marketing Details</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              id="pm-email"
              label="Marketing Email"
              type="email"
              placeholder="marketing@example.com"
              value={form.marketingEmail}
              onChange={set("marketingEmail")}
              error={errors.marketingEmail}
            />
            <Select
              id="pm-visa-status"
              label="Marketing Visa Status"
              options={VISA_STATUSES}
              placeholder="Select visa status"
              value={form.marketingVisaStatus}
              onChange={set("marketingVisaStatus")}
            />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              id="pm-start"
              label="Marketing Start Date"
              type="date"
              value={form.marketingStartDate}
              onChange={set("marketingStartDate")}
            />
            <Input
              id="pm-end"
              label="Marketing End Date"
              type="date"
              value={form.marketingEndDate}
              onChange={set("marketingEndDate")}
              error={errors.marketingEndDate}
            />
          </div>
        </div>

        {/* Recruiter Search — shown always, required when start date set */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Assigned Recruiter
            {form.marketingStartDate && <span className="ml-1 text-rose-500">*</span>}
          </p>
          <div className="max-w-md">
            <SearchBox
              label="Recruiter Name"
              query={recruiterQuery}
              setQuery={setRecruiterQuery}
              results={recruiterResults}
              isSearching={isRecruiterSearching}
              showDropdown={showRecruiterDropdown}
              selectedId={form.recruiterId}
              onSelect={selectRecruiter}
              onClear={clearRecruiter}
              boxRef={recruiterRef}
              error={errors.recruiterId}
              required={!!form.marketingStartDate}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={submit} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isPending ? "Saving…" : "Save Pre-Marketing"}
          </Button>
        </div>
      </CardContent>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </Card>
  );
}
