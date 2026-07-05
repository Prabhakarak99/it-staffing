"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { FileText, Loader2, Search, X, Building2, Users, Globe, Hash } from "lucide-react";
import { isValidEmail, isValidPhone, validateOptionalEmail, validateOptionalPhone } from "@/lib/validators";

const TECHNOLOGIES = [".Net", "Java", "DE", "DS/GenAi/ML", "Devops", "Mainframes", "Networking", "BA", "Sales Force"];
const STATUSES = ["Submission Submitted", "In Review", "Rejected", "Moved to Client", "Confirmation"];

interface Consultant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  technology: string | null;
}

interface ExistingSubmission {
  id: string;
  submissionId: string;
  technology: string;
  jobDescription: string | null;
  payRate: string | null;
  vendorCompany: string;
  vendorRecruiterName: string;
  vendorRecruiterEmail: string;
  vendorRecruiterPhone: string;
  implementationName: string | null;
  implementationEmail: string | null;
  implementationPhone: string | null;
  clientName: string | null;
  clientLocation: string | null;
  status: string;
  consultant: Consultant;
}

interface Props {
  recruiterId: string;
  recruiterName: string;
  nextSubmissionId: string;
  existingSubmission?: ExistingSubmission;
  onCancel?: () => void;
  onSuccess?: () => void;
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function SectionCard({ icon: Icon, title, subtitle, color, children }: {
  icon: React.ElementType; title: string; subtitle?: string; color: string; children: React.ReactNode;
}) {
  const colorMap: Record<string, { bg: string; border: string; icon: string }> = {
    blue:   { bg: "bg-blue-50",   border: "border-blue-100",   icon: "text-blue-500" },
    violet: { bg: "bg-violet-50", border: "border-violet-100", icon: "text-violet-500" },
    amber:  { bg: "bg-amber-50",  border: "border-amber-100",  icon: "text-amber-500" },
    emerald:{ bg: "bg-emerald-50",border: "border-emerald-100",icon: "text-emerald-500" },
    slate:  { bg: "bg-slate-50",  border: "border-slate-100",  icon: "text-slate-500" },
    rose:   { bg: "bg-rose-50",   border: "border-rose-100",   icon: "text-rose-500" },
  };
  const c = colorMap[color] ?? colorMap.slate;
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={cn("flex items-center gap-2.5 rounded-t-xl border-b px-4 py-3", c.bg, c.border)}>
        <Icon className={cn("h-4 w-4 shrink-0", c.icon)} />
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-700">{title}</span>
          {subtitle && <span className="ml-2 text-[10px] text-slate-400">{subtitle}</span>}
        </div>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function PillChips({ label, value, options, onChange, required }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; required?: boolean;
}) {
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
                ? "border-blue-500 bg-blue-500 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"
            )}>{opt}</button>
        ))}
      </div>
    </div>
  );
}

const EMPTY = {
  consultantId: "", consultantName: "", technology: "", jobDescription: "",
  payRate: "", vendorCompany: "", vendorRecruiterName: "",
  vendorRecruiterEmail: "", vendorRecruiterPhone: "",
  implementationName: "", implementationEmail: "", implementationPhone: "",
  clientName: "", clientLocation: "", status: "Submission Submitted",
};

function buildInitialForm(existingSubmission?: ExistingSubmission) {
  if (!existingSubmission) return EMPTY;
  return {
    consultantId: existingSubmission.consultant.id,
    consultantName: `${existingSubmission.consultant.firstName} ${existingSubmission.consultant.lastName}`,
    technology: existingSubmission.technology ?? existingSubmission.consultant.technology ?? "",
    jobDescription: existingSubmission.jobDescription ?? "",
    payRate: existingSubmission.payRate ?? "",
    vendorCompany: existingSubmission.vendorCompany ?? "",
    vendorRecruiterName: existingSubmission.vendorRecruiterName ?? "",
    vendorRecruiterEmail: existingSubmission.vendorRecruiterEmail ?? "",
    vendorRecruiterPhone: existingSubmission.vendorRecruiterPhone ?? "",
    implementationName: existingSubmission.implementationName ?? "",
    implementationEmail: existingSubmission.implementationEmail ?? "",
    implementationPhone: existingSubmission.implementationPhone ?? "",
    clientName: existingSubmission.clientName ?? "",
    clientLocation: existingSubmission.clientLocation ?? "",
    status: existingSubmission.status ?? "Submission Submitted",
  };
}

