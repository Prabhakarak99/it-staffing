"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  GraduationCap, Loader2, Upload, CheckCircle2, ExternalLink,
  User, MapPin, BookOpen, CreditCard, Briefcase, FolderKanban, FileCheck,
} from "lucide-react";
import { isValidEmail, validateOptionalEmail, validateOptionalPhone, validateOptionalUrl } from "@/lib/validators";

const VISA_STATUSES = ["F1", "Initial OPT", "Stem OPT", "CPT", "H1B", "H4Ead", "GC", "TN", "U", "Citizen"];
const OFFER_LETTER_TYPES = ["Unpaid-Intern", "Paid-Stem"];
const PROJECT_STATUSES = ["In Market", "Verbal Confirmation", "Confirmation", "Project Started", "Project Completed"];
const PAYROLLS = ["70/30", "80/20"];
const WORK_MODES = ["Remote", "Hybrid", "Onsite"];
const TECHNOLOGIES = [".Net", "Java", "DE", "DS/GenAi/ML", "Devops", "Mainframes", "Networking", "BA", "Sales Force"];

type InterviewHit = {
  id: string;
  interviewId: string;
  interviewStatus: string;
  interviewStartDate: string;
  submission: { submissionId: string };
};

type FileState = { file: File | null; uploaded: boolean };
const emptyFile = (): FileState => ({ file: null, uploaded: false });

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function SectionCard({ icon: Icon, title, color, children }: {
  icon: React.ElementType; title: string; color: string; children: React.ReactNode;
}) {
  const colorMap: Record<string, { bg: string; border: string; icon: string; text: string }> = {
    violet: { bg: "bg-violet-50", border: "border-violet-100", icon: "text-violet-500", text: "text-slate-600" },
    blue: { bg: "bg-blue-50", border: "border-blue-100", icon: "text-blue-500", text: "text-slate-600" },
    emerald: { bg: "bg-emerald-50", border: "border-emerald-100", icon: "text-emerald-500", text: "text-slate-600" },
    amber: { bg: "bg-amber-50", border: "border-amber-100", icon: "text-amber-500", text: "text-slate-600" },
    rose: { bg: "bg-rose-50", border: "border-rose-100", icon: "text-rose-500", text: "text-slate-600" },
    indigo: { bg: "bg-indigo-50", border: "border-indigo-100", icon: "text-indigo-500", text: "text-slate-600" },
    slate: { bg: "bg-slate-50", border: "border-slate-200", icon: "text-slate-500", text: "text-slate-600" },
  };
  const c = colorMap[color] ?? colorMap.slate;
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={cn("flex items-center gap-2.5 rounded-t-xl border-b px-4 py-3", c.bg, c.border)}>
        <Icon className={cn("h-4 w-4 shrink-0", c.icon)} />
        <span className="text-xs font-bold uppercase tracking-widest text-slate-600">{title}</span>
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
          <button
            key={opt}
            type="button"
            onClick={() => onChange(value === opt ? "" : opt)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition-all",
              value === opt
                ? "border-indigo-500 bg-indigo-500 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50"
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function YesNoToggle({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="flex rounded-full border border-slate-200 bg-white p-0.5 gap-0.5">
        {["Yes", "No"].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(value === v ? "" : v)}
            className={cn(
              "rounded-full px-3.5 py-0.5 text-xs font-bold transition-all",
              value === v && v === "Yes" ? "bg-emerald-500 text-white shadow-sm" :
              value === v && v === "No" ? "bg-rose-500 text-white shadow-sm" :
              "text-slate-400 hover:text-slate-600"
            )}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

function FileUploadCard({ label, id, state, onChange }: {
  label: string; id: string; state: FileState; onChange: (f: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-4 transition-all",
        state.file
          ? "border-emerald-400 bg-emerald-50"
          : "border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40"
      )}
      onClick={() => ref.current?.click()}
    >
      {state.file ? (
        <>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-emerald-700">{label}</p>
            <p className="truncate text-xs text-emerald-600">{state.file.name}</p>
          </div>
        </>
      ) : (
        <>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-200">
            <Upload className="h-4 w-4 text-slate-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-600">{label}</p>
            <p className="text-xs text-slate-400">Click to upload PDF or image</p>
          </div>
        </>
      )}
      <input ref={ref} id={id} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
    </div>
  );
}

export function ConsultantForm({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { toast, show, hide } = useToast();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [personalPhone, setPersonalPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [referredBy, setReferredBy] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [universityName, setUniversityName] = useState("");
  const [universityLocation, setUniversityLocation] = useState("");
  const [masters, setMasters] = useState("");
  const [mastersCompletedDate, setMastersCompletedDate] = useState("");
  const [dsoName, setDsoName] = useState("");
  const [dsoEmail, setDsoEmail] = useState("");
  const [dsoPhone, setDsoPhone] = useState("");
  const [visaStatus, setVisaStatus] = useState("");
  const [visaStartDate, setVisaStartDate] = useState("");
  const [visaExpiryDate, setVisaExpiryDate] = useState("");
  const [onboardingStartDate, setOnboardingStartDate] = useState("");
  const [offerLetterType, setOfferLetterType] = useState("");
  const [payRate, setPayRate] = useState("");
  const [hasDL, setHasDL] = useState("");
  const [hasSSN, setHasSSN] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [technology, setTechnology] = useState("");
  const [dlDoc, setDlDoc] = useState<FileState>(emptyFile());
  const [passportDoc, setPassportDoc] = useState<FileState>(emptyFile());
  const [visaCopyDoc, setVisaCopyDoc] = useState<FileState>(emptyFile());
  const [projectStatus, setProjectStatus] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [verbalConfirmationDate, setVerbalConfirmationDate] = useState("");
  const [projectStartDate, setProjectStartDate] = useState("");
  const [billRate, setBillRate] = useState("");
  const [payroll, setPayroll] = useState("");
  const [workMode, setWorkMode] = useState("");
  const [pmName, setPmName] = useState("");
  const [pmEmail, setPmEmail] = useState("");
  const [pmPhone, setPmPhone] = useState("");
  const [interviewQuery, setInterviewQuery] = useState("");
  const [interviewResults, setInterviewResults] = useState<InterviewHit[]>([]);
  const [selectedInterview, setSelectedInterview] = useState<InterviewHit | null>(null);
  const [showInterviewDropdown, setShowInterviewDropdown] = useState(false);
  const interviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showInterviewSearch = projectStatus === "Verbal Confirmation" || projectStatus === "Confirmation";

  const searchInterviews = useCallback(async (q: string) => {
    if (q.length < 3) { setInterviewResults([]); return; }
    const res = await fetch(`/api/interviews/search?q=${encodeURIComponent(q)}`);
    if (res.ok) setInterviewResults(await res.json());
  }, []);

  useEffect(() => {
    if (interviewTimer.current) clearTimeout(interviewTimer.current);
    interviewTimer.current = setTimeout(() => searchInterviews(interviewQuery), 300);
  }, [interviewQuery, searchInterviews]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = "Required";
    if (!lastName.trim()) errs.lastName = "Required";
    if (!email.trim()) errs.email = "Required";
    else if (!isValidEmail(email)) errs.email = "Invalid email address";
    const pPhone = validateOptionalPhone(personalPhone);
    if (pPhone) errs.personalPhone = pPhone;
    const parPhone = validateOptionalPhone(parentPhone);
    if (parPhone) errs.parentPhone = parPhone;
    const emPhone = validateOptionalPhone(emergencyContact);
    if (emPhone) errs.emergencyContact = emPhone;
    const dsoPhoneErr = validateOptionalPhone(dsoPhone);
    if (dsoPhoneErr) errs.dsoPhone = dsoPhoneErr;
    const pmPhoneErr = validateOptionalPhone(pmPhone);
    if (pmPhoneErr) errs.pmPhone = pmPhoneErr;
    const dsoEmailErr = validateOptionalEmail(dsoEmail);
    if (dsoEmailErr) errs.dsoEmail = dsoEmailErr;
    const pmEmailErr = validateOptionalEmail(pmEmail);
    if (pmEmailErr) errs.pmEmail = pmEmailErr;
    if (visaStartDate && visaExpiryDate && new Date(visaExpiryDate) <= new Date(visaStartDate))
      errs.visaExpiryDate = "Expiry must be after start date";
    return errs;
  };

  const submit = () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append("firstName", firstName); fd.append("lastName", lastName); fd.append("email", email);
        if (personalPhone) fd.append("personalPhone", personalPhone);
        if (dob) fd.append("dob", dob);
        if (parentPhone) fd.append("parentPhone", parentPhone);
        if (emergencyContact) fd.append("emergencyContact", emergencyContact);
        if (referredBy) fd.append("referredBy", referredBy);
        if (addressLine1) fd.append("addressLine1", addressLine1);
        if (addressLine2) fd.append("addressLine2", addressLine2);
        if (city) fd.append("city", city);
        if (state) fd.append("state", state);
        if (zipCode) fd.append("zipCode", zipCode);
        if (universityName) fd.append("universityName", universityName);
        if (universityLocation) fd.append("universityLocation", universityLocation);
        if (masters) fd.append("masters", masters);
        if (mastersCompletedDate) fd.append("mastersCompletedDate", mastersCompletedDate);
        if (dsoName) fd.append("dsoName", dsoName);
        if (dsoEmail) fd.append("dsoEmail", dsoEmail);
        if (dsoPhone) fd.append("dsoPhone", dsoPhone);
        if (visaStatus) fd.append("visaStatus", visaStatus);
        if (visaStartDate) fd.append("visaStartDate", visaStartDate);
        if (visaExpiryDate) fd.append("visaExpiryDate", visaExpiryDate);
        if (onboardingStartDate) fd.append("onboardingStartDate", onboardingStartDate);
        if (offerLetterType) fd.append("offerLetterType", offerLetterType);
        if (payRate && offerLetterType === "Paid-Stem") fd.append("payRate", payRate);
        if (hasDL) fd.append("hasDL", hasDL);
        if (hasSSN) fd.append("hasSSN", hasSSN);
        if (passportNumber) fd.append("passportNumber", passportNumber);
        if (technology) fd.append("technology", technology);
        if (dlDoc.file) fd.append("dlDocument", dlDoc.file);
        if (passportDoc.file) fd.append("passportDocument", passportDoc.file);
        if (visaCopyDoc.file) fd.append("visaCopyDocument", visaCopyDoc.file);
        if (projectStatus) fd.append("projectStatus", projectStatus);
        if (jobTitle) fd.append("jobTitle", jobTitle);
        if (verbalConfirmationDate) fd.append("verbalConfirmationDate", verbalConfirmationDate);
        if (selectedInterview) fd.append("linkedInterviewId", selectedInterview.id);
        if (projectStartDate) fd.append("projectStartDate", projectStartDate);
        if (billRate) fd.append("billRate", billRate);
        if (payroll) fd.append("payroll", payroll);
        if (workMode) fd.append("workMode", workMode);
        if (pmName) fd.append("pmName", pmName);
        if (pmEmail) fd.append("pmEmail", pmEmail);
        if (pmPhone) fd.append("pmPhone", pmPhone);
        const res = await fetch("/api/students", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to save consultant");
        show(`${firstName} ${lastName} added successfully`, "success");
        onSuccess?.();
        router.refresh();
        setFirstName(""); setLastName(""); setEmail(""); setPersonalPhone(""); setDob("");
        setParentPhone(""); setEmergencyContact(""); setReferredBy("");
        setAddressLine1(""); setAddressLine2(""); setCity(""); setState(""); setZipCode("");
        setUniversityName(""); setUniversityLocation(""); setMasters(""); setMastersCompletedDate("");
        setDsoName(""); setDsoEmail(""); setDsoPhone("");
        setVisaStatus(""); setVisaStartDate(""); setVisaExpiryDate("");
        setOnboardingStartDate(""); setOfferLetterType(""); setPayRate(""); setHasDL(""); setHasSSN(""); setPassportNumber(""); setTechnology("");
        setDlDoc(emptyFile()); setPassportDoc(emptyFile()); setVisaCopyDoc(emptyFile());
        setProjectStatus(""); setJobTitle(""); setVerbalConfirmationDate(""); setProjectStartDate("");
        setBillRate(""); setPayroll(""); setWorkMode(""); setPmName(""); setPmEmail(""); setPmPhone("");
        setSelectedInterview(null); setInterviewQuery("");
      } catch (err: unknown) {
        show(err instanceof Error ? err.message : "Error saving consultant", "error");
      }
    });
  };

  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Gradient header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 to-purple-700 px-6 py-5">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute -left-4 bottom-0 h-16 w-16 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm shadow-inner">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Add Consultant</h2>
            <p className="text-sm text-white/70">Onboard a new consultant with full profile</p>
          </div>
          {fullName && (
            <div className="ml-auto flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[9px] font-bold text-white">
                {initials(fullName)}
              </div>
              <span className="text-xs font-semibold text-white">{fullName}</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 space-y-5">

        {/* Personal Information */}
        <SectionCard icon={User} title="Personal Information" color="violet">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input id="c-firstName" label="First Name *" placeholder="John" value={firstName} onChange={(e) => setFirstName(e.target.value)} error={errors.firstName} />
            <Input id="c-lastName" label="Last Name *" placeholder="Doe" value={lastName} onChange={(e) => setLastName(e.target.value)} error={errors.lastName} />
            <Input id="c-email" label="Personal Email *" type="email" placeholder="john@example.com" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
            <Input id="c-personalPhone" label="Personal Phone" type="tel" placeholder="555-000-0000" value={personalPhone} onChange={(e) => setPersonalPhone(e.target.value)} error={errors.personalPhone} />
            <Input id="c-dob" label="Date of Birth" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            <Input id="c-parentPhone" label="Parent Phone" type="tel" placeholder="555-000-0000" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} error={errors.parentPhone} />
            <Input id="c-emergency" label="Emergency Contact" type="tel" placeholder="555-000-0000" value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} error={errors.emergencyContact} />
            <Input id="c-referredBy" label="Referred By" placeholder="Name or company" value={referredBy} onChange={(e) => setReferredBy(e.target.value)} />
          </div>
        </SectionCard>

        {/* Address */}
        <SectionCard icon={MapPin} title="Address" color="blue">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2">
              <Input id="c-addr1" label="Address Line 1" placeholder="123 Main St" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
            </div>
            <Input id="c-addr2" label="Address Line 2" placeholder="Apt 4B" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
            <Input id="c-city" label="City" placeholder="Chicago" value={city} onChange={(e) => setCity(e.target.value)} />
            <Input id="c-state" label="State" placeholder="IL" value={state} onChange={(e) => setState(e.target.value)} />
            <Input id="c-zip" label="Zip Code" placeholder="60601" value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
          </div>
        </SectionCard>

        {/* University */}
        <SectionCard icon={BookOpen} title="University" color="indigo">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input id="c-uniName" label="University Name" placeholder="University of Illinois" value={universityName} onChange={(e) => setUniversityName(e.target.value)} />
            <Input id="c-uniLoc" label="University Location" placeholder="Champaign, IL" value={universityLocation} onChange={(e) => setUniversityLocation(e.target.value)} />
            <Input id="c-masters" label="Masters Degree" placeholder="M.S. Computer Science" value={masters} onChange={(e) => setMasters(e.target.value)} />
            <Input id="c-mastersDate" label="Masters Completed (MM/YYYY)" placeholder="05/2024" value={mastersCompletedDate} onChange={(e) => setMastersCompletedDate(e.target.value)} />
            <Input id="c-dsoName" label="DSO Name" placeholder="DSO full name" value={dsoName} onChange={(e) => setDsoName(e.target.value)} />
            <Input id="c-dsoEmail" label="DSO Email" type="email" placeholder="dso@university.edu" value={dsoEmail} onChange={(e) => setDsoEmail(e.target.value)} error={errors.dsoEmail} />
            <Input id="c-dsoPhone" label="DSO Phone" type="tel" placeholder="555-000-0000" value={dsoPhone} onChange={(e) => setDsoPhone(e.target.value)} error={errors.dsoPhone} />
          </div>
        </SectionCard>

        {/* Visa */}
        <SectionCard icon={CreditCard} title="Visa Information" color="amber">
          <div className="space-y-4">
            <PillChips label="Visa Status" value={visaStatus} options={VISA_STATUSES} onChange={setVisaStatus} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input id="c-visaStart" label="Visa Start Date" type="date" value={visaStartDate} onChange={(e) => setVisaStartDate(e.target.value)} />
              <Input id="c-visaExpiry" label="Visa Expiry Date" type="date" value={visaExpiryDate} onChange={(e) => setVisaExpiryDate(e.target.value)} error={errors.visaExpiryDate} />
            </div>
          </div>
        </SectionCard>

        {/* Onboarding */}
        <SectionCard icon={Briefcase} title="Onboarding Details" color="emerald">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input id="c-obStart" label="Onboarding Start Date" type="date" value={onboardingStartDate} onChange={(e) => setOnboardingStartDate(e.target.value)} />
              <Input id="c-passport" label="Passport Number" placeholder="AB1234567" value={passportNumber} onChange={(e) => setPassportNumber(e.target.value)} />
            </div>
            <PillChips label="Offer Letter Type" value={offerLetterType} options={OFFER_LETTER_TYPES} onChange={setOfferLetterType} />
            {offerLetterType === "Paid-Stem" && (
              <div className="max-w-xs">
                <Input id="c-payRate" label="Pay Rate (USD/hr)" placeholder="$25" value={payRate} onChange={(e) => setPayRate(e.target.value)} />
              </div>
            )}
            <PillChips label="Technology" value={technology} options={TECHNOLOGIES} onChange={setTechnology} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <YesNoToggle label="Has Driver License?" value={hasDL} onChange={setHasDL} />
              <YesNoToggle label="Has SSN?" value={hasSSN} onChange={setHasSSN} />
            </div>
          </div>
        </SectionCard>

        {/* Documents */}
        <SectionCard icon={FileCheck} title="Documents" color="slate">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FileUploadCard label="Driver License" id="doc-dl" state={dlDoc} onChange={(f) => setDlDoc({ file: f, uploaded: false })} />
            <FileUploadCard label="Passport" id="doc-passport" state={passportDoc} onChange={(f) => setPassportDoc({ file: f, uploaded: false })} />
            <FileUploadCard label="Visa Copy" id="doc-visa" state={visaCopyDoc} onChange={(f) => setVisaCopyDoc({ file: f, uploaded: false })} />
          </div>
        </SectionCard>

        {/* Job Card */}
        <SectionCard icon={FolderKanban} title="Job Card" color="rose">
          <div className="space-y-4">
            <PillChips label="Project Status" value={projectStatus} options={PROJECT_STATUSES} onChange={(v) => { setProjectStatus(v); setSelectedInterview(null); setInterviewQuery(""); }} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input id="c-jobTitle" label="Job Title" placeholder="Software Engineer" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
              <Input id="c-verbalDate" label="Verbal Confirmation Date" type="date" value={verbalConfirmationDate} onChange={(e) => setVerbalConfirmationDate(e.target.value)} />
              <Input id="c-projStart" label="Project Start Date" type="date" value={projectStartDate} onChange={(e) => setProjectStartDate(e.target.value)} />
            </div>

            {showInterviewSearch && (
              <div className="relative flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Interview ID</label>
                {selectedInterview ? (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <a href="/admin/interviews" target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:underline">
                        <ExternalLink className="h-3.5 w-3.5" />{selectedInterview.interviewId}
                      </a>
                      <p className="text-xs text-slate-500">{selectedInterview.interviewStatus}</p>
                    </div>
                    <button type="button" onClick={() => { setSelectedInterview(null); setInterviewQuery(""); }}
                      className="text-xs font-semibold text-rose-500 hover:text-rose-600">Clear</button>
                  </div>
                ) : (
                  <div className="relative">
                    <input type="text" placeholder="Type 3+ chars (e.g. I-00)" value={interviewQuery}
                      onChange={(e) => { setInterviewQuery(e.target.value); setShowInterviewDropdown(true); }}
                      onFocus={() => setShowInterviewDropdown(true)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20" />
                    {showInterviewDropdown && interviewResults.length > 0 && (
                      <div className="absolute top-full z-30 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-xl">
                        {interviewResults.map((hit) => (
                          <button key={hit.id} type="button"
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-indigo-50 transition-colors"
                            onClick={() => { setSelectedInterview(hit); setInterviewQuery(hit.interviewId); setShowInterviewDropdown(false); }}>
                            <span className="font-semibold text-indigo-700 text-sm">{hit.interviewId}</span>
                            <span className="text-xs text-slate-500">({hit.interviewStatus})</span>
                            <span className="ml-auto text-xs text-slate-400">{hit.submission.submissionId}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {interviewQuery.length >= 3 && interviewResults.length === 0 && (
                      <p className="mt-1 text-xs text-slate-400">No matching interviews found</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input id="c-billRate" label="Bill Rate (USD/hr)" placeholder="$85" value={billRate} onChange={(e) => setBillRate(e.target.value)} />
            </div>
            <PillChips label="Payroll Split" value={payroll} options={PAYROLLS} onChange={setPayroll} />
            <PillChips label="Work Mode" value={workMode} options={WORK_MODES} onChange={setWorkMode} />

            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Project Manager</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Input id="c-pmName" label="PM Name" placeholder="Jane Smith" value={pmName} onChange={(e) => setPmName(e.target.value)} />
                <Input id="c-pmEmail" label="PM Email" type="email" placeholder="pm@company.com" value={pmEmail} onChange={(e) => setPmEmail(e.target.value)} error={errors.pmEmail} />
                <Input id="c-pmPhone" label="PM Phone" type="tel" placeholder="555-000-0000" value={pmPhone} onChange={(e) => setPmPhone(e.target.value)} error={errors.pmPhone} />
              </div>
            </div>
          </div>
        </SectionCard>

        <div className="flex justify-end pt-2">
          <Button onClick={submit} disabled={isPending} className="px-8">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />}
            {isPending ? "Saving…" : "Save Consultant"}
          </Button>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  );
}
