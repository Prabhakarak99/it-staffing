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
  const [editId, setEditId] = useState<string | null>(urlState.edit ?? null);

  useEffect(() => {
    setEditId(urlState.edit ?? null);
  }, [urlState.edit]);

  const editRecruiter = editId ? recruiters.find((r) => r.id === editId) : null;

  const openEdit = (id: string) => {
    setEditId(id);
    router.replace(buildRecruiterUrl({ ...urlState, edit: id }), { scroll: false });
  };

  const closeEdit = () => {
    setEditId(null);
    const { edit: _edit, ...rest } = urlState;
    router.replace(buildRecruiterUrl(rest), { scroll: false });
  };

  const handleExpandChange = (id: string | null) => {
    if (id) {
      router.replace(buildRecruiterUrl({ ...urlState, expanded: id, edit: undefined }), { scroll: false });
    } else {
      router.replace(buildRecruiterUrl({ ...urlState, expanded: undefined, edit: undefined }), { scroll: false });
    }
  };

  return (
    <>
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

      <div className="p-6">
        <RecruiterList
          recruiters={recruiters}
          onEdit={openEdit}
          initialExpandedId={urlState.expanded}
          restoreFilters={urlState.filters}
          restoreCandidateId={urlState.candidate}
          onExpandChange={handleExpandChange}
        />
      </div>

      <SlideOver open={!!editId} onClose={closeEdit} maxWidth="max-w-3xl">
        {editRecruiter && (
          <RecruiterDetail
            key={editRecruiter.id}
            recruiter={editRecruiter}
            roles={roles}
            onCancel={closeEdit}
            onUpdated={closeEdit}
          />
        )}
      </SlideOver>

      <SlideOver open={showAdd} onClose={() => setShowAdd(false)} maxWidth="max-w-3xl">
        <OnboardRecruiterForm roles={roles} onSuccess={() => setShowAdd(false)} />
      </SlideOver>
    </>
  );
}
