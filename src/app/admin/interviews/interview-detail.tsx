"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil, Calendar, Clock, Building2, MessageSquare, Users } from "lucide-react";
import {
  SlideFormBody,
  SlideFormFooter,
  SlideFormHeader,
  SlideFormSection,
  SlideFormSections,
  SlideFormShell,
} from "@/components/forms/compact-slide-form";
import { InterviewForm } from "./interview-form";

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  Rejected: "danger",
  "Moved To Next Round": "warning",
  Confirmation: "success",
};

const LEVEL_VARIANT: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  Screening: "info",
  "Level 1": "default",
  "Level 2": "default",
  "Level 3": "warning",
  Final: "success",
};

type InterviewDetailRecord = {
  id: string;
  interviewId: string;
  interviewStartDate: string;
  interviewEndDate: string;
  interviewLevel: string;
  interviewStatus: string;
  techSupportFeedback: string | null;
  amount: string | null;
  otterLink: string | null;
  interviewQuestions: string | null;
  interviewFeedback: string | null;
  recruiter: { id: string; firstName: string; lastName: string; email: string };
  submission: {
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
    consultant: { id: string; firstName: string; lastName: string; email: string };
  };
  techSupport: { id: string; firstName: string; lastName: string; email: string; phoneNumber: string | null } | null;
};

function fmtDate(value: string) {
  return new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function calcDuration(start: string, end: string) {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (diff <= 0) return "—";
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hrs > 0 && mins > 0) return `${hrs} hr ${mins} min`;
  if (hrs > 0) return `${hrs} hr`;
  return `${mins} min`;
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-800 break-words">{value?.trim() || "—"}</p>
    </div>
  );
}

export function InterviewDetail({ interviewId, recruiterId }: { interviewId: string; recruiterId?: string }) {
  const router = useRouter();
  const [interview, setInterview] = useState<InterviewDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/interviews/${interviewId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load interview");
      setInterview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load interview details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/interviews/${interviewId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load interview");
        if (!cancelled) setInterview(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load interview details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [interviewId]);

  const mySubmissions = useMemo(() => {
    if (!interview) return [];
    return [{
      id: interview.submission.id,
      submissionId: interview.submission.submissionId,
      technology: interview.submission.technology,
      vendorCompany: interview.submission.vendorCompany,
      vendorRecruiterName: interview.submission.vendorRecruiterName,
      vendorRecruiterEmail: interview.submission.vendorRecruiterEmail,
      vendorRecruiterPhone: interview.submission.vendorRecruiterPhone,
      implementationName: interview.submission.implementationName,
      implementationEmail: interview.submission.implementationEmail,
      implementationPhone: interview.submission.implementationPhone,
      clientName: interview.submission.clientName,
      clientLocation: interview.submission.clientLocation,
      consultant: {
        firstName: interview.submission.consultant.firstName,
        lastName: interview.submission.consultant.lastName,
      },
    }];
  }, [interview]);

  if (editing && interview) {
    return (
      <InterviewForm
        recruiterId={recruiterId ?? interview.recruiter.id}
        recruiterName={`${interview.recruiter.firstName} ${interview.recruiter.lastName}`}
        nextInterviewId={interview.interviewId}
        mySubmissions={mySubmissions}
        existingInterview={interview}
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
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !interview) {
    return (
      <div className="flex min-h-[280px] items-center justify-center p-8 text-center">
        <p className="text-sm font-medium text-rose-600">{error || "Interview not found"}</p>
      </div>
    );
  }

  return (
    <SlideFormShell>
      <SlideFormHeader
        icon={Calendar}
        title={interview.interviewId}
        subtitle={`${interview.submission.consultant.firstName} ${interview.submission.consultant.lastName} · ${fmtDate(interview.interviewStartDate)}`}
        tone="indigo"
        badge={
          <div className="flex items-center gap-2">
            <Badge variant={LEVEL_VARIANT[interview.interviewLevel] ?? "default"}>{interview.interviewLevel}</Badge>
            <Badge variant={STATUS_VARIANT[interview.interviewStatus] ?? "default"}>{interview.interviewStatus}</Badge>
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
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-semibold text-indigo-700">{interview.submission.submissionId}</span>
          <span className="rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-700">{interview.submission.technology}</span>
          {interview.amount && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">{interview.amount}</span>}
        </div>

        <SlideFormSections>
          <SlideFormSection icon={Clock} title="Schedule" color="indigo">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <DetailField label="Start" value={fmtDate(interview.interviewStartDate)} />
              <DetailField label="End" value={fmtDate(interview.interviewEndDate)} />
              <DetailField label="Duration" value={calcDuration(interview.interviewStartDate, interview.interviewEndDate)} />
              <DetailField label="Level" value={interview.interviewLevel} />
              <DetailField label="Status" value={interview.interviewStatus} />
            </div>
          </SlideFormSection>

          <SlideFormSection icon={Users} title="People" color="sky">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <DetailField label="Recruiter" value={`${interview.recruiter.firstName} ${interview.recruiter.lastName}`} />
              <DetailField label="Recruiter Email" value={interview.recruiter.email} />
              <DetailField label="Consultant" value={`${interview.submission.consultant.firstName} ${interview.submission.consultant.lastName}`} />
              <DetailField label="Consultant Email" value={interview.submission.consultant.email} />
              <DetailField label="Tech Support" value={interview.techSupport ? `${interview.techSupport.firstName} ${interview.techSupport.lastName}` : null} />
              <DetailField label="Tech Support Phone" value={interview.techSupport?.phoneNumber} />
            </div>
          </SlideFormSection>

          <SlideFormSection icon={Building2} title="Submission Details" color="emerald">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <DetailField label="Submission ID" value={interview.submission.submissionId} />
              <DetailField label="Vendor Company" value={interview.submission.vendorCompany} />
              <DetailField label="Vendor Recruiter" value={interview.submission.vendorRecruiterName} />
              <DetailField label="Client Name" value={interview.submission.clientName} />
              <DetailField label="Client Location" value={interview.submission.clientLocation} />
              <DetailField label="Implementation Name" value={interview.submission.implementationName} />
            </div>
          </SlideFormSection>

          <SlideFormSection icon={MessageSquare} title="Notes & Feedback" color="amber">
            <div className="space-y-3 text-xs text-slate-700">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tech Support Feedback</p>
                <p className="mt-0.5 whitespace-pre-wrap">{interview.techSupportFeedback?.trim() || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Interview Questions</p>
                <p className="mt-0.5 whitespace-pre-wrap">{interview.interviewQuestions?.trim() || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Interview Feedback</p>
                <p className="mt-0.5 whitespace-pre-wrap">{interview.interviewFeedback?.trim() || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Otter Link</p>
                {interview.otterLink ? (
                  <a href={interview.otterLink} target="_blank" rel="noreferrer" className="mt-0.5 inline-block break-all text-indigo-600 hover:underline">
                    {interview.otterLink}
                  </a>
                ) : (
                  <p className="mt-0.5">—</p>
                )}
              </div>
            </div>
          </SlideFormSection>
        </SlideFormSections>
      </SlideFormBody>

      <SlideFormFooter>
        <Button size="sm" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" />
          Edit Interview
        </Button>
      </SlideFormFooter>
    </SlideFormShell>
  );
}
