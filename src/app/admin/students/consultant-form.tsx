"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  GraduationCap, Loader2, Upload, CheckCircle2, Search,
  User, MapPin, BookOpen, CreditCard, Briefcase, FolderKanban, FileCheck, MessageSquare,
} from "lucide-react";
import {
  SlideFormShell, SlideFormHeader, SlideFormBody, SlideFormSections,
  SlideFormSection, SlideFormGrid, SlideFormFooter,
} from "@/components/forms/compact-slide-form";

import { isValidEmail, validateOptionalEmail, validateOptionalPhone } from "@/lib/validators";
import { toDateInputValue } from "@/lib/dates";
import { getConsultantLevelCommentsText } from "@/lib/premarketing-checklist";
import { PROJECT_STATUSES } from "@/lib/project-status";

const VISA_STATUSES = ["F1", "Initial OPT", "Stem OPT", "CPT", "H1B", "H4Ead", "GC", "TN", "U", "Citizen"];
const MARKETING_VISA_STATUSES = ["F1", "Initial OPT", "Stem OPT", "CPT", "H1B", "H4Ead", "GC", "TN", "U", "Citizen"];
const TECHNOLOGIES = [".Net", "Java", "DE", "DS/GenAi/ML", "Devops", "Mainframes", "Networking", "BA", "Sales Force", "SAP", "ServiceNow", "Manufacturing", "Others"];
const OFFER_LETTER_TYPES = ["Unpaid-Intern", "Paid-Stem"];
const PAYROLLS = ["70/30", "80/20"];
const WORK_MODES = ["Remote", "Hybrid", "Onsite"];

type InterviewHit = {
  id: string;
  interviewId: string;
  interviewStatus: string;
  interviewStartDate: string;
  submission: { submissionId: string };
};

type RecruiterHit = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type ConsultantInitialData = {
  firstName?: string | null;
  lastName?: string | null;
  personalPhone?: string | null;
  email?: string | null;
  dob?: string | null;
  parentPhone?: string | null;
  emergencyContact?: string | null;
  referredBy?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  universityName?: string | null;
  universityLocation?: string | null;
  masters?: string | null;
  mastersCompletedDate?: string | null;
  dsoName?: string | null;
  dsoEmail?: string | null;
  dsoPhone?: string | null;
  visaStatus?: string | null;
  marketingVisaStatus?: string | null;
  visaStartDate?: string | null;
  visaExpiryDate?: string | null;
  onboardingStartDate?: string | null;
  offerLetterType?: string | null;
  payRate?: string | null;
  hasDL?: string | null;
  hasSSN?: string | null;
  passportNumber?: string | null;
  technology?: string | null;
  projectStatus?: string | null;
  jobTitle?: string | null;
  verbalConfirmationDate?: string | null;
  projectStartDate?: string | null;
  billRate?: string | null;
  payroll?: string | null;
  workMode?: string | null;
  pmName?: string | null;
  pmEmail?: string | null;
  pmPhone?: string | null;
  driveLocation?: string | null;
  linkedInterviewId?: string | null;
  consultantComment?: string | null;
  comments?: unknown;
  assignedRecruiterId?: string | null;
  assignedRecruiterName?: string | null;
};

type FileState = { file: File | null; uploaded: boolean };
const emptyFile = (): FileState => ({ file: null, uploaded: false });

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function PillChips({ label, value, options, onChange, required }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}{required && " *"}
      </label>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(value === opt ? "" : opt)}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-all",
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
    <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
      <span className="text-xs font-medium text-slate-700">{label}</span>
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
        "flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed px-3 py-2 transition-all",
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

