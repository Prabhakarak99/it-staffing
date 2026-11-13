"use client";

import { useEffect, useState } from "react";
import { Plus, Upload, Users } from "lucide-react";
import { LeadImportDialog } from "./lead-import";
import { SlideOver } from "@/components/ui/slide-over";
import { LeadForm } from "./lead-form";
import { LeadList } from "./lead-list";
import { LeadDetail } from "./lead-detail";
import type { LeadRow } from "@/lib/leads/fields";

export function LeadsView({ leads: initialLeads, showOwner }: { leads: LeadRow[]; showOwner: boolean }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [leads, setLeads] = useState(initialLeads);

  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  // API responses are JSON, so dates are already ISO strings; keep the owner name the server added
  const handleLeadSaved = (saved: LeadRow) => {
    setLeads((prev) => {
      const existing = prev.find((l) => l.id === saved.id);
      if (existing) return prev.map((l) => (l.id === saved.id ? { ...existing, ...saved } : l));
      return [saved, ...prev];
    });
  };

  return (
    <>
      <div className="relative overflow-hidden bg-gradient-to-r from-cyan-600 via-sky-600 to-indigo-700 px-6 py-5">
        <div className="absolute -right-6 -top-6 h-36 w-36 rounded-full bg-white/[0.05]" />
        <div className="absolute left-1/2 bottom-0 h-20 w-20 rounded-full bg-white/[0.04]" />

        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-white">Leads</h1>
              <p className="mt-0.5 text-[12px] text-white/65">
                {leads.length} lead{leads.length !== 1 ? "s" : ""} {showOwner ? "from all team members" : "added by you"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-4 py-2.5 text-[13px] font-bold text-white transition-all hover:bg-white/20"
            >
              <Upload className="h-4 w-4" />
              Upload Excel / Sheet
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[13px] font-bold text-sky-700 shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
            >
              <Plus className="h-4 w-4" />
              Add New Lead
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <LeadList leads={leads} showOwner={showOwner} onSelect={setSelectedId} onLeadsChange={setLeads} />
      </div>

      <SlideOver open={!!selectedId} onClose={() => setSelectedId(null)} maxWidth="max-w-4xl">
        {selectedId && (
          <LeadDetail
            leadId={selectedId}
            onLeadUpdated={handleLeadSaved}
          />
        )}
      </SlideOver>

      {showImport && <LeadImportDialog onClose={() => setShowImport(false)} />}

      <SlideOver open={showAdd} onClose={() => setShowAdd(false)} maxWidth="max-w-4xl">
        <LeadForm
          onCancel={() => setShowAdd(false)}
          onSuccess={(saved) => {
            if (saved) handleLeadSaved(saved);
            setShowAdd(false);
          }}
        />
      </SlideOver>
    </>
  );
}
