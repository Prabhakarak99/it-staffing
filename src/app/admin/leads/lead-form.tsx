"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toast, useToast } from "@/components/ui/toast";
import {
  SlideFormBody,
  SlideFormFooter,
  SlideFormHeader,
  SlideFormSection,
  SlideFormShell,
} from "@/components/forms/compact-slide-form";
import { GraduationCap, Loader2, MessageSquare, UserPlus, Users } from "lucide-react";
import { LEAD_STATUSES, LEAD_VISA_STATUSES, US_STATES, type LeadRow } from "@/lib/leads/fields";

type FormState = {
  consultantName: string;
  phoneNumber: string;
  email: string;
  visaStatus: string;
  university: string;
  state: string;
  /** yyyy-mm-dd */
  optStartDate: string;
  status: string;
  comments: string;
};

const EMPTY: FormState = {
  consultantName: "",
  phoneNumber: "",
  email: "",
  visaStatus: "",
  university: "",
  state: "",
  optStartDate: "",
  status: "Interested",
  comments: "",
};

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20";

function SelectField({ label, value, options, placeholder, onChange }: {
  label: string;
  value: string;
  options: readonly string[];
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={SELECT_CLASS}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {/* Keep a saved value that is no longer in the list */}
        {value && !options.includes(value) && <option value={value}>{value}</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

/** Form values from a saved lead */
export function leadToForm(lead: LeadRow): Partial<FormState> {
  return {
    consultantName: lead.consultantName,
    phoneNumber: lead.phoneNumber ?? "",
    email: lead.email,
    visaStatus: lead.visaStatus ?? "",
    university: lead.university ?? "",
    state: lead.state ?? "",
    optStartDate: lead.optStartDate ? lead.optStartDate.slice(0, 10) : "",
    status: lead.status,
    comments: lead.comments ?? "",
  };
}

export function LeadForm({
  leadId,
  initialData,
  onSuccess,
  onCancel,
}: {
  leadId?: string;
  initialData?: Partial<FormState> | null;
  onSuccess?: (lead?: LeadRow) => void;
  onCancel?: () => void;
} = {}) {
  const [form, setForm] = useState<FormState>(() => ({ ...EMPTY, ...(initialData ?? {}) }));
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast, show, hide } = useToast();

  const set = (key: keyof FormState) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    startTransition(async () => {
      try {
        const res = await fetch(leadId ? `/api/leads/${leadId}` : "/api/leads", {
          method: leadId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Failed to ${leadId ? "update" : "save"} lead`);
        show(`Lead ${leadId ? "updated" : "saved"}${data.consultantName ? ` for ${data.consultantName}` : ""}`, "success");
        if (!leadId) setForm(EMPTY);
        onSuccess?.(data);
        router.refresh();
      } catch (err) {
        show(err instanceof Error ? err.message : "Failed to save lead", "error");
      }
    });
  };

  return (
    <SlideFormShell>
      <SlideFormHeader
        icon={UserPlus}
        title={leadId ? "Edit Lead" : "New Lead"}
        subtitle={leadId ? "Update consultant lead details" : "Add a new consultant lead"}
        tone="sky"
      />

      <SlideFormBody>
        <SlideFormSection icon={Users} title="Contact Details" color="blue">
          <Input
            compact
            label="Full Name"
            value={form.consultantName}
            onChange={(e) => set("consultantName")(e.target.value)}
            placeholder="Enter full name"
          />

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              compact
              label="Contact Number"
              value={form.phoneNumber}
              onChange={(e) => set("phoneNumber")(e.target.value)}
              placeholder="Enter contact number"
            />
            <Input
              compact
              label="Email ID"
              type="email"
              value={form.email}
              onChange={(e) => set("email")(e.target.value)}
              placeholder="Enter email"
            />
          </div>
        </SlideFormSection>

        <SlideFormSection icon={GraduationCap} title="Visa & Education" color="indigo">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <SelectField label="Visa Status" value={form.visaStatus} options={LEAD_VISA_STATUSES} placeholder="Select visa status" onChange={set("visaStatus")} />
            <Input
              compact
              label="OPT Start Date"
              type="date"
              value={form.optStartDate}
              onChange={(e) => set("optStartDate")(e.target.value)}
            />
            <Input
              compact
              label="University"
              value={form.university}
              onChange={(e) => set("university")(e.target.value)}
              placeholder="Enter university"
            />
            <SelectField label="State" value={form.state} options={US_STATES} placeholder="Select state" onChange={set("state")} />
          </div>
        </SlideFormSection>

        <SlideFormSection icon={MessageSquare} title="Status & Comments" color="slate">
          <SelectField label="Status" value={form.status} options={LEAD_STATUSES} onChange={set("status")} />
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Comments</label>
            <textarea
              rows={5}
              value={form.comments}
              onChange={(e) => set("comments")(e.target.value)}
              placeholder="Add notes about this lead..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
            />
          </div>
        </SlideFormSection>
      </SlideFormBody>

      <SlideFormFooter>
        {onCancel && (
          <Button variant="outline" size="sm" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
        )}
        <Button size="sm" onClick={submit} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          {isPending ? "Saving..." : leadId ? "Save Changes" : "Save Lead"}
        </Button>
      </SlideFormFooter>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </SlideFormShell>
  );
}
