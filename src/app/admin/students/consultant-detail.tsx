"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap, Loader2, User, MapPin, BookOpen, CreditCard,
  Briefcase, FileCheck, ExternalLink, Phone, Pencil, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SlideFormBody, SlideFormFooter, SlideFormHeader, SlideFormSection,
  SlideFormSections, SlideFormShell,
} from "@/components/forms/compact-slide-form";
import { ConsultantForm } from "./consultant-form";
import { normalizeConsultantComments, getConsultantLevelCommentsText, type ConsultantComment } from "@/lib/premarketing-checklist";
import { formatDateOnly } from "@/lib/dates";

type ConsultantDetail = {
  id: string;
  firstName: string;
  lastName: string;
  personalPhone: string | null;
  email: string;
  dob: string | null;
  parentPhone: string | null;
  emergencyContact: string | null;
  referredBy: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  universityName: string | null;
  universityLocation: string | null;
  masters: string | null;
  mastersCompletedDate: string | null;
  dsoName: string | null;
  dsoEmail: string | null;
  dsoPhone: string | null;
  visaStatus: string | null;
  marketingVisaStatus: string | null;
  visaStartDate: string | null;
  visaExpiryDate: string | null;
  onboardingStartDate: string | null;
  offerLetterType: string | null;
  payRate: string | null;
  hasDL: string | null;
  hasSSN: string | null;
  passportNumber: string | null;
  dlDocument: string | null;
  passportDocument: string | null;
  visaCopyDocument: string | null;
  projectStatus: string | null;
  jobTitle: string | null;
  verbalConfirmationDate: string | null;
  linkedInterviewId: string | null;
  projectStartDate: string | null;
  billRate: string | null;
  payroll: string | null;
  workMode: string | null;
  pmName: string | null;
  pmEmail: string | null;
  pmPhone: string | null;
  driveLocation: string | null;
  phoneNumber: string | null;
  technology: string | null;
  comments: ConsultantComment[] | null;
  createdAt: string;
  assignedRecruiterId: string | null;
  assignedRecruiterName: string | null;
};

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function fmtDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-800 break-words">{value?.trim() || "—"}</p>
    </div>
  );
}

