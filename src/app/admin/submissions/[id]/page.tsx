export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText } from "lucide-react";

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  "Submission Submitted": "info",
  "In Review": "warning",
  "Rejected": "danger",
  "Moved to Client": "default",
  "Confirmation": "success",
};

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

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const sub = await prisma.submission.findUnique({
    where: { id },
    include: {
      recruiter: { select: { firstName: true, lastName: true, email: true } },
      consultant: { select: { firstName: true, lastName: true, email: true, technology: true } },
      interviews: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          interviewId: true,
          interviewStartDate: true,
          interviewLevel: true,
          interviewStatus: true,
        },
      },
    },
  });

  if (!sub) notFound();

  // Recruiters can only view their own submissions
  if (session.roleName === "Recruiter" && sub.recruiterId !== session.userId) {
    redirect("/admin/submissions/list");
  }

  const fmt = (d: Date | string) =>
    new Date(d).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <Header title={`Submission — ${sub.submissionId}`} />
      <div className="p-6 space-y-4">

        {/* Back + status bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/admin/submissions/list"
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Total Submissions
          </Link>
          <Badge variant={STATUS_VARIANT[sub.status] ?? "default"}>{sub.status}</Badge>
        </div>

        {/* Overview */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50">
              <FileText className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900 font-mono">{sub.submissionId}</p>
              <p className="text-xs text-slate-500">{fmt(sub.submissionDate)}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Recruiter" value={`${sub.recruiter.firstName} ${sub.recruiter.lastName}`} />
            <Field label="Consultant" value={`${sub.consultant.firstName} ${sub.consultant.lastName}`} />
            <Field label="Technology" value={sub.technology} />
            <Field label="Pay Rate" value={sub.payRate} />
            <Field label="Status" value={sub.status} />
          </div>
        </div>

        {/* Job Description */}
        {sub.jobDescription && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Job Description</h3>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{sub.jobDescription}</p>
          </div>
        )}

        {/* Vendor Details */}
        <Section title="Vendor Details">
          <Field label="Vendor Company" value={sub.vendorCompany} />
          <Field label="Recruiter Name" value={sub.vendorRecruiterName} />
          <Field label="Recruiter Email" value={sub.vendorRecruiterEmail} />
          <Field label="Recruiter Phone" value={sub.vendorRecruiterPhone} />
        </Section>

        {/* Implementation Details */}
        {(sub.implementationName || sub.implementationEmail || sub.implementationPhone) && (
          <Section title="Implementation Details">
            <Field label="Name" value={sub.implementationName} />
            <Field label="Email" value={sub.implementationEmail} />
            <Field label="Phone" value={sub.implementationPhone} />
          </Section>
        )}

        {/* Client Details */}
        {(sub.clientName || sub.clientLocation) && (
          <Section title="Client Details">
            <Field label="Client Name" value={sub.clientName} />
            <Field label="Location" value={sub.clientLocation} />
          </Section>
        )}

        {/* Linked Interviews */}
        {sub.interviews.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
              Linked Interviews ({sub.interviews.length})
            </h3>
            <div className="divide-y divide-slate-100">
              {sub.interviews.map((iv) => (
                <Link
                  key={iv.id}
                  href={`/admin/interviews/${iv.id}`}
                  className="flex items-center justify-between py-3 hover:bg-slate-50 px-2 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-semibold text-blue-700">{iv.interviewId}</span>
                    <Badge variant="info">{iv.interviewLevel}</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">{fmt(iv.interviewStartDate)}</span>
                    <Badge variant={
                      iv.interviewStatus === "Confirmation" ? "success" :
                      iv.interviewStatus === "Rejected" ? "danger" : "warning"
                    }>
                      {iv.interviewStatus}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
