"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Pencil, Phone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SlideFormBody, SlideFormFooter, SlideFormHeader, SlideFormSection,
  SlideFormSections, SlideFormShell,
} from "@/components/forms/compact-slide-form";
import { LeadForm } from "./lead-form";

type LeadRecord = {
  id: string;
  consultantId: string | null;
  consultantName: string;
  phoneNumber: string | null;
  email: string;
  comments: string | null;
  createdAt: string;
  updatedAt: string;
};

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-800 break-words">{value?.trim() || "—"}</p>
    </div>
  );
}

export function LeadDetail({
  leadId,
  onLeadUpdated,
}: {
  leadId: string;
  onLeadUpdated?: (lead: LeadRecord) => void;
}) {
  const router = useRouter();
  const [lead, setLead] = useState<LeadRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/leads/${leadId}`);
      if (!res.ok) throw new Error("Failed to load lead");
      setLead(await res.json());
    } catch {
      setError("Could not load lead details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/leads/${leadId}`);
        if (!res.ok) throw new Error("Failed to load lead");
        const data = await res.json();
        if (!cancelled) setLead(data);
      } catch {
        if (!cancelled) setError("Could not load lead details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [leadId]);

  if (editing && lead) {
    return (
      <LeadForm
        leadId={leadId}
        initialData={{
          consultantName: lead.consultantName,
          phoneNumber: lead.phoneNumber ?? "",
          email: lead.email,
          comments: lead.comments ?? "",
        }}
        onCancel={() => setEditing(false)}
        onSuccess={(saved) => {
          setEditing(false);
          if (saved) {
            setLead(saved as LeadRecord);
            onLeadUpdated?.(saved as LeadRecord);
          } else {
            load();
          }
          router.refresh();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="flex min-h-[280px] items-center justify-center p-8 text-center">
        <p className="text-sm font-medium text-rose-600">{error || "Lead not found"}</p>
      </div>
    );
  }

  return (
    <SlideFormShell>
      <SlideFormHeader
        icon={Users}
        title={lead.consultantName}
        subtitle={`${lead.email} · Created ${fmtDate(lead.createdAt)}`}
        tone="sky"
        actions={
          <Button size="sm" variant="secondary" className="bg-white/15 text-white border-white/20 hover:bg-white/25" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        }
      />

      <SlideFormBody>
        <SlideFormSections>
          <SlideFormSection icon={Users} title="Consultant Details" color="blue">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <DetailField label="Consultant Name" value={lead.consultantName} />
              <DetailField label="Email" value={lead.email} />
              <DetailField label="Phone Number" value={lead.phoneNumber} />
            </div>
          </SlideFormSection>

          <SlideFormSection icon={Mail} title="Lead Notes" color="indigo" className="xl:col-span-2">
            {lead.comments ? (
              <p className="whitespace-pre-wrap text-[13.8px] leading-relaxed text-slate-600">{lead.comments}</p>
            ) : (
              <p className="text-xs text-slate-400">No comments added.</p>
            )}
          </SlideFormSection>

          <SlideFormSection icon={Phone} title="Timeline" color="slate">
            <div className="grid grid-cols-2 gap-2">
              <DetailField label="Created" value={fmtDate(lead.createdAt)} />
              <DetailField label="Last Updated" value={fmtDate(lead.updatedAt)} />
            </div>
          </SlideFormSection>
        </SlideFormSections>
      </SlideFormBody>

      <SlideFormFooter>
        <Button size="sm" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" />
          Edit Lead
        </Button>
      </SlideFormFooter>
    </SlideFormShell>
  );
}
