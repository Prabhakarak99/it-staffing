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
import { Loader2, UserPlus, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type FormState = {
  consultantName: string;
  phoneNumber: string;
  email: string;
  comments: string;
};

const EMPTY: FormState = {
  consultantName: "",
  phoneNumber: "",
  email: "",
  comments: "",
};

export function LeadForm({
  leadId,
  initialData,
  onSuccess,
  onCancel,
}: {
  leadId?: string;
  initialData?: Partial<FormState> | null;
  onSuccess?: () => void;
  onCancel?: () => void;
} = {}) {
  const [form, setForm] = useState<FormState>(() => ({
    ...EMPTY,
    ...(initialData ? {
      consultantName: initialData.consultantName ?? "",
      phoneNumber: initialData.phoneNumber ?? "",
      email: initialData.email ?? "",
      comments: initialData.comments ?? "",
    } : {}),
  }));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast, show, hide } = useToast();

  const submit = () => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.consultantName.trim()) nextErrors.consultantName = "Consultant name is required";
    if (!form.email.trim()) nextErrors.email = "Email is required";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    startTransition(async () => {
      try {
        const res = await fetch(leadId ? `/api/leads/${leadId}` : "/api/leads", {
          method: leadId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consultantName: form.consultantName,
            phoneNumber: form.phoneNumber,
            email: form.email,
            comments: form.comments,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Failed to ${leadId ? "update" : "save"} lead`);
        show(`Lead ${leadId ? "updated" : "saved"} for ${data.consultantName ?? form.consultantName}`, "success");
        if (!leadId) setForm(EMPTY);
        onSuccess?.();
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
        subtitle={leadId ? "Update consultant lead details" : "Create or update a consultant lead"}
        tone="sky"
      />

      <SlideFormBody>
        <SlideFormSection icon={Users} title="Consultant Details" color="blue">
          <Input
            compact
            label="Consultant Name *"
            value={form.consultantName}
            onChange={(e) => setForm((prev) => ({ ...prev, consultantName: e.target.value }))}
            placeholder="Enter consultant name"
            error={errors.consultantName}
          />

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              compact
              label="Phone Number"
              value={form.phoneNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
              placeholder="Enter phone number"
            />
            <Input
              compact
              label="Email *"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="Enter email"
              error={errors.email}
            />
          </div>
        </SlideFormSection>

        <SlideFormSection icon={UserPlus} title="Lead Notes" color="indigo">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Comments *
            </label>
            <textarea
              rows={6}
              value={form.comments}
              onChange={(e) => setForm((prev) => ({ ...prev, comments: e.target.value }))}
              placeholder="Add notes about this lead..."
              className={cn(
                "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20",
                errors.comments && "border-rose-400"
              )}
            />
            {errors.comments && <p className="text-xs text-rose-500">{errors.comments}</p>}
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
