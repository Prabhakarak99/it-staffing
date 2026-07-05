"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Users } from "lucide-react";
import { SlideOver } from "@/components/ui/slide-over";
import { buildRecruiterUrl, parseRecruiterUrl } from "@/lib/recruiter-nav";
import { OnboardRecruiterForm } from "./onboard-recruiter-form";
import { RecruiterDetail } from "./recruiter-detail";
import { RecruiterList, type RecruiterUser } from "./recruiter-list";
import type { Role } from "@/generated/prisma/client";

interface Props {
  recruiters: RecruiterUser[];
  roles: Role[];
}

export function RecruitersView({ recruiters, roles }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlState = useMemo(() => parseRecruiterUrl(searchParams), [searchParams]);

  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(urlState.detail ?? null);
  const [editOnOpen, setEditOnOpen] = useState(false);

  useEffect(() => {
    setSelectedId(urlState.detail ?? null);
  }, [urlState.detail]);

  const selectedRecruiter = selectedId ? recruiters.find((r) => r.id === selectedId) : null;

  const openRecruiter = (id: string, edit = false) => {
    setEditOnOpen(edit);
    setSelectedId(id);
    router.replace(buildRecruiterUrl({ detail: id }), { scroll: false });
  };

  const closeDetail = () => {
    setSelectedId(null);
    setEditOnOpen(false);
    router.replace("/admin/recruiters", { scroll: false });
  };

  const handleExpandChange = (id: string | null) => {
    if (id) {
      router.replace(buildRecruiterUrl({ expanded: id }), { scroll: false });
    } else {
      router.replace("/admin/recruiters", { scroll: false });
    }
  };

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
        <RecruiterList
          recruiters={recruiters}
          onSelect={(id) => openRecruiter(id)}
          onEdit={(id) => openRecruiter(id, true)}
          initialExpandedId={urlState.expanded}
          restoreFilters={urlState.filters}
          restoreCandidateId={urlState.candidate}
          onExpandChange={handleExpandChange}
        />
      </div>

      {/* ── Recruiter detail slide-over ── */}
      <SlideOver open={!!selectedId} onClose={closeDetail} maxWidth="max-w-4xl">
        {selectedRecruiter && (
          <RecruiterDetail
            key={`${selectedRecruiter.id}-${editOnOpen ? "edit" : "view"}`}
            recruiter={selectedRecruiter}
            roles={roles}
            initialEditing={editOnOpen}
            restoreFilters={urlState.detail === selectedRecruiter.id && urlState.filters}
            restoreCandidateId={urlState.detail === selectedRecruiter.id ? urlState.candidate : undefined}
          />
        )}
      </SlideOver>

      {/* ── Add Recruiter slide-over ── */}
      <SlideOver open={showAdd} onClose={() => setShowAdd(false)} maxWidth="max-w-3xl">
        <OnboardRecruiterForm roles={roles} onSuccess={() => setShowAdd(false)} />
      </SlideOver>
    </>
  );
}
