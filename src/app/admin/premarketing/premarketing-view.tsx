"use client";

import { Send } from "lucide-react";
import { PreMarketingChecklistBoard, type PreMarketingBoardRecord } from "./premarketing-checklist-board";

interface Props {
  records: PreMarketingBoardRecord[];
}

export function PreMarketingView({ records }: Props) {
  return (
    <>
      <div className="relative overflow-hidden bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 px-4 py-3">
        <div className="relative flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
            <Send className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-[16px] font-bold text-white">Pre-Marketing Checklist</h1>
            <p className="text-[11px] text-white/75">
              Track onboarding checklist items. Complete all checks to move consultants to In-Market.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <PreMarketingChecklistBoard records={records} />
      </div>
    </>
  );
}