function DocumentLink({ label, filename }: { label: string; filename: string | null }) {
  if (!filename) return <DetailField label={label} value={null} />;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <a
        href={`/uploads/documents/${filename}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
      >
        View document <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

export function ConsultantDetail({ consultantId }: { consultantId: string }) {
  const router = useRouter();
  const [consultant, setConsultant] = useState<ConsultantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/students/${consultantId}`);
      if (!res.ok) throw new Error("Failed to load consultant details");
      const data = await res.json();
      setConsultant({
        ...data,
        comments: normalizeConsultantComments(data.comments),
      });
    } catch {
      setError("Could not load consultant details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/students/${consultantId}`);
        if (!res.ok) throw new Error("Failed to load consultant details");
        const data = await res.json();
        if (!cancelled) {
          setConsultant({
            ...data,
            comments: normalizeConsultantComments(data.comments),
          });
        }
      } catch {
        if (!cancelled) setError("Could not load consultant details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [consultantId]);

  if (editing && consultant) {
    return (
      <ConsultantForm
        consultantId={consultantId}
        initialData={{
          ...consultant,
          consultantComment: getConsultantLevelCommentsText(consultant.comments),
          assignedRecruiterId: consultant.assignedRecruiterId,
          assignedRecruiterName: consultant.assignedRecruiterName,
        }}
        onCancel={() => setEditing(false)}
        onSuccess={() => {
          setEditing(false);
          load();
          router.refresh();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (error || !consultant) {
    return (
      <div className="flex min-h-[280px] items-center justify-center p-8 text-center">
        <p className="text-sm font-medium text-rose-600">{error || "Consultant not found"}</p>
      </div>
    );
  }

  const name = `${consultant.firstName} ${consultant.lastName}`;
  const consultantComments = normalizeConsultantComments(consultant.comments);

  return (
    <SlideFormShell>
      <SlideFormHeader
        icon={GraduationCap}
        title={name}
        subtitle={`${consultant.email} · Onboarded ${fmtDateTime(consultant.createdAt)}`}
        badge={
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-[11px] font-bold text-white">
            {initials(name)}
          </div>
        }
        actions={
          <Button size="sm" variant="secondary" className="bg-white/15 text-white border-white/20 hover:bg-white/25" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        }
      />

      <SlideFormBody>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          {consultant.projectStatus && <span className="rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-700">{consultant.projectStatus}</span>}
          {consultant.technology && <span className="rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-700">{consultant.technology}</span>}
          {consultant.workMode && <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">{consultant.workMode}</span>}
          {(consultant.personalPhone || consultant.phoneNumber) && (
            <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{consultant.personalPhone || consultant.phoneNumber}</span>
          )}
          {(consultant.city || consultant.state) && (
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{[consultant.city, consultant.state].filter(Boolean).join(", ")}</span>
          )}
        </div>

        <SlideFormSections>
          <SlideFormSection icon={User} title="Personal Information" color="violet">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <DetailField label="First Name" value={consultant.firstName} />
            <DetailField label="Last Name" value={consultant.lastName} />
            <DetailField label="Email" value={consultant.email} />
            <DetailField label="Personal Phone" value={consultant.personalPhone} />
            <DetailField label="Date of Birth" value={formatDateOnly(consultant.dob)} />
            <DetailField label="Parent Phone" value={consultant.parentPhone} />
            <DetailField label="Emergency Contact" value={consultant.emergencyContact} />
            <DetailField label="Referred By" value={consultant.referredBy} />
            </div>
          </SlideFormSection>

          <SlideFormSection icon={MapPin} title="Address" color="blue">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <DetailField label="Address Line 1" value={consultant.addressLine1} />
            <DetailField label="Address Line 2" value={consultant.addressLine2} />
            <DetailField label="City" value={consultant.city} />
            <DetailField label="State" value={consultant.state} />
            <DetailField label="Zip Code" value={consultant.zipCode} />
            </div>
          </SlideFormSection>

          <SlideFormSection icon={BookOpen} title="University" color="indigo">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <DetailField label="University Name" value={consultant.universityName} />
            <DetailField label="University Location" value={consultant.universityLocation} />
            <DetailField label="Masters" value={consultant.masters} />
            <DetailField label="Masters Completed" value={consultant.mastersCompletedDate} />
            <DetailField label="DSO Name" value={consultant.dsoName} />
            <DetailField label="DSO Email" value={consultant.dsoEmail} />
            <DetailField label="DSO Phone" value={consultant.dsoPhone} />
            </div>
          </SlideFormSection>

          <SlideFormSection icon={CreditCard} title="Visa & Onboarding" color="amber">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <DetailField label="Original Visa" value={consultant.visaStatus} />
            <DetailField label="Marketing Visa" value={consultant.marketingVisaStatus} />
            <DetailField label="Visa Start Date" value={formatDateOnly(consultant.visaStartDate)} />
            <DetailField label="Visa Expiry Date" value={formatDateOnly(consultant.visaExpiryDate)} />
            <DetailField label="Onboarding Start" value={formatDateOnly(consultant.onboardingStartDate)} />
            <DetailField label="Offer Letter Type" value={consultant.offerLetterType} />
            <DetailField label="Pay Rate" value={consultant.payRate} />
            <DetailField label="Has DL" value={consultant.hasDL} />
            <DetailField label="Has SSN" value={consultant.hasSSN} />
            <DetailField label="Passport Number" value={consultant.passportNumber} />
            </div>
          </SlideFormSection>

          <SlideFormSection icon={FileCheck} title="Documents" color="rose">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <DocumentLink label="Driver's License" filename={consultant.dlDocument} />
            <DocumentLink label="Passport" filename={consultant.passportDocument} />
            <DocumentLink label="Visa Copy" filename={consultant.visaCopyDocument} />
            </div>
          </SlideFormSection>

          <SlideFormSection icon={Briefcase} title="Job Card" color="indigo" className="xl:col-span-2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <DetailField label="Project Status" value={consultant.projectStatus} />
            <DetailField label="Job Title" value={consultant.jobTitle} />
            <DetailField label="Technology" value={consultant.technology} />
            <DetailField label="Work Mode" value={consultant.workMode} />
            <DetailField label="Verbal Confirmation" value={formatDateOnly(consultant.verbalConfirmationDate)} />
            <DetailField label="Project Start Date" value={formatDateOnly(consultant.projectStartDate)} />
            <DetailField label="Bill Rate" value={consultant.billRate} />
            <DetailField label="Payroll" value={consultant.payroll} />
            <DetailField label="Linked Interview ID" value={consultant.linkedInterviewId} />
            <DetailField label="Assigned Recruiter" value={consultant.assignedRecruiterName} />
            <DetailField label="PM Name" value={consultant.pmName} />
            <DetailField label="PM Email" value={consultant.pmEmail} />
            <DetailField label="PM Phone" value={consultant.pmPhone} />
            {consultant.driveLocation ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Drive Location</p>
                <a
                  href={consultant.driveLocation}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline break-all"
                >
                  Open Drive <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
            ) : (
              <DetailField label="Drive Location" value={null} />
            )}
            </div>
          </SlideFormSection>

          <SlideFormSection icon={MessageSquare} title="Comments" color="rose" className="xl:col-span-2">
            {consultantComments.length > 0 ? (
              <ul className="list-disc space-y-2 pl-5 text-[13.8px] leading-relaxed text-slate-600">
                {consultantComments.map((comment, index) => (
                  <li key={`${comment.updatedAt}-${index}`} className="break-words">
                    {comment.note || comment.item || "Pre-Marketing comment"}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400">No consultant comments yet. Use Edit to add a global note.</p>
            )}
          </SlideFormSection>
        </SlideFormSections>
      </SlideFormBody>

      <SlideFormFooter>
        <Button size="sm" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" />
          Edit Consultant
        </Button>
      </SlideFormFooter>
    </SlideFormShell>
  );
}
