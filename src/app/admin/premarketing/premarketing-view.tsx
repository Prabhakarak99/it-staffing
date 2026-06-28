"use client";

import { useState } from "react";
import { Plus, Send } from "lucide-react";
import { SlideOver } from "@/components/ui/slide-over";
import { PreMarketingForm } from "./premarketing-form";
import { PreMarketingList } from "./premarketing-list";

interface PreMarketingRecord {
  id: string;
  dlAvailable: string | null;
  visaAvailable: string | null;
  ssnAvailable: string | null;
  marketingSheetReady: string | null;
  marketingSheetExplained: string | null;
  marketingSheetReverseKT: string | null;
  allTrainingSessionsCompleted: string | null;
  allTrainingAssignmentsCompleted: string | null;
  marketingEmail: string | null;
  marketingVisaStatus: string | null;
  marketingStartDate: string | null;
  marketingEndDate: string | null;
  consultant: { id: string; firstName: string; lastName: string; email: string; technology: string | null };
  recruiter: { id: string; firstName: string; lastName: string; email: string } | null;
}

interface Props {
  records: PreMarketingRecord[];
}

export function PreMarketingView({ records }: Props) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <>
      {/* ── Page header ── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 px-6 py-5">
        <div className="absolute -right-6 -top-6 h-36 w-36 rounded-full bg-white/[0.05]" />
        <div className="absolute left-1/2 bottom-0 h-20 w-20 rounded-full bg-white/[0.04]" />

        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <Send className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-white">Pre-Marketing</h1>
              <p className="mt-0.5 text-[12px] text-white/65">
                {records.length} record{records.length !== 1 ? "s" : ""} in pipeline
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAdd(true)}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[13px] font-bold text-orange-700 shadow-lg transition-all hover:shadow-xl hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4" />
            Add Record
          </button>
        </div>
      </div>

      {/* ── List ── */}
      <div className="p-6">
        <PreMarketingList records={records} />
      </div>

      {/* ── Add Record slide-over ── */}
      <SlideOver open={showAdd} onClose={() => setShowAdd(false)} maxWidth="max-w-4xl">
        <PreMarketingForm onSuccess={() => setShowAdd(false)} />
      </SlideOver>
    </>
  );
}
