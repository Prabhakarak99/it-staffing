"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil, FileText, Building2, Globe, UserRound } from "lucide-react";
import {
  SlideFormBody,
  SlideFormFooter,
  SlideFormHeader,
  SlideFormSection,
  SlideFormSections,
  SlideFormShell,
} from "@/components/forms/compact-slide-form";
import { SubmissionForm } from "./submission-form";

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  "Submission Submitted": "info",
  "In Review": "warning",
  "Rejected": "danger",
  "Moved to Client": "default",
  Confirmation: "success",
};

type SubmissionDetailRecord = {
  id: string;
  submissionId: string;
  submissionDate: string;
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
  recruiter: { id: string; firstName: string; lastName: string; email: string };
  consultant: { id: string; firstName: string; lastName: string; email: string; technology: string | null };
  interviews: Array<{
    id: string;
    interviewId: string;
    interviewStartDate: string;
    interviewLevel: string;
    interviewStatus: string;
  }>;
};

function fmtDate(value: string) {
  return new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-800 break-words">{value?.trim() || "—"}</p>
    </div>
  );
}

export function SubmissionDetail({ submissionId, recruiterId }: { submissionId: string; recruiterId?: string }) {
  const router = useRouter();
  const [submission, setSubmission] = useState<SubmissionDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/submissions/${submissionId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load submission");
      setSubmission(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load submission details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/submissions/${submissionId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load submission");
        if (!cancelled) setSubmission(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load submission details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  if (editing && submission) {
    return (
      <SubmissionForm
        recruiterId={recruiterId ?? submission.recruiter.id}
        recruiterName={`${submission.recruiter.firstName} ${submission.recruiter.lastName}`}
        nextSubmissionId={submission.submissionId}
        existingSubmission={submission}
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
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="flex min-h-[280px] items-center justify-center p-8 text-center">
        <p className="text-sm font-medium text-rose-600">{error || "Submission not found"}</p>
      </div>
    );
  }

  return (
    <SlideFormShell>
      <SlideFormHeader
        icon={FileText}
        title={submission.submissionId}
        subtitle={`${submission.consultant.firstName} ${submission.consultant.lastName} · ${fmtDate(submission.submissionDate)}`}
        tone="sky"
        badge={<Badge variant={STATUS_VARIANT[submission.status] ?? "default"}>{submission.status}</Badge>}
        actions={
          <Button size="sm" variant="secondary" className="bg-white/15 text-white border-white/20 hover:bg-white/25" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        }
      />

      <SlideFormBody>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <span className="rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-700">{submission.technology}</span>
          {submission.clientName && <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">{submission.clientName}</span>}
          {submission.payRate && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">{submission.payRate}</span>}
        </div>

        <SlideFormSections>
          <SlideFormSection icon={UserRound} title="Overview" color="sky">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <DetailField label="Recruiter" value={`${submission.recruiter.firstName} ${submission.recruiter.lastName}`} />
              <DetailField label="Recruiter Email" value={submission.recruiter.email} />
              <DetailField label="Consultant" value={`${submission.consultant.firstName} ${submission.consultant.lastName}`} />
              <DetailField label="Consultant Email" value={submission.consultant.email} />
              <DetailField label="Technology" value={submission.technology} />
              <DetailField label="Pay Rate" value={submission.payRate} />
            </div>
          </SlideFormSection>

          <SlideFormSection icon={Building2} title="Vendor Details" color="indigo">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <DetailField label="Vendor Company" value={submission.vendorCompany} />
              <DetailField label="Vendor Recruiter" value={submission.vendorRecruiterName} />
              <DetailField label="Vendor Email" value={submission.vendorRecruiterEmail} />
              <DetailField label="Vendor Phone" value={submission.vendorRecruiterPhone} />
              <DetailField label="Implementation Name" value={submission.implementationName} />
              <DetailField label="Implementation Email" value={submission.implementationEmail} />
              <DetailField label="Implementation Phone" value={submission.implementationPhone} />
            </div>
          </SlideFormSection>

          <SlideFormSection icon={Globe} title="Client Details" color="emerald">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <DetailField label="Client Name" value={submission.clientName} />
              <DetailField label="Client Location" value={submission.clientLocation} />
              <DetailField label="Status" value={submission.status} />
            </div>
          </SlideFormSection>

          <SlideFormSection icon={FileText} title="Job Description" color="amber">
            <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
              {submission.jobDescription?.trim() || "No job description added."}
            </p>
          </SlideFormSection>

          <SlideFormSection icon={FileText} title="Linked Interviews" color="rose" className="xl:col-span-2">
            {submission.interviews.length > 0 ? (
              <div className="space-y-2">
                {submission.interviews.map((interview) => (
                  <div key={interview.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <div>
                      <p className="text-xs font-semibold text-slate-900">{interview.interviewId}</p>
                      <p className="text-[11px] text-slate-500">{fmtDate(interview.interviewStartDate)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="info">{interview.interviewLevel}</Badge>
                      <Badge variant={STATUS_VARIANT[interview.interviewStatus] ?? "default"}>{interview.interviewStatus}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No interviews linked to this submission yet.</p>
            )}
          </SlideFormSection>
        </SlideFormSections>
      </SlideFormBody>

      <SlideFormFooter>
        <Button size="sm" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" />
          Edit Submission
        </Button>
      </SlideFormFooter>
    </SlideFormShell>
  );
}
