"use client";

import { useEffect, useState } from "react";
import { Plus, Users } from "lucide-react";
import { SlideOver } from "@/components/ui/slide-over";
import { LeadForm } from "./lead-form";
import { LeadList } from "./lead-list";
import { LeadDetail } from "./lead-detail";

interface Lead {
  id: string;
  consultantId: string | null;
  consultantName: string;
  phoneNumber: string | null;
  email: string;
  comments: string | null;
  createdAt: string;
  updatedAt: string;
}

function normalizeLead(lead: {
  id: string;
  consultantId: string | null;
  consultantName: string;
  phoneNumber: string | null;
  email: string;
  comments: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}): Lead {
  return {
    ...lead,
    createdAt: typeof lead.createdAt === "string" ? lead.createdAt : new Date(lead.createdAt).toISOString(),
    updatedAt: typeof lead.updatedAt === "string" ? lead.updatedAt : new Date(lead.updatedAt).toISOString(),
  };
}

export function LeadsView({ leads: initialLeads }: { leads: Lead[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [leads, setLeads] = useState(initialLeads);

  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  const handleLeadSaved = (saved: {
    id: string;
    consultantId?: string | null;
    consultantName: string;
    phoneNumber?: string | null;
    email: string;
    comments?: string | null;
    createdAt: string | Date;
    updatedAt: string | Date;
  }) => {
    const lead = normalizeLead({
      consultantId: saved.consultantId ?? null,
      comments: saved.comments ?? null,
      phoneNumber: saved.phoneNumber ?? null,
      ...saved,
    });
    setLeads((prev) => {
      const exists = prev.some((l) => l.id === lead.id);
      if (exists) return prev.map((l) => (l.id === lead.id ? { ...l, ...lead } : l));
      return [lead, ...prev];
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
                {leads.length} lead{leads.length !== 1 ? "s" : ""} linked to consultants
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAdd(true)}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[13px] font-bold text-sky-700 shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
          >
            <Plus className="h-4 w-4" />
            Add New Lead
          </button>
        </div>
      </div>

      <div className="p-6">
        <LeadList leads={leads} onSelect={setSelectedId} onLeadsChange={setLeads} />
      </div>

      <SlideOver open={!!selectedId} onClose={() => setSelectedId(null)} maxWidth="max-w-4xl">
        {selectedId && (
          <LeadDetail
            leadId={selectedId}
            onLeadUpdated={handleLeadSaved}
          />
        )}
      </SlideOver>

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
