"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { FileText, Loader2, Search, X } from "lucide-react";
import { isValidEmail, isValidPhone, validateOptionalEmail, validateOptionalPhone } from "@/lib/validators";

const TECHNOLOGIES = [
  ".Net", "Java", "DE", "DS/GenAi/ML", "Devops",
  "Mainframes", "Networking", "BA", "Sales Force",
];

const STATUSES = [
  "Submission Submitted", "In Review", "Rejected",
  "Moved to Client", "Confirmation",
];

interface Consultant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  technology: string | null;
}

interface Props {
  recruiterId: string;
  recruiterName: string;
  nextSubmissionId: string;
}

const EMPTY = {
  consultantId: "",
  consultantName: "",
  technology: "",
  jobDescription: "",
  payRate: "",
  vendorCompany: "",
  vendorRecruiterName: "",
  vendorRecruiterEmail: "",
  vendorRecruiterPhone: "",
  implementationName: "",
  implementationEmail: "",
  implementationPhone: "",
  clientName: "",
  clientLocation: "",
  status: "Submission Submitted",
};

export function SubmissionForm({ recruiterId, recruiterName, nextSubmissionId }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof EMPTY, string>>>({});
  const [isPending, startTransition] = useTransition();
  const { toast, show, hide } = useToast();
  const router = useRouter();

  // Consultant search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Consultant[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchConsultants = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); setShowDropdown(false); return; }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/students/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data);
      setShowDropdown(true);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchConsultants(searchQuery), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, searchConsultants]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectConsultant = (c: Consultant) => {
    setForm((prev) => ({
      ...prev,
      consultantId: c.id,
      consultantName: `${c.firstName} ${c.lastName}`,
      technology: c.technology ?? prev.technology,
    }));
    setSearchQuery(`${c.firstName} ${c.lastName}`);
    setShowDropdown(false);
  };

  const clearConsultant = () => {
    setForm((prev) => ({ ...prev, consultantId: "", consultantName: "", technology: "" }));
    setSearchQuery("");
    setSearchResults([]);
  };

  const set = (field: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const validate = () => {
    const errs: typeof errors = {};
    if (!form.consultantId) errs.consultantId = "Select a consultant";
    if (!form.technology) errs.technology = "Required";
    if (!form.vendorCompany.trim()) errs.vendorCompany = "Required";
    if (!form.vendorRecruiterName.trim()) errs.vendorRecruiterName = "Required";
    if (!form.vendorRecruiterEmail.trim()) errs.vendorRecruiterEmail = "Required";
    else if (!isValidEmail(form.vendorRecruiterEmail)) errs.vendorRecruiterEmail = "Invalid email address";
    if (!form.vendorRecruiterPhone.trim()) errs.vendorRecruiterPhone = "Required";
    else if (!isValidPhone(form.vendorRecruiterPhone)) errs.vendorRecruiterPhone = "Invalid phone format";
    const implEmailErr = validateOptionalEmail(form.implementationEmail);
    if (implEmailErr) errs.implementationEmail = implEmailErr;
    const implPhoneErr = validateOptionalPhone(form.implementationPhone);
    if (implPhoneErr) errs.implementationPhone = implPhoneErr;
    return errs;
  };

  const submit = () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});

    startTransition(async () => {
      try {
        const res = await fetch("/api/submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consultantId: form.consultantId,
            technology: form.technology,
            jobDescription: form.jobDescription,
            payRate: form.payRate,
            vendorCompany: form.vendorCompany,
            vendorRecruiterName: form.vendorRecruiterName,
            vendorRecruiterEmail: form.vendorRecruiterEmail,
            vendorRecruiterPhone: form.vendorRecruiterPhone,
            implementationName: form.implementationName,
            implementationEmail: form.implementationEmail,
            implementationPhone: form.implementationPhone,
            clientName: form.clientName,
            clientLocation: form.clientLocation,
            status: form.status,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to create submission");
        show(`Submission ${data.submissionId} created successfully`, "success");
        setForm(EMPTY);
        setSearchQuery("");
        router.refresh();
      } catch (err: unknown) {
        show(err instanceof Error ? err.message : "Error creating submission", "error");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-600" />
          New Submission
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Row 1 — Auto fields */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Submission ID *</label>
            <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-mono text-slate-600 select-none">
              {nextSubmissionId}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Submission Date *</label>
            <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 select-none">
              {new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Recruiter Name *</label>
            <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 select-none">
              {recruiterName}
            </div>
          </div>
        </div>

        {/* Row 2 — Consultant search + Technology */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Consultant search */}
          <div className="flex flex-col gap-1" ref={searchRef}>
            <label className="text-sm font-medium text-slate-700">Consultant Name *</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search consultant by name…"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (form.consultantId) clearConsultant();
                }}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-9 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
              )}
              {form.consultantId && !isSearching && (
                <button
                  type="button"
                  onClick={clearConsultant}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}

              {showDropdown && searchResults.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {searchResults.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); selectConsultant(c); }}
                        className="flex w-full flex-col px-3 py-2 text-left hover:bg-blue-50 transition-colors"
                      >
                        <span className="text-sm font-medium text-slate-900">
                          {c.firstName} {c.lastName}
                        </span>
                        <span className="text-xs text-slate-500">
                          {c.email}{c.technology ? ` · ${c.technology}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {showDropdown && searchResults.length === 0 && !isSearching && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-4 text-center text-sm text-slate-400 shadow-lg">
                  No consultants found
                </div>
              )}
            </div>
            {errors.consultantId && <p className="text-xs text-rose-500">{errors.consultantId}</p>}
            {form.consultantId && (
              <p className="text-xs text-green-600">✓ {form.consultantName} selected</p>
            )}
          </div>

          <Select
            id="technology"
            label="Technology *"
            options={TECHNOLOGIES.map((t) => ({ value: t, label: t }))}
            placeholder="Select technology"
            value={form.technology}
            onChange={set("technology")}
            error={errors.technology}
          />
        </div>

        {/* Job Description */}
        <div className="flex flex-col gap-1">
          <label htmlFor="jobDescription" className="text-sm font-medium text-slate-700">
            Job Description
          </label>
          <textarea
            id="jobDescription"
            rows={5}
            placeholder="Paste the job description here…"
            value={form.jobDescription}
            onChange={set("jobDescription")}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-y"
          />
        </div>

        {/* Vendor Section */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Vendor Details</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input id="payRate" label="Pay Rate" placeholder="e.g. $65/hr" value={form.payRate} onChange={set("payRate")} />
            <Input id="vendorCompany" label="Vendor Company *" placeholder="Company name" value={form.vendorCompany} onChange={set("vendorCompany")} error={errors.vendorCompany} />
            <Input id="vendorRecruiterName" label="Vendor Recruiter Name *" placeholder="Full name" value={form.vendorRecruiterName} onChange={set("vendorRecruiterName")} error={errors.vendorRecruiterName} />
            <Input id="vendorRecruiterEmail" label="Vendor Recruiter Email *" type="email" placeholder="recruiter@vendor.com" value={form.vendorRecruiterEmail} onChange={set("vendorRecruiterEmail")} error={errors.vendorRecruiterEmail} />
            <Input id="vendorRecruiterPhone" label="Vendor Recruiter Phone *" placeholder="+1 555-000-0000" value={form.vendorRecruiterPhone} onChange={set("vendorRecruiterPhone")} error={errors.vendorRecruiterPhone} />
          </div>
        </div>

        {/* Implementation Section */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Implementation (Optional)</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input id="implementationName" label="Implementation Name" placeholder="Contact name" value={form.implementationName} onChange={set("implementationName")} />
            <Input id="implementationEmail" label="Implementation Email" type="email" placeholder="impl@company.com" value={form.implementationEmail} onChange={set("implementationEmail")} error={errors.implementationEmail} />
            <Input id="implementationPhone" label="Implementation Phone" type="tel" placeholder="555-000-0000" value={form.implementationPhone} onChange={set("implementationPhone")} error={errors.implementationPhone} />
          </div>
        </div>

        {/* Client + Status */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Client & Status</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input id="clientName" label="Client Name" placeholder="End client name" value={form.clientName} onChange={set("clientName")} />
            <Input id="clientLocation" label="Client Location" placeholder="City, State" value={form.clientLocation} onChange={set("clientLocation")} />
            <Select
              id="status"
              label="Status *"
              options={STATUSES.map((s) => ({ value: s, label: s }))}
              placeholder="Select status"
              value={form.status}
              onChange={set("status")}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={submit} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {isPending ? "Saving…" : "Create Submission"}
          </Button>
        </div>
      </CardContent>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </Card>
  );
}
