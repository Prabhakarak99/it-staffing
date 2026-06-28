"use client";

import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { SlideOver } from "@/components/ui/slide-over";
import { OnboardRecruiterForm } from "./onboard-recruiter-form";
import { RecruiterList } from "./recruiter-list";
import type { User, Role } from "@/generated/prisma/client";

type RecruiterUser = User & { role: Role | null };

interface Props {
  recruiters: RecruiterUser[];
  roles: Role[];
}

export function RecruitersView({ recruiters, roles }: Props) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <>
      {/* ── Page header ── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 px-6 py-5">
        <div className="absolute -right-6 -top-6 h-36 w-36 rounded-full bg-white/[0.05]" />
        <div className="absolute left-1/2 bottom-0 h-20 w-20 rounded-full bg-white/[0.04]" />

        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-white">Recruiters</h1>
              <p className="mt-0.5 text-[12px] text-white/65">
                {recruiters.length} recruiter{recruiters.length !== 1 ? "s" : ""} in the system
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAdd(true)}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[13px] font-bold text-emerald-700 shadow-lg transition-all hover:shadow-xl hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4" />
            Add Recruiter
          </button>
        </div>
      </div>

      {/* ── List ── */}
      <div className="p-6">
        <RecruiterList recruiters={recruiters} roles={roles} />
      </div>

      {/* ── Add Recruiter slide-over ── */}
      <SlideOver open={showAdd} onClose={() => setShowAdd(false)} maxWidth="max-w-3xl">
        <OnboardRecruiterForm roles={roles} onSuccess={() => setShowAdd(false)} />
      </SlideOver>
    </>
  );
}
