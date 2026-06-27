export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Clock } from "lucide-react";

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

function calcDuration(start: Date, end: Date): string {
  const diff = end.getTime() - start.getTime();
  if (diff <= 0) return "—";
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hrs > 0 && mins > 0) return `${hrs} hr ${mins} min`;
  if (hrs > 0) return `${hrs} hr`;
  return `${mins} min`;
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-sm text-slate-800">{value || <span className="text-slate-400">—</span>}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">{title}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </div>
  );
}

export default async function InterviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const iv = await prisma.interview.findUnique({
    where: { id },
    include: {
      recruiter: { select: { firstName: true, lastName: true, email: true } },
      submission: {
        select: {
          id: true,
          submissionId: true,
          technology: true,
          vendorCompany: true,
          vendorRecruiterName: true,
          vendorRecruiterEmail: true,
          vendorRecruiterPhone: true,
          implementationName: true,
          implementationEmail: true,
          implementationPhone: true,
          clientName: true,
          clientLocation: true,
          consultant: { select: { firstName: true, lastName: true, email: true } },
        },
      },
      techSupport: {
        select: { firstName: true, lastName: true, email: true, phoneNumber: true },
      },
    },
  });

  if (!iv) notFound();

  // Recruiters can only view their own interviews
  if (session.roleName === "Recruiter" && iv.recruiterId !== session.userId) {
    redirect("/admin/interviews/list");
  }

  const fmt = (d: Date | string) =>
    new Date(d).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

  const duration = calcDuration(
    new Date(iv.interviewStartDate),
    new Date(iv.interviewEndDate)
  );

  return (
    <>
      <Header title={`Interview — ${iv.interviewId}`} />
      <div className="p-6 space-y-4">

        {/* Back + status bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/admin/interviews/list"
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Total Interviews
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant={LEVEL_VARIANT[iv.interviewLevel] ?? "default"}>{iv.interviewLevel}</Badge>
            <Badge variant={STATUS_VARIANT[iv.interviewStatus] ?? "default"}>{iv.interviewStatus}</Badge>
          </div>
        </div>

        {/* Overview */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50">
              <Calendar className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900 font-mono">{iv.interviewId}</p>
              <p className="text-xs text-slate-500">{fmt(iv.interviewStartDate)}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Recruiter" value={`${iv.recruiter.firstName} ${iv.recruiter.lastName}`} />
            <Field label="Consultant" value={`${iv.submission.consultant.firstName} ${iv.submission.consultant.lastName}`} />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Submission</span>
              <Link
                href={`/admin/submissions/${iv.submission.id}`}
                className="text-sm font-mono font-semibold text-blue-700 hover:underline"
              >
                {iv.submission.submissionId}
              </Link>
            </div>
          </div>
        </div>

        {/* Schedule */}
        <Section title="Interview Schedule">
          <Field label="Start" value={fmt(iv.interviewStartDate)} />
          <Field label="End" value={fmt(iv.interviewEndDate)} />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Duration</span>
            <span className="flex items-center gap-1.5 text-sm font-medium text-green-700">
              <Clock className="h-4 w-4" />
              {duration}
            </span>
          </div>
          <Field label="Level" value={iv.interviewLevel} />
          <Field label="Status" value={iv.interviewStatus} />
        </Section>

        {/* Tech Support */}
        {iv.techSupport && (
          <Section title="Tech Support">
            <Field label="Name" value={`${iv.techSupport.firstName} ${iv.techSupport.lastName}`} />
            <Field label="Email" value={iv.techSupport.email} />
            <Field label="Phone" value={iv.techSupport.phoneNumber} />
            <Field label="Amount" value={iv.amount} />
            <Field label="Feedback" value={iv.techSupportFeedback} />
          </Section>
        )}

        {/* Otter Link */}
        {iv.otterLink && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Otter Recording</h3>
            <a
              href={iv.otterLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-indigo-600 hover:underline break-all"
            >
              {iv.otterLink}
            </a>
          </div>
        )}

        {/* Interview Questions */}
        {iv.interviewQuestions && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Interview Questions</h3>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{iv.interviewQuestions}</p>
          </div>
        )}

        {/* Interview Feedback */}
        {iv.interviewFeedback && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Interview Feedback</h3>
            <p className="text-sm text-slate-700 leading-relaxed">{iv.interviewFeedback}</p>
          </div>
        )}

        {/* Submission / Vendor / Client details */}
        <Section title="Submission Details">
          <Field label="Technology" value={iv.submission.technology} />
          <Field label="Vendor Company" value={iv.submission.vendorCompany} />
          <Field label="Vendor Recruiter" value={iv.submission.vendorRecruiterName} />
          <Field label="Vendor Email" value={iv.submission.vendorRecruiterEmail} />
          <Field label="Vendor Phone" value={iv.submission.vendorRecruiterPhone} />
          {iv.submission.implementationName && (
            <Field label="Implementation" value={iv.submission.implementationName} />
          )}
          {iv.submission.clientName && (
            <Field label="Client" value={iv.submission.clientName} />
          )}
          {iv.submission.clientLocation && (
            <Field label="Client Location" value={iv.submission.clientLocation} />
          )}
        </Section>
      </div>
    </>
  );
}
