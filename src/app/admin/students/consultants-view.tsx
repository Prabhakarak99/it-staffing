"use client";

import { useState } from "react";
import { GraduationCap, Plus, TrendingUp, Users, Sparkles } from "lucide-react";
import { SlideOver } from "@/components/ui/slide-over";
import { ConsultantDetail } from "./consultant-detail";
import { ConsultantForm } from "./consultant-form";
import { ConsultantList } from "./consultant-list";

interface Consultant {
  id: string; firstName: string; lastName: string; email: string;
  personalPhone: string | null; technology: string | null; visaStatus: string | null; marketingVisaStatus: string | null;
  projectStatus: string | null; offerLetterType: string | null; workMode: string | null;
  driveLocation: string | null;
  comments: unknown[]; onboardingStartDate: string | null; marketingStartDate: string | null; createdAt: string;
}

interface Props {
  consultants: Consultant[];
  inMarketCount: number;
  onProjectCount: number;
  preMarketingCount: number;
}

export function ConsultantsView({ consultants, inMarketCount, onProjectCount, preMarketingCount }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const total = consultants.length;

  return (
    <>
      {/* ── Page header ── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700 px-6 py-5">
        <div className="absolute -right-6 -top-6 h-36 w-36 rounded-full bg-white/[0.05]" />
        <div className="absolute left-1/3 bottom-0 h-20 w-20 rounded-full bg-white/[0.04]" />

        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-white">Consultants</h1>
              <p className="mt-0.5 text-[12px] text-white/65">
                {total} total &nbsp;·&nbsp; {preMarketingCount} pre-marketing &nbsp;·&nbsp; {inMarketCount} in-market &nbsp;·&nbsp; {onProjectCount} in-project
              </p>
            </div>
          </div>

          {/* Stats pills */}
          <div className="hidden items-center gap-2 lg:flex">
            <div className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-amber-200" />
              <span className="text-[12px] font-semibold text-white">{preMarketingCount} Pre-Marketing</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-sm">
              <TrendingUp className="h-3.5 w-3.5 text-indigo-200" />
              <span className="text-[12px] font-semibold text-white">{inMarketCount} In Market</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-sm">
              <Users className="h-3.5 w-3.5 text-indigo-200" />
              <span className="text-[12px] font-semibold text-white">{onProjectCount} On Project</span>
            </div>
          </div>

          <button
            onClick={() => setShowAdd(true)}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[13px] font-bold text-violet-700 shadow-lg transition-all hover:shadow-xl hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4" />
            Add Consultant
          </button>
        </div>
      </div>

      {/* ── List ── */}
      <div className="p-6">
        <ConsultantList consultants={consultants} onSelect={setSelectedId} />
      </div>

      {/* ── Consultant detail slide-over ── */}
      <SlideOver open={!!selectedId} onClose={() => setSelectedId(null)} maxWidth="max-w-4xl">
        {selectedId && <ConsultantDetail consultantId={selectedId} />}
      </SlideOver>

      {/* ── Add Consultant slide-over ── */}
      <SlideOver open={showAdd} onClose={() => setShowAdd(false)} maxWidth="max-w-4xl">
        <ConsultantForm onSuccess={() => setShowAdd(false)} />
      </SlideOver>
    </>
  );
}
