"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Toast, useToast } from "@/components/ui/toast";
import {
  SlideFormBody,
  SlideFormFooter,
  SlideFormHeader,
  SlideFormShell,
} from "@/components/forms/compact-slide-form";
import { Loader2, Pencil } from "lucide-react";
import type { Role } from "@/generated/prisma/client";
import type { RecruiterUser } from "./recruiter-list";

interface EditForm {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  businessNumber: string;
  roleId: string;
  startDate: string;
  endDate: string;
}

function toDateInput(d: Date | string | null): string {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

export function RecruiterDetail({
  recruiter,
  roles,
  onCancel,
  onUpdated,
}: {
  recruiter: RecruiterUser;
  roles: Role[];
  onCancel?: () => void;
  onUpdated?: () => void;
}) {
  const router = useRouter();
  const { toast, show, hide } = useToast();
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    firstName: recruiter.firstName,
    lastName: recruiter.lastName,
    phoneNumber: recruiter.phoneNumber ?? "",
    businessNumber: recruiter.businessNumber ?? "",
    roleId: recruiter.roleId ?? "",
    startDate: toDateInput(recruiter.startDate),
    endDate: toDateInput(recruiter.endDate),
  });

  useEffect(() => {
    setEditForm({
      firstName: recruiter.firstName,
      lastName: recruiter.lastName,
      phoneNumber: recruiter.phoneNumber ?? "",
      businessNumber: recruiter.businessNumber ?? "",
      roleId: recruiter.roleId ?? "",
      startDate: toDateInput(recruiter.startDate),
      endDate: toDateInput(recruiter.endDate),
    });
  }, [recruiter]);

  const setField = (field: keyof EditForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setEditForm((prev) => ({ ...prev, [field]: e.target.value }));

  const saveEdit = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/recruiters/${recruiter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          phoneNumber: editForm.phoneNumber || null,
          businessNumber: editForm.businessNumber || null,
          roleId: editForm.roleId || null,
          startDate: editForm.startDate || null,
          endDate: editForm.endDate || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to update recruiter");
      show("Recruiter updated successfully", "success");
      router.refresh();
      onUpdated?.();
    } catch (err: unknown) {
      show(err instanceof Error ? err.message : "Update failed", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SlideFormShell>
      <SlideFormHeader
        icon={Pencil}
        title="Edit Recruiter"
        subtitle={recruiter.email}
        tone="emerald"
      />
      <SlideFormBody>
        <div className="grid grid-cols-2 gap-4">
          <Input id="edit-firstName" label="First Name *" value={editForm.firstName} onChange={setField("firstName")} />
          <Input id="edit-lastName" label="Last Name *" value={editForm.lastName} onChange={setField("lastName")} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input id="edit-phone" label="Phone Number" placeholder="+1 555-000-0000" value={editForm.phoneNumber} onChange={setField("phoneNumber")} />
          <Input id="edit-business" label="Business Number" placeholder="Business phone" value={editForm.businessNumber} onChange={setField("businessNumber")} />
        </div>
        <Select
          id="edit-role"
          label="Role"
          options={roles.map((rl) => ({ value: rl.id, label: rl.name }))}
          placeholder="Select role"
          value={editForm.roleId}
          onChange={setField("roleId")}
        />
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Start Date</label>
            <input
              type="date"
              value={editForm.startDate}
              onChange={setField("startDate")}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">End Date</label>
            <input
              type="date"
              value={editForm.endDate}
              onChange={setField("endDate")}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
            />
          </div>
        </div>
      </SlideFormBody>
      <SlideFormFooter>
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button onClick={saveEdit} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </SlideFormFooter>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </SlideFormShell>
  );
}
