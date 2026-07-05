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
  SlideFormSection,
  SlideFormSections,
  SlideFormShell,
} from "@/components/forms/compact-slide-form";
import { cn } from "@/lib/utils";
import { Loader2, Pencil, Phone, Shield, Users } from "lucide-react";
import type { Role } from "@/generated/prisma/client";
import type { RecruiterUser } from "./recruiter-list";
import { RecruiterAssignedCandidates } from "./recruiter-assigned-candidates";

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

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function fmtDate(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { dateStyle: "medium" });
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-800 break-words">{value?.trim() || "—"}</p>
    </div>
  );
}

export function RecruiterDetail({
  recruiter,
  roles,
  initialEditing = false,
  onUpdated,
  restoreFilters,
  restoreCandidateId,
}: {
  recruiter: RecruiterUser;
  roles: Role[];
  initialEditing?: boolean;
  onUpdated?: () => void;
  restoreFilters?: boolean;
  restoreCandidateId?: string;
}) {
  const router = useRouter();
  const { toast, show, hide } = useToast();
  const [editing, setEditing] = useState(initialEditing);
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
    setEditing(initialEditing);
  }, [initialEditing, recruiter.id]);

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

  const name = `${recruiter.firstName} ${recruiter.lastName}`;
  const active = Boolean(recruiter.isActive);

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
      setEditing(false);
      router.refresh();
      onUpdated?.();
    } catch (err: unknown) {
      show(err instanceof Error ? err.message : "Update failed", "error");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
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
          <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
          <Button onClick={saveEdit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </SlideFormFooter>
        {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
      </SlideFormShell>
    );
  }

  return (
    <SlideFormShell>
      <SlideFormHeader
        icon={Users}
        title={name}
        subtitle={`${recruiter.email} · ${recruiter.assignedCandidates.length} assigned candidate${recruiter.assignedCandidates.length === 1 ? "" : "s"}`}
        tone="emerald"
        badge={
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-[11px] font-bold text-white">
            {initials(name)}
          </div>
        }
        actions={
          <Button size="sm" variant="secondary" className="bg-white/15 text-white border-white/20 hover:bg-white/25" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        }
      />

      <SlideFormBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className={cn("rounded-full px-2 py-0.5 font-semibold", active ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
            {active ? "Active" : "Pending"}
          </span>
          {recruiter.role && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-semibold text-indigo-700">{recruiter.role.name}</span>
          )}
          {recruiter.phoneNumber && (
            <span className="inline-flex items-center gap-1 text-slate-500"><Phone className="h-3 w-3" />{recruiter.phoneNumber}</span>
          )}
          {recruiter.businessNumber && (
            <span className="text-slate-400">BN: {recruiter.businessNumber}</span>
          )}
          <span className="text-slate-400">Since {fmtDate(recruiter.startDate)}</span>
        </div>

        <SlideFormSections>
          <SlideFormSection icon={Users} title="Contact" color="emerald">
            <div className="grid grid-cols-2 gap-2">
              <DetailField label="Email" value={recruiter.email} />
              <DetailField label="Phone" value={recruiter.phoneNumber} />
              <DetailField label="Business #" value={recruiter.businessNumber} />
              <DetailField label="Address" value={recruiter.fullAddress} />
            </div>
          </SlideFormSection>

          <SlideFormSection icon={Shield} title="Role & Period" color="indigo">
            <div className="grid grid-cols-2 gap-2">
              <DetailField label="Role" value={recruiter.role?.name ?? null} />
              <DetailField label="Start" value={fmtDate(recruiter.startDate)} />
              <DetailField label="End" value={fmtDate(recruiter.endDate)} />
            </div>
          </SlideFormSection>
        </SlideFormSections>

        <RecruiterAssignedCandidates
          recruiterId={recruiter.id}
          assignedCandidates={recruiter.assignedCandidates}
          variant="panel"
          initialFiltersOpen={restoreFilters}
          initialCandidateId={restoreCandidateId}
        />
      </SlideFormBody>

      <SlideFormFooter>
        <Button size="sm" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" />
          Edit Recruiter
        </Button>
      </SlideFormFooter>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </SlideFormShell>
  );
}
