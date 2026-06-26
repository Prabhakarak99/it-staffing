"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { GraduationCap, Loader2, Upload, CheckCircle2, ExternalLink } from "lucide-react";
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

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1">
    {children}
  </p>
);

function FileUpload({ label, id, state, onChange }: {
  label: string; id: string; state: FileState; onChange: (f: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div
        className={`flex items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 cursor-pointer transition-colors ${
          state.file ? "border-green-400 bg-green-50" : "border-slate-300 hover:border-blue-400 bg-slate-50"
        }`}
        onClick={() => ref.current?.click()}
      >
        {state.file ? (
          <><CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" /><span className="text-sm text-green-700 truncate">{state.file.name}</span></>
        ) : (
          <><Upload className="h-5 w-5 text-slate-400 shrink-0" /><span className="text-sm text-slate-500">Click to upload {label}</span></>
        )}
      </div>
      <input ref={ref} id={id} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
    </div>
  );
}

export function ConsultantForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { toast, show, hide } = useToast();

  // Personal
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [personalPhone, setPersonalPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [referredBy, setReferredBy] = useState("");

  // Address
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");

  // University
  const [universityName, setUniversityName] = useState("");
  const [universityLocation, setUniversityLocation] = useState("");
  const [masters, setMasters] = useState("");
  const [mastersCompletedDate, setMastersCompletedDate] = useState("");
  const [dsoName, setDsoName] = useState("");
  const [dsoEmail, setDsoEmail] = useState("");
  const [dsoPhone, setDsoPhone] = useState("");

  // Visa
  const [visaStatus, setVisaStatus] = useState("");
  const [visaStartDate, setVisaStartDate] = useState("");
  const [visaExpiryDate, setVisaExpiryDate] = useState("");

  // Onboarding
  const [onboardingStartDate, setOnboardingStartDate] = useState("");
  const [offerLetterType, setOfferLetterType] = useState("");
  const [payRate, setPayRate] = useState("");
  const [hasDL, setHasDL] = useState("");
  const [hasSSN, setHasSSN] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [technology, setTechnology] = useState("");

  // Documents
  const [dlDoc, setDlDoc] = useState<FileState>(emptyFile());
  const [passportDoc, setPassportDoc] = useState<FileState>(emptyFile());
  const [visaCopyDoc, setVisaCopyDoc] = useState<FileState>(emptyFile());

  // Job Card
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

  // Interview search
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
    // Optional phones
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
    // Optional emails
    const dsoEmailErr = validateOptionalEmail(dsoEmail);
    if (dsoEmailErr) errs.dsoEmail = dsoEmailErr;
    const pmEmailErr = validateOptionalEmail(pmEmail);
    if (pmEmailErr) errs.pmEmail = pmEmailErr;
    // Date order: visa start < expiry
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
        fd.append("firstName", firstName);
        fd.append("lastName", lastName);
        fd.append("email", email);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-indigo-600" />
          Add Consultant
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">

        {/* ── Personal Info ── */}
        <div>
          <SectionLabel>Personal Information</SectionLabel>
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
        </div>

        {/* ── Address ── */}
        <div>
          <SectionLabel>Address</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input id="c-addr1" label="Address Line 1" placeholder="123 Main St" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className="sm:col-span-2 lg:col-span-2" />
            <Input id="c-addr2" label="Address Line 2" placeholder="Apt 4B" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
            <Input id="c-city" label="City" placeholder="Chicago" value={city} onChange={(e) => setCity(e.target.value)} />
            <Input id="c-state" label="State" placeholder="IL" value={state} onChange={(e) => setState(e.target.value)} />
            <Input id="c-zip" label="Zip Code" placeholder="60601" value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
          </div>
        </div>

        {/* ── University ── */}
        <div>
          <SectionLabel>University</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input id="c-uniName" label="University Name" placeholder="University of Illinois" value={universityName} onChange={(e) => setUniversityName(e.target.value)} />
            <Input id="c-uniLoc" label="University Location" placeholder="Champaign, IL" value={universityLocation} onChange={(e) => setUniversityLocation(e.target.value)} />
            <Input id="c-masters" label="Masters Degree" placeholder="M.S. Computer Science" value={masters} onChange={(e) => setMasters(e.target.value)} />
            <Input id="c-mastersDate" label="Masters Completed (MM/YYYY)" placeholder="05/2024" value={mastersCompletedDate} onChange={(e) => setMastersCompletedDate(e.target.value)} />
            <Input id="c-dsoName" label="DSO Name" placeholder="DSO full name" value={dsoName} onChange={(e) => setDsoName(e.target.value)} />
            <Input id="c-dsoEmail" label="DSO Email" type="email" placeholder="dso@university.edu" value={dsoEmail} onChange={(e) => setDsoEmail(e.target.value)} error={errors.dsoEmail} />
            <Input id="c-dsoPhone" label="DSO Phone" type="tel" placeholder="555-000-0000" value={dsoPhone} onChange={(e) => setDsoPhone(e.target.value)} error={errors.dsoPhone} />
          </div>
        </div>

        {/* ── Visa ── */}
        <div>
          <SectionLabel>Visa Information</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Select
              id="c-visaStatus" label="Visa Status"
              options={VISA_STATUSES.map((v) => ({ value: v, label: v }))}
              placeholder="Select visa status" value={visaStatus}
              onChange={(e) => setVisaStatus(e.target.value)}
            />
            <Input id="c-visaStart" label="Visa Start Date" type="date" value={visaStartDate} onChange={(e) => setVisaStartDate(e.target.value)} />
            <Input id="c-visaExpiry" label="Visa Expiry Date" type="date" value={visaExpiryDate} onChange={(e) => setVisaExpiryDate(e.target.value)} error={errors.visaExpiryDate} />
          </div>
        </div>

        {/* ── Onboarding ── */}
        <div>
          <SectionLabel>Onboarding</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input id="c-obStart" label="Onboarding Start Date" type="date" value={onboardingStartDate} onChange={(e) => setOnboardingStartDate(e.target.value)} />
            <Select
              id="c-offerLetter" label="Offer Letter Type"
              options={OFFER_LETTER_TYPES.map((o) => ({ value: o, label: o }))}
              placeholder="Select offer letter type" value={offerLetterType}
              onChange={(e) => setOfferLetterType(e.target.value)}
            />
            <Input
              id="c-payRate" label="Pay Rate (USD/hr)" placeholder="$25"
              value={payRate} onChange={(e) => setPayRate(e.target.value)}
              disabled={offerLetterType !== "Paid-Stem"}
            />
            <Select
              id="c-hasDL" label="Has Driver License?"
              options={[{ value: "Yes", label: "Yes" }, { value: "No", label: "No" }]}
              placeholder="Select" value={hasDL}
              onChange={(e) => setHasDL(e.target.value)}
            />
            <Select
              id="c-hasSSN" label="Has SSN?"
              options={[{ value: "Yes", label: "Yes" }, { value: "No", label: "No" }]}
              placeholder="Select" value={hasSSN}
              onChange={(e) => setHasSSN(e.target.value)}
            />
            <Input id="c-passport" label="Passport Number" placeholder="AB1234567" value={passportNumber} onChange={(e) => setPassportNumber(e.target.value)} />
            <Select
              id="c-tech" label="Technology"
              options={TECHNOLOGIES.map((t) => ({ value: t, label: t }))}
              placeholder="Select technology" value={technology}
              onChange={(e) => setTechnology(e.target.value)}
            />
          </div>
        </div>

        {/* ── Document Uploads ── */}
        <div>
          <SectionLabel>Documents</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FileUpload label="Driver License" id="doc-dl" state={dlDoc} onChange={(f) => setDlDoc({ file: f, uploaded: false })} />
            <FileUpload label="Passport" id="doc-passport" state={passportDoc} onChange={(f) => setPassportDoc({ file: f, uploaded: false })} />
            <FileUpload label="Visa Copy" id="doc-visa" state={visaCopyDoc} onChange={(f) => setVisaCopyDoc({ file: f, uploaded: false })} />
          </div>
        </div>

        {/* ── Job Card ── */}
        <div>
          <SectionLabel>Job Card</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Select
              id="c-projStatus" label="Project Status"
              options={PROJECT_STATUSES.map((s) => ({ value: s, label: s }))}
              placeholder="Select project status" value={projectStatus}
              onChange={(e) => { setProjectStatus(e.target.value); setSelectedInterview(null); setInterviewQuery(""); }}
            />
            <Input id="c-jobTitle" label="Job Title" placeholder="Software Engineer" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            <Input id="c-verbalDate" label="Verbal Confirmation Date" type="date" value={verbalConfirmationDate} onChange={(e) => setVerbalConfirmationDate(e.target.value)} />

            {showInterviewSearch && (
              <div className="relative flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
                <label className="text-sm font-medium text-slate-700">Interview ID</label>
                {selectedInterview ? (
                  <div className="flex items-center gap-2 rounded-lg border border-green-400 bg-green-50 px-3 py-2">
                    <a
                      href="/admin/interviews"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {selectedInterview.interviewId}
                    </a>
                    <span className="text-xs text-slate-500 ml-1">({selectedInterview.interviewStatus})</span>
                    <button
                      type="button"
                      onClick={() => { setSelectedInterview(null); setInterviewQuery(""); }}
                      className="ml-auto text-xs text-rose-500 hover:text-rose-600"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Type 3+ chars (e.g. I-00)"
                      value={interviewQuery}
                      onChange={(e) => { setInterviewQuery(e.target.value); setShowInterviewDropdown(true); }}
                      onFocus={() => setShowInterviewDropdown(true)}
                      className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    {showInterviewDropdown && interviewResults.length > 0 && (
                      <div className="absolute top-full z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
                        {interviewResults.map((hit) => (
                          <button
                            key={hit.id}
                            type="button"
                            className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-blue-50"
                            onClick={() => { setSelectedInterview(hit); setInterviewQuery(hit.interviewId); setShowInterviewDropdown(false); }}
                          >
                            <span className="font-medium text-slate-900">{hit.interviewId}</span>
                            <span className="text-xs text-slate-500">({hit.interviewStatus})</span>
                            <span className="ml-auto text-xs text-slate-400">{hit.submission.submissionId}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {interviewQuery.length >= 3 && interviewResults.length === 0 && (
                      <p className="text-xs text-slate-400 mt-1">No matching interviews found</p>
                    )}
                  </>
                )}
              </div>
            )}

            <Input id="c-projStart" label="Project Start Date" type="date" value={projectStartDate} onChange={(e) => setProjectStartDate(e.target.value)} />
            <Input id="c-billRate" label="Bill Rate (USD/hr)" placeholder="$85" value={billRate} onChange={(e) => setBillRate(e.target.value)} />
            <Select
              id="c-payroll" label="Payroll Split"
              options={PAYROLLS.map((p) => ({ value: p, label: p }))}
              placeholder="Select split" value={payroll}
              onChange={(e) => setPayroll(e.target.value)}
            />
            <Select
              id="c-workMode" label="Work Mode"
              options={WORK_MODES.map((w) => ({ value: w, label: w }))}
              placeholder="Select work mode" value={workMode}
              onChange={(e) => setWorkMode(e.target.value)}
            />
          </div>

          <div className="mt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Project Manager</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input id="c-pmName" label="PM Name" placeholder="Jane Smith" value={pmName} onChange={(e) => setPmName(e.target.value)} />
              <Input id="c-pmEmail" label="PM Email" type="email" placeholder="pm@company.com" value={pmEmail} onChange={(e) => setPmEmail(e.target.value)} error={errors.pmEmail} />
              <Input id="c-pmPhone" label="PM Phone" type="tel" placeholder="555-000-0000" value={pmPhone} onChange={(e) => setPmPhone(e.target.value)} error={errors.pmPhone} />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={submit} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />}
            {isPending ? "Saving…" : "Save Consultant"}
          </Button>
        </div>
      </CardContent>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </Card>
  );
}