export function SubmissionForm({ recruiterId: _recruiterId, recruiterName, nextSubmissionId, existingSubmission, onCancel, onSuccess }: Props) {
  const [form, setForm] = useState(() => buildInitialForm(existingSubmission));
  const [errors, setErrors] = useState<Partial<Record<keyof typeof EMPTY, string>>>({});
  const [isPending, startTransition] = useTransition();
  const { toast, show, hide } = useToast();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(() =>
    existingSubmission ? `${existingSubmission.consultant.firstName} ${existingSubmission.consultant.lastName}` : ""
  );
  const [searchResults, setSearchResults] = useState<Consultant[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedConsultant, setSelectedConsultant] = useState<Consultant | null>(existingSubmission?.consultant ?? null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEdit = !!existingSubmission;
  void _recruiterId;

  const searchConsultants = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); setShowDropdown(false); return; }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/students/search?q=${encodeURIComponent(q)}`);
      setSearchResults(await res.json());
      setShowDropdown(true);
    } catch { setSearchResults([]); }
    finally { setIsSearching(false); }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchConsultants(searchQuery), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, searchConsultants]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectConsultant = (c: Consultant) => {
    setSelectedConsultant(c);
    setForm((prev) => ({ ...prev, consultantId: c.id, consultantName: `${c.firstName} ${c.lastName}`, technology: c.technology ?? prev.technology }));
    setSearchQuery(`${c.firstName} ${c.lastName}`);
    setShowDropdown(false);
  };

  const clearConsultant = () => {
    setSelectedConsultant(null);
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
        const payload = {
          consultantId: form.consultantId,
          technology: form.technology,
          jobDescription: form.jobDescription.trim() || null,
          payRate: form.payRate.trim() || null,
          vendorCompany: form.vendorCompany.trim(),
          vendorRecruiterName: form.vendorRecruiterName.trim(),
          vendorRecruiterEmail: form.vendorRecruiterEmail.trim(),
          vendorRecruiterPhone: form.vendorRecruiterPhone.trim(),
          implementationName: form.implementationName.trim() || null,
          implementationEmail: form.implementationEmail.trim() || null,
          implementationPhone: form.implementationPhone.trim() || null,
          clientName: form.clientName.trim() || null,
          clientLocation: form.clientLocation.trim() || null,
          status: form.status,
        };
        const res = await fetch(isEdit ? `/api/submissions/${existingSubmission.id}` : "/api/submissions", {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Failed to ${isEdit ? "update" : "create"} submission`);
        show(`Submission ${data.submissionId} ${isEdit ? "updated" : "created"} successfully`, "success");
        onSuccess?.();
        if (!isEdit) {
          setForm(EMPTY);
          setSearchQuery("");
          setSelectedConsultant(null);
        }
        router.refresh();
      } catch (err: unknown) {
        show(err instanceof Error ? err.message : `Error ${isEdit ? "updating" : "creating"} submission`, "error");
      }
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Gradient header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-3">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute -left-4 bottom-0 h-16 w-16 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm shadow-inner">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-white">{isEdit ? "Edit Submission" : "New Submission"}</h2>
            <p className="text-sm text-white/70">{isEdit ? "Update submission details and save changes" : "Create a job submission for a consultant"}</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="rounded-xl bg-white/15 px-3 py-1.5 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/60">Sub ID</p>
              <p className="text-xs font-bold text-white font-mono">{existingSubmission?.submissionId ?? nextSubmissionId}</p>
            </div>
            <div className="rounded-xl bg-white/15 px-3 py-1.5 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/60">Recruiter</p>
              <p className="text-xs font-semibold text-white">{recruiterName}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">

        {/* Consultant */}
        <SectionCard icon={Users} title="Consultant" color="blue">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div ref={searchRef}>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Consultant Name *
              </label>
              {selectedConsultant ? (
                <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                    {initials(`${selectedConsultant.firstName} ${selectedConsultant.lastName}`)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{selectedConsultant.firstName} {selectedConsultant.lastName}</p>
                    <p className="text-xs text-slate-500 truncate">{selectedConsultant.email}</p>
                  </div>
                  {!isEdit && (
                    <button type="button" onClick={clearConsultant}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-400 hover:text-slate-600 shadow-sm">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="Search by name…" value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); if (form.consultantId) clearConsultant(); }}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20" />
                  {isSearching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
                  {showDropdown && searchResults.length > 0 && (
                    <ul className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                      {searchResults.map((c) => (
                        <li key={c.id}>
                          <button type="button" onMouseDown={(e) => { e.preventDefault(); selectConsultant(c); }}
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-blue-50 transition-colors">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                              {initials(`${c.firstName} ${c.lastName}`)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900">{c.firstName} {c.lastName}</p>
                              <p className="text-xs text-slate-500 truncate">{c.email}{c.technology ? ` · ${c.technology}` : ""}</p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {showDropdown && !isSearching && searchResults.length === 0 && searchQuery && (
                    <div className="absolute z-30 mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-4 text-center text-sm text-slate-400 shadow-xl">
                      No consultants found
                    </div>
                  )}
                </div>
              )}
              {errors.consultantId && <p className="mt-1 text-xs text-rose-500">{errors.consultantId}</p>}
            </div>
            <div>
              <PillChips label="Technology *" value={form.technology} options={TECHNOLOGIES}
                onChange={(v) => setForm((p) => ({ ...p, technology: p.technology === v ? "" : v }))} required />
              {errors.technology && <p className="mt-1 text-xs text-rose-500">{errors.technology}</p>}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Job Description</label>
            <textarea rows={4} placeholder="Paste the job description here…" value={form.jobDescription}
              onChange={set("jobDescription")}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 resize-y" />
          </div>
        </SectionCard>

        {/* Vendor Details */}
        <SectionCard icon={Building2} title="Vendor Details" color="violet">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Input compact id="payRate" label="Pay Rate" placeholder="e.g. $65/hr" value={form.payRate} onChange={set("payRate")} />
            <Input compact id="vendorCompany" label="Vendor Company *" placeholder="Company name" value={form.vendorCompany} onChange={set("vendorCompany")} error={errors.vendorCompany} />
            <Input compact id="vendorRecruiterName" label="Vendor Recruiter Name *" placeholder="Full name" value={form.vendorRecruiterName} onChange={set("vendorRecruiterName")} error={errors.vendorRecruiterName} />
            <Input compact id="vendorRecruiterEmail" label="Vendor Recruiter Email *" type="email" placeholder="recruiter@vendor.com" value={form.vendorRecruiterEmail} onChange={set("vendorRecruiterEmail")} error={errors.vendorRecruiterEmail} />
            <Input compact id="vendorRecruiterPhone" label="Vendor Recruiter Phone *" placeholder="+1 555-000-0000" value={form.vendorRecruiterPhone} onChange={set("vendorRecruiterPhone")} error={errors.vendorRecruiterPhone} />
          </div>
        </SectionCard>

        {/* Implementation */}
        <SectionCard icon={Hash} title="Implementation" subtitle="Optional" color="amber">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Input compact id="implementationName" label="Implementation Name" placeholder="Contact name" value={form.implementationName} onChange={set("implementationName")} />
            <Input compact id="implementationEmail" label="Implementation Email" type="email" placeholder="impl@company.com" value={form.implementationEmail} onChange={set("implementationEmail")} error={errors.implementationEmail} />
            <Input compact id="implementationPhone" label="Implementation Phone" type="tel" placeholder="555-000-0000" value={form.implementationPhone} onChange={set("implementationPhone")} error={errors.implementationPhone} />
          </div>
        </SectionCard>

        {/* Client & Status */}
        <SectionCard icon={Globe} title="Client & Status" color="emerald">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input compact id="clientName" label="Client Name" placeholder="End client name" value={form.clientName} onChange={set("clientName")} />
            <Input compact id="clientLocation" label="Client Location" placeholder="City, State" value={form.clientLocation} onChange={set("clientLocation")} />
          </div>
          <PillChips label="Submission Status *" value={form.status} options={STATUSES}
            onChange={(v) => setForm((p) => ({ ...p, status: p.status === v ? "Submission Submitted" : v }))} />
        </SectionCard>

        <div className="flex justify-end gap-2 pt-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
              Cancel
            </Button>
          )}
          <Button onClick={submit} disabled={isPending} className="px-8">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {isPending ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save Changes" : "Create Submission"}
          </Button>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  );
}
