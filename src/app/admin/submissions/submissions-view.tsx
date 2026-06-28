"use client";

import { useState } from "react";
import { FileText, Plus } from "lucide-react";
import { SlideOver } from "@/components/ui/slide-over";
import { SubmissionForm } from "./submission-form";
import { SubmissionList } from "./submission-list";

interface Submission {
  id: string; submissionId: string; submissionDate: string | Date; technology: string;
  payRate: string | null; vendorCompany: string; vendorRecruiterName: string; vendorRecruiterEmail: string;
  vendorRecruiterPhone: string; clientName: string | null; clientLocation: string | null;
  status: string; createdAt: string | Date;
  recruiter: { firstName: string; lastName: string };
  consultant: { firstName: string; lastName: string; technology: string | null };
}

interface Props {
  submissions: Submission[];
  recruiterId: string;
  recruiterName: string;
  nextSubmissionId: string;
}

export function SubmissionsView({ submissions, recruiterId, recruiterName, nextSubmissionId }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [nextId, setNextId] = useState(nextSubmissionId);

  const handleSuccess = () => {
    setShowAdd(false);
    // Bump the next ID optimistically so re-opens show a fresh ID
    const num = parseInt(nextId.replace("Sub-", ""), 10);
    setNextId(`Sub-${String(num + 1).padStart(3, "0")}`);
  };

  return (
    <>
      {/* ── Page header ── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 px-6 py-5">
        <div className="absolute -right-6 -top-6 h-36 w-36 rounded-full bg-white/[0.05]" />
        <div className="absolute left-1/2 bottom-0 h-20 w-20 rounded-full bg-white/[0.04]" />

        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-white">Submissions</h1>
              <p className="mt-0.5 text-[12px] text-white/65">
                {submissions.length} total submission{submissions.length !== 1 ? "s" : ""} in the pipeline
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAdd(true)}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[13px] font-bold text-sky-700 shadow-lg transition-all hover:shadow-xl hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4" />
            New Submission
          </button>
        </div>
      </div>

      {/* ── List ── */}
      <div className="p-6">
        <SubmissionList submissions={submissions} />
      </div>

      {/* ── New Submission slide-over ── */}
      <SlideOver open={showAdd} onClose={() => setShowAdd(false)} maxWidth="max-w-3xl">
        <SubmissionForm
          recruiterId={recruiterId}
          recruiterName={recruiterName}
          nextSubmissionId={nextId}
          onSuccess={handleSuccess}
        />
      </SlideOver>
    </>
  );
}