export function ConsultantForm({
  consultantId,
  initialData,
  onSuccess,
  onCancel,
}: {
  consultantId?: string;
  initialData?: ConsultantInitialData;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const isEdit = !!consultantId;
  const hasInitialData = !!initialData;
  const router = useRouter();
  const [loading, setLoading] = useState(!!consultantId && !hasInitialData);
  const [isPending, startTransition] = useTransition();
  const { toast, show, hide } = useToast();

  const [firstName, setFirstName] = useState(initialData?.firstName ?? "");
  const [lastName, setLastName] = useState(initialData?.lastName ?? "");
  const [personalPhone, setPersonalPhone] = useState(initialData?.personalPhone ?? "");
  const [email, setEmail] = useState(initialData?.email ?? "");
  const [dob, setDob] = useState(toDateInputValue(initialData?.dob));
  const [parentPhone, setParentPhone] = useState(initialData?.parentPhone ?? "");
  const [emergencyContact, setEmergencyContact] = useState(initialData?.emergencyContact ?? "");
  const [referredBy, setReferredBy] = useState(initialData?.referredBy ?? "");
  const [addressLine1, setAddressLine1] = useState(initialData?.addressLine1 ?? "");
  const [addressLine2, setAddressLine2] = useState(initialData?.addressLine2 ?? "");
  const [city, setCity] = useState(initialData?.city ?? "");
  const [state, setState] = useState(initialData?.state ?? "");
  const [zipCode, setZipCode] = useState(initialData?.zipCode ?? "");
  const [universityName, setUniversityName] = useState(initialData?.universityName ?? "");
  const [universityLocation, setUniversityLocation] = useState(initialData?.universityLocation ?? "");
  const [masters, setMasters] = useState(initialData?.masters ?? "");
  const [mastersCompletedDate, setMastersCompletedDate] = useState(initialData?.mastersCompletedDate ?? "");
  const [dsoName, setDsoName] = useState(initialData?.dsoName ?? "");
  const [dsoEmail, setDsoEmail] = useState(initialData?.dsoEmail ?? "");
  const [dsoPhone, setDsoPhone] = useState(initialData?.dsoPhone ?? "");
  const [visaStatus, setVisaStatus] = useState(initialData?.visaStatus ?? "");
  const [marketingVisaStatus, setMarketingVisaStatus] = useState(initialData?.marketingVisaStatus ?? "");
  const [visaStartDate, setVisaStartDate] = useState(toDateInputValue(initialData?.visaStartDate));
  const [visaExpiryDate, setVisaExpiryDate] = useState(toDateInputValue(initialData?.visaExpiryDate));
  const [onboardingStartDate, setOnboardingStartDate] = useState(toDateInputValue(initialData?.onboardingStartDate));
  const [offerLetterType, setOfferLetterType] = useState(initialData?.offerLetterType ?? "");
  const [payRate, setPayRate] = useState(initialData?.payRate ?? "");
  const [hasDL, setHasDL] = useState(initialData?.hasDL ?? "");
  const [hasSSN, setHasSSN] = useState(initialData?.hasSSN ?? "");
  const [passportNumber, setPassportNumber] = useState(initialData?.passportNumber ?? "");
  const [technology, setTechnology] = useState(initialData?.technology ?? "");
  const [dlDoc, setDlDoc] = useState<FileState>(emptyFile());
  const [passportDoc, setPassportDoc] = useState<FileState>(emptyFile());
  const [visaCopyDoc, setVisaCopyDoc] = useState<FileState>(emptyFile());
  const [projectStatus, setProjectStatus] = useState(initialData?.projectStatus ?? "");
  const [jobTitle, setJobTitle] = useState(initialData?.jobTitle ?? "");
  const [verbalConfirmationDate, setVerbalConfirmationDate] = useState(toDateInputValue(initialData?.verbalConfirmationDate));
  const [projectStartDate, setProjectStartDate] = useState(toDateInputValue(initialData?.projectStartDate));
  const [billRate, setBillRate] = useState(initialData?.billRate ?? "");
  const [payroll, setPayroll] = useState(initialData?.payroll ?? "");
  const [workMode, setWorkMode] = useState(initialData?.workMode ?? "");
  const [pmName, setPmName] = useState(initialData?.pmName ?? "");
  const [pmEmail, setPmEmail] = useState(initialData?.pmEmail ?? "");
  const [pmPhone, setPmPhone] = useState(initialData?.pmPhone ?? "");
  const [driveLocation, setDriveLocation] = useState(initialData?.driveLocation ?? "");
  const [consultantComment, setConsultantComment] = useState(
    initialData?.consultantComment
      ?? (initialData?.comments ? getConsultantLevelCommentsText(initialData.comments) : "")
  );
  const [interviewQuery, setInterviewQuery] = useState(initialData?.linkedInterviewId ?? "");
  const [interviewResults, setInterviewResults] = useState<InterviewHit[]>([]);
  const [selectedInterview, setSelectedInterview] = useState<InterviewHit | null>(null);
  const [showInterviewDropdown, setShowInterviewDropdown] = useState(false);
  const interviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [assignedRecruiterId, setAssignedRecruiterId] = useState(initialData?.assignedRecruiterId ?? "");
  const [assignedRecruiterName, setAssignedRecruiterName] = useState(initialData?.assignedRecruiterName ?? "");
  const [recruiterQuery, setRecruiterQuery] = useState(initialData?.assignedRecruiterName ?? "");
  const [recruiterResults, setRecruiterResults] = useState<RecruiterHit[]>([]);
  const [isRecruiterSearching, setIsRecruiterSearching] = useState(false);
  const [showRecruiterDropdown, setShowRecruiterDropdown] = useState(false);
  const recruiterRef = useRef<HTMLDivElement>(null);
  const recruiterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showInterviewSearch = projectStatus === "Verbal Confirmation" || projectStatus === "Confirmation";
  const showRecruiterSearch = projectStatus === "In-Market";

  const searchInterviews = useCallback(async (q: string) => {
    if (q.length < 3) { setInterviewResults([]); return; }
    const res = await fetch(`/api/interviews/search?q=${encodeURIComponent(q)}`);
    if (res.ok) setInterviewResults(await res.json());
  }, []);

  const searchRecruiters = useCallback(async (q: string) => {
    if (!q.trim()) { setRecruiterResults([]); setShowRecruiterDropdown(false); return; }
    setIsRecruiterSearching(true);
    try {
      const res = await fetch(`/api/recruiters/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        setRecruiterResults(await res.json());
        setShowRecruiterDropdown(true);
      } else {
        setRecruiterResults([]);
      }
    } catch {
      setRecruiterResults([]);
    } finally {
      setIsRecruiterSearching(false);
    }
  }, []);

  useEffect(() => {
    if (interviewTimer.current) clearTimeout(interviewTimer.current);
    interviewTimer.current = setTimeout(() => searchInterviews(interviewQuery), 300);
  }, [interviewQuery, searchInterviews]);

  useEffect(() => {
    if (assignedRecruiterId) return;
    if (recruiterTimer.current) clearTimeout(recruiterTimer.current);
    recruiterTimer.current = setTimeout(() => searchRecruiters(recruiterQuery), 300);
    return () => { if (recruiterTimer.current) clearTimeout(recruiterTimer.current); };
  }, [recruiterQuery, searchRecruiters, assignedRecruiterId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (recruiterRef.current && !recruiterRef.current.contains(e.target as Node)) {
        setShowRecruiterDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!consultantId) return;
    if (hasInitialData) return;
    let cancelled = false;

    async function loadConsultant() {
      setLoading(true);
      try {
        const res = await fetch(`/api/students/${consultantId}`);
        if (!res.ok) throw new Error("Failed to load consultant");
        const c = await res.json();
        if (cancelled) return;

        setFirstName(c.firstName ?? "");
        setLastName(c.lastName ?? "");
        setPersonalPhone(c.personalPhone ?? "");
        setEmail(c.email ?? "");
        setDob(toDateInputValue(c.dob));
        setParentPhone(c.parentPhone ?? "");
        setEmergencyContact(c.emergencyContact ?? "");
        setReferredBy(c.referredBy ?? "");
        setAddressLine1(c.addressLine1 ?? "");
        setAddressLine2(c.addressLine2 ?? "");
        setCity(c.city ?? "");
        setState(c.state ?? "");
        setZipCode(c.zipCode ?? "");
        setUniversityName(c.universityName ?? "");
        setUniversityLocation(c.universityLocation ?? "");
        setMasters(c.masters ?? "");
        setMastersCompletedDate(c.mastersCompletedDate ?? "");
        setDsoName(c.dsoName ?? "");
        setDsoEmail(c.dsoEmail ?? "");
        setDsoPhone(c.dsoPhone ?? "");
        setVisaStatus(c.visaStatus ?? "");
        setMarketingVisaStatus(c.marketingVisaStatus ?? "");
        setVisaStartDate(toDateInputValue(c.visaStartDate));
        setVisaExpiryDate(toDateInputValue(c.visaExpiryDate));
        setOnboardingStartDate(toDateInputValue(c.onboardingStartDate));
        setOfferLetterType(c.offerLetterType ?? "");
        setPayRate(c.payRate ?? "");
        setHasDL(c.hasDL ?? "");
        setHasSSN(c.hasSSN ?? "");
        setPassportNumber(c.passportNumber ?? "");
        setTechnology(c.technology ?? "");
        setProjectStatus(c.projectStatus ?? "");
        setJobTitle(c.jobTitle ?? "");
        setVerbalConfirmationDate(toDateInputValue(c.verbalConfirmationDate));
        setProjectStartDate(toDateInputValue(c.projectStartDate));
        setBillRate(c.billRate ?? "");
        setPayroll(c.payroll ?? "");
        setWorkMode(c.workMode ?? "");
        setPmName(c.pmName ?? "");
        setPmEmail(c.pmEmail ?? "");
        setPmPhone(c.pmPhone ?? "");
        setDriveLocation(c.driveLocation ?? "");
        setConsultantComment(getConsultantLevelCommentsText(c.comments));
        setAssignedRecruiterId(c.assignedRecruiterId ?? "");
        setAssignedRecruiterName(c.assignedRecruiterName ?? "");
        setRecruiterQuery(c.assignedRecruiterName ?? "");
        if (c.linkedInterviewId) setInterviewQuery(c.linkedInterviewId);
      } catch {
        if (!cancelled) show("Failed to load consultant details", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadConsultant();
    return () => { cancelled = true; };
  }, [consultantId, hasInitialData, show]);

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
    if (projectStatus === "Verbal Confirmation" && !verbalConfirmationDate.trim())
      errs.verbalConfirmationDate = "Required when status is Verbal Confirmation";
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
        fd.append("marketingVisaStatus", marketingVisaStatus);
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
        if (driveLocation) fd.append("driveLocation", driveLocation);
        if (projectStatus === "In-Market") fd.append("recruiterId", assignedRecruiterId);
        fd.append("consultantComment", consultantComment);
        const url = isEdit ? `/api/students/${consultantId}` : "/api/students";
        const method = isEdit ? "PUT" : "POST";
        const res = await fetch(url, { method, body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to save consultant");
        if (data.codeVisionError) {
          show(
            `${firstName} ${lastName} saved in GFT Vision, but CodeVision activation failed: ${data.codeVisionError}`,
            "error",
          );
        } else if (data.codeVisionEmailSent) {
          show(
            `${firstName} ${lastName} onboarded. CodeVision practice activation email sent to ${email}.`,
            "success",
          );
        } else if (data.codeVisionProvisioned) {
          show(`${firstName} ${lastName} onboarded and provisioned in CodeVision.`, "success");
        } else {
          show(`${firstName} ${lastName} ${isEdit ? "updated" : "added"} successfully`, "success");
        }
        onSuccess?.();
        router.refresh();
        if (!isEdit) {
        setFirstName(""); setLastName(""); setEmail(""); setPersonalPhone(""); setDob("");
        setParentPhone(""); setEmergencyContact(""); setReferredBy("");
        setAddressLine1(""); setAddressLine2(""); setCity(""); setState(""); setZipCode("");
        setUniversityName(""); setUniversityLocation(""); setMasters(""); setMastersCompletedDate("");
        setDsoName(""); setDsoEmail(""); setDsoPhone("");
        setVisaStatus(""); setMarketingVisaStatus(""); setVisaStartDate(""); setVisaExpiryDate("");
        setOnboardingStartDate(""); setOfferLetterType(""); setPayRate(""); setHasDL(""); setHasSSN(""); setPassportNumber(""); setTechnology("");
        setDlDoc(emptyFile()); setPassportDoc(emptyFile()); setVisaCopyDoc(emptyFile());
        setProjectStatus(""); setJobTitle(""); setVerbalConfirmationDate(""); setProjectStartDate("");
        setBillRate(""); setPayroll(""); setWorkMode(""); setPmName(""); setPmEmail(""); setPmPhone(""); setDriveLocation("");
        setAssignedRecruiterId(""); setAssignedRecruiterName(""); setRecruiterQuery("");
        setConsultantComment("");
        setSelectedInterview(null); setInterviewQuery("");
        }
      } catch (err: unknown) {
        show(err instanceof Error ? err.message : "Error saving consultant", "error");
      }
    });
  };

  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  const inputProps = { compact: true as const };

  return (
    <SlideFormShell>
      <SlideFormHeader
        icon={GraduationCap}
        title={isEdit ? "Edit Consultant" : "Add Consultant"}
        subtitle={isEdit ? "Update consultant profile details" : "Onboard a new consultant"}
        badge={fullName ? (
          <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[8px] font-bold text-white">
              {initials(fullName)}
            </div>
            <span className="text-[10px] font-semibold text-white">{fullName}</span>
          </div>
        ) : undefined}
      />

      <SlideFormBody>
        <SlideFormSections>
          <SlideFormSection icon={User} title="Personal Information" color="violet">
            <SlideFormGrid cols={3}>
              <Input id="c-firstName" label="First Name *" value={firstName} onChange={(e) => setFirstName(e.target.value)} error={errors.firstName} {...inputProps} />
              <Input id="c-lastName" label="Last Name *" value={lastName} onChange={(e) => setLastName(e.target.value)} error={errors.lastName} {...inputProps} />
              <Input id="c-email" label="Email *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} {...inputProps} />
              <Input id="c-personalPhone" label="Personal Phone" type="tel" value={personalPhone} onChange={(e) => setPersonalPhone(e.target.value)} error={errors.personalPhone} {...inputProps} />
              <Input id="c-dob" label="Date of Birth" type="date" value={dob} onChange={(e) => setDob(e.target.value)} {...inputProps} />
              <Input id="c-parentPhone" label="Parent Phone" type="tel" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} error={errors.parentPhone} {...inputProps} />
              <Input id="c-emergency" label="Emergency Contact" type="tel" value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} error={errors.emergencyContact} {...inputProps} />
              <Input id="c-referredBy" label="Referred By" value={referredBy} onChange={(e) => setReferredBy(e.target.value)} {...inputProps} />
            </SlideFormGrid>
          </SlideFormSection>

          <SlideFormSection icon={MapPin} title="Address" color="blue">
            <SlideFormGrid cols={3}>
              <div className="sm:col-span-2">
                <Input id="c-addr1" label="Address Line 1" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} {...inputProps} />
              </div>
              <Input id="c-addr2" label="Address Line 2" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} {...inputProps} />
              <Input id="c-city" label="City" value={city} onChange={(e) => setCity(e.target.value)} {...inputProps} />
              <Input id="c-state" label="State" value={state} onChange={(e) => setState(e.target.value)} {...inputProps} />
              <Input id="c-zip" label="Zip Code" value={zipCode} onChange={(e) => setZipCode(e.target.value)} {...inputProps} />
            </SlideFormGrid>
          </SlideFormSection>

          <SlideFormSection icon={BookOpen} title="University" color="indigo">
            <SlideFormGrid cols={3}>
              <Input id="c-uniName" label="University Name" value={universityName} onChange={(e) => setUniversityName(e.target.value)} {...inputProps} />
              <Input id="c-uniLoc" label="University Location" value={universityLocation} onChange={(e) => setUniversityLocation(e.target.value)} {...inputProps} />
              <Input id="c-masters" label="Masters Degree" value={masters} onChange={(e) => setMasters(e.target.value)} {...inputProps} />
              <Input id="c-mastersDate" label="Masters Completed" value={mastersCompletedDate} onChange={(e) => setMastersCompletedDate(e.target.value)} {...inputProps} />
              <Input id="c-dsoName" label="DSO Name" value={dsoName} onChange={(e) => setDsoName(e.target.value)} {...inputProps} />
              <Input id="c-dsoEmail" label="DSO Email" type="email" value={dsoEmail} onChange={(e) => setDsoEmail(e.target.value)} error={errors.dsoEmail} {...inputProps} />
              <Input id="c-dsoPhone" label="DSO Phone" type="tel" value={dsoPhone} onChange={(e) => setDsoPhone(e.target.value)} error={errors.dsoPhone} {...inputProps} />
            </SlideFormGrid>
          </SlideFormSection>

          <SlideFormSection icon={CreditCard} title="Visa Information" color="amber">
            <PillChips label="Original Visa" value={visaStatus} options={VISA_STATUSES} onChange={setVisaStatus} />
            <PillChips label="Marketing Visa" value={marketingVisaStatus} options={MARKETING_VISA_STATUSES} onChange={setMarketingVisaStatus} />
            <SlideFormGrid cols={2}>
              <Input id="c-visaStart" label="Visa Start Date" type="date" value={visaStartDate} onChange={(e) => setVisaStartDate(e.target.value)} {...inputProps} />
              <Input id="c-visaExpiry" label="Visa Expiry Date" type="date" value={visaExpiryDate} onChange={(e) => setVisaExpiryDate(e.target.value)} error={errors.visaExpiryDate} {...inputProps} />
            </SlideFormGrid>
          </SlideFormSection>

          <SlideFormSection icon={Briefcase} title="Onboarding" color="emerald">
            <SlideFormGrid cols={2}>
              <Input id="c-obStart" label="Onboarding Start" type="date" value={onboardingStartDate} onChange={(e) => setOnboardingStartDate(e.target.value)} {...inputProps} />
              <Input id="c-passport" label="Passport Number" value={passportNumber} onChange={(e) => setPassportNumber(e.target.value)} {...inputProps} />
            </SlideFormGrid>
            <PillChips label="Offer Letter Type" value={offerLetterType} options={OFFER_LETTER_TYPES} onChange={setOfferLetterType} />
            {offerLetterType === "Paid-Stem" && (
              <Input id="c-payRate" label="Pay Rate (USD/hr)" value={payRate} onChange={(e) => setPayRate(e.target.value)} {...inputProps} />
            )}
            <PillChips label="Technology" value={technology} options={TECHNOLOGIES} onChange={setTechnology} />
            <SlideFormGrid cols={2}>
              <YesNoToggle label="Has Driver License?" value={hasDL} onChange={setHasDL} />
              <YesNoToggle label="Has SSN?" value={hasSSN} onChange={setHasSSN} />
            </SlideFormGrid>
          </SlideFormSection>

          <SlideFormSection icon={FileCheck} title="Documents" color="slate">
            <SlideFormGrid cols={3}>
              <FileUploadCard label="Driver License" id="doc-dl" state={dlDoc} onChange={(f) => setDlDoc({ file: f, uploaded: false })} />
              <FileUploadCard label="Passport" id="doc-passport" state={passportDoc} onChange={(f) => setPassportDoc({ file: f, uploaded: false })} />
              <FileUploadCard label="Visa Copy" id="doc-visa" state={visaCopyDoc} onChange={(f) => setVisaCopyDoc({ file: f, uploaded: false })} />
            </SlideFormGrid>
          </SlideFormSection>

          <SlideFormSection icon={FolderKanban} title="Job Card" color="rose" className="xl:col-span-2">
            <PillChips label="Project Status" value={projectStatus} options={[...PROJECT_STATUSES]} onChange={(v) => { setProjectStatus(v); setSelectedInterview(null); setInterviewQuery(""); }} />
            <SlideFormGrid cols={3}>
              <Input id="c-jobTitle" label="Job Title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} {...inputProps} />
              <Input id="c-verbalDate" label={projectStatus === "Verbal Confirmation" ? "Verbal Confirmation *" : "Verbal Confirmation"} type="date" value={verbalConfirmationDate} onChange={(e) => setVerbalConfirmationDate(e.target.value)} error={errors.verbalConfirmationDate} {...inputProps} />
              <Input id="c-projStart" label="Project Start" type="date" value={projectStartDate} onChange={(e) => setProjectStartDate(e.target.value)} {...inputProps} />
              <Input id="c-billRate" label="Bill Rate (USD/hr)" value={billRate} onChange={(e) => setBillRate(e.target.value)} {...inputProps} />
              <Input id="c-pmName" label="PM Name" value={pmName} onChange={(e) => setPmName(e.target.value)} {...inputProps} />
              <Input id="c-pmEmail" label="PM Email" type="email" value={pmEmail} onChange={(e) => setPmEmail(e.target.value)} error={errors.pmEmail} {...inputProps} />
              <Input id="c-pmPhone" label="PM Phone" type="tel" value={pmPhone} onChange={(e) => setPmPhone(e.target.value)} error={errors.pmPhone} {...inputProps} />
              <div className="sm:col-span-2">
                <Input id="c-driveLocation" label="Drive Location" type="url" placeholder="https://drive.google.com/..." value={driveLocation} onChange={(e) => setDriveLocation(e.target.value)} {...inputProps} />
              </div>
            </SlideFormGrid>
            {showInterviewSearch && (
              <div className="relative">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Interview ID</label>
                {selectedInterview ? (
                  <div className="mt-1 flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-semibold text-indigo-600">{selectedInterview.interviewId}</span>
                    <button type="button" onClick={() => { setSelectedInterview(null); setInterviewQuery(""); }} className="ml-auto text-[10px] font-semibold text-rose-500">Clear</button>
                  </div>
                ) : (
                  <input type="text" placeholder="Type 3+ chars" value={interviewQuery}
                    onChange={(e) => { setInterviewQuery(e.target.value); setShowInterviewDropdown(true); }}
                    onFocus={() => setShowInterviewDropdown(true)}
                    className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20" />
                )}
                {showInterviewDropdown && interviewResults.length > 0 && (
                  <div className="absolute top-full z-30 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-xl">
                    {interviewResults.map((hit) => (
                      <button key={hit.id} type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-indigo-50"
                        onClick={() => { setSelectedInterview(hit); setInterviewQuery(hit.interviewId); setShowInterviewDropdown(false); }}>
                        <span className="font-semibold text-indigo-700">{hit.interviewId}</span>
                        <span className="text-slate-500">({hit.interviewStatus})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {showRecruiterSearch && (
              <div className="relative" ref={recruiterRef}>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Assigned Recruiter</label>
                {assignedRecruiterId ? (
                  <div className="mt-1 flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-semibold text-indigo-600">{assignedRecruiterName}</span>
                    <button
                      type="button"
                      onClick={() => { setAssignedRecruiterId(""); setAssignedRecruiterName(""); setRecruiterQuery(""); }}
                      className="ml-auto text-[10px] font-semibold text-rose-500"
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <div className="relative mt-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search recruiter by name…"
                      value={recruiterQuery}
                      onChange={(e) => { setRecruiterQuery(e.target.value); setShowRecruiterDropdown(true); }}
                      onFocus={() => recruiterResults.length > 0 && setShowRecruiterDropdown(true)}
                      className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-8 text-xs focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
                    />
                    {isRecruiterSearching && <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-400" />}
                  </div>
                )}
                {showRecruiterDropdown && recruiterResults.length > 0 && (
                  <ul className="absolute z-30 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                    {recruiterResults.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setAssignedRecruiterId(r.id);
                            setAssignedRecruiterName(`${r.firstName} ${r.lastName}`);
                            setRecruiterQuery(`${r.firstName} ${r.lastName}`);
                            setShowRecruiterDropdown(false);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-indigo-50"
                        >
                          <span className="font-semibold text-indigo-700">{r.firstName} {r.lastName}</span>
                          <span className="text-slate-500">{r.email}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <PillChips label="Payroll Split" value={payroll} options={PAYROLLS} onChange={setPayroll} />
            <PillChips label="Work Mode" value={workMode} options={WORK_MODES} onChange={setWorkMode} />
          </SlideFormSection>

          <SlideFormSection icon={MessageSquare} title="Comments" color="rose" className="xl:col-span-2">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Consultant comment
              </label>
              <textarea
                rows={4}
                value={consultantComment}
                onChange={(e) => setConsultantComment(e.target.value)}
                placeholder="Global consultant notes from pre-marketing, leads, or staff..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-400/20 resize-y"
              />
              <p className="text-[10px] text-slate-400">
                This note appears in the Consultants comments column and detail view.
              </p>
            </div>
          </SlideFormSection>
        </SlideFormSections>
      </SlideFormBody>

      <SlideFormFooter>
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
        )}
        <Button size="sm" onClick={submit} disabled={isPending} className="px-5">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />}
          {isPending ? "Saving…" : isEdit ? "Save Changes" : "Save Consultant"}
        </Button>
      </SlideFormFooter>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </SlideFormShell>
  );
}
