"use client";

import { useEffect, useState } from "react";
import { Calendar, Plus } from "lucide-react";
import { SlideOver } from "@/components/ui/slide-over";
import { useListDeepLink } from "@/lib/list-deep-link";
import { InterviewDetail } from "./interview-detail";
import { InterviewForm } from "./interview-form";
import { InterviewList } from "./interview-list";

interface MySubmission {
  id: string; submissionId: string; technology: string; vendorCompany: string;
  vendorRecruiterName: string; vendorRecruiterEmail: string; vendorRecruiterPhone: string;
  implementationName: string | null; implementationEmail: string | null; implementationPhone: string | null;
  clientName: string | null; clientLocation: string | null;
  consultant: { firstName: string; lastName: string };
}

interface Interview {
  id: string; interviewId: string; interviewStartDate: string | Date; interviewEndDate: string | Date;
  interviewLevel: string; interviewStatus: string; techSupportFeedback: string | null; amount: string | null;
  recruiter: { firstName: string; lastName: string };
  submission: {
    submissionId: string; technology: string; vendorCompany: string;
    clientName: string | null; clientLocation: string | null;
    consultant: { firstName: string; lastName: string };
  };
  techSupport: { firstName: string; lastName: string } | null;
}

interface Props {
  interviews: Interview[];
  recruiterId: string;
  recruiterName: string;
  nextInterviewId: string;
  mySubmissions: MySubmission[];
}

export function InterviewsView({ interviews, recruiterId, recruiterName, nextInterviewId, mySubmissions }: Props) {
  const { initialOpen, initialSearch, initialIds } = useListDeepLink();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nextId, setNextId] = useState(nextInterviewId);

  useEffect(() => {
    setSelectedId(initialOpen);
  }, [initialOpen]);

  const handleSuccess = () => {
    setShowAdd(false);
    const num = parseInt(nextId.replace("I-", ""), 10);
    setNextId(`I-${String(num + 1).padStart(3, "0")}`);
  };

  return (
    <>
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 px-6 py-5">
        <div className="absolute -right-6 -top-6 h-36 w-36 rounded-full bg-white/[0.05]" />
        <div className="absolute left-1/2 bottom-0 h-20 w-20 rounded-full bg-white/[0.04]" />

        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-white">Interviews</h1>
              <p className="mt-0.5 text-[12px] text-white/65">
                {interviews.length} total interview{interviews.length !== 1 ? "s" : ""} logged
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAdd(true)}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[13px] font-bold text-indigo-700 shadow-lg transition-all hover:shadow-xl hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4" />
            New Interview
          </button>
        </div>
      </div>

      <div className="p-6">
        <InterviewList
          interviews={interviews}
          onSelect={setSelectedId}
          initialSearch={initialSearch}
          initialIds={initialIds}
        />
      </div>

      <SlideOver open={showAdd} onClose={() => setShowAdd(false)} maxWidth="max-w-3xl">
        <InterviewForm
          recruiterId={recruiterId}
          recruiterName={recruiterName}
          nextInterviewId={nextId}
          mySubmissions={mySubmissions}
          onSuccess={handleSuccess}
        />
      </SlideOver>

      <SlideOver open={!!selectedId} onClose={() => setSelectedId(null)} maxWidth="max-w-4xl">
        {selectedId && <InterviewDetail interviewId={selectedId} recruiterId={recruiterId} />}
      </SlideOver>
    </>
  );
}
