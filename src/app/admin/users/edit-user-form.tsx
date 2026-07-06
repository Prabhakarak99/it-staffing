"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { Loader2, Pencil, Shield, User } from "lucide-react";
import type { Role } from "@/generated/prisma/client";
import { isValidEmail, validateOptionalPhone } from "@/lib/validators";
import {
  SlideFormBody, SlideFormFooter, SlideFormHeader, SlideFormSection, SlideFormShell,
} from "@/components/forms/compact-slide-form";

type UserData = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
  isActive: boolean;
  roleId: string | null;
};

interface Props {
  roles: Role[];
  userId: string;
  initialData?: UserData | null;
  onCancel?: () => void;
  onSuccess?: () => void;
}

export function EditUserForm({ roles, userId, initialData, onCancel, onSuccess }: Props) {
  const [form, setForm] = useState({
    firstName: initialData?.firstName ?? "",
    lastName: initialData?.lastName ?? "",
    email: initialData?.email ?? "",
    phoneNumber: initialData?.phoneNumber ?? "",
    roleId: initialData?.roleId ?? "",
    isActive: initialData?.isActive ? "true" : "false",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [isPending, startTransition] = useTransition();
  const { toast, show, hide } = useToast();
  const router = useRouter();

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const validate = () => {
    const errs: Partial<Record<keyof typeof form, string>> = {};
    if (!form.firstName.trim()) errs.firstName = "Required";
    if (!form.lastName.trim()) errs.lastName = "Required";
    if (!form.email.trim()) errs.email = "Required";
    else if (!isValidEmail(form.email)) errs.email = "Invalid email address";
    const phoneErr = validateOptionalPhone(form.phoneNumber);
    if (phoneErr) errs.phoneNumber = phoneErr;
    return errs;
  };

  const submit = () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    startTransition(async () => {
      try {
        const res = await fetch(`/api/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            phoneNumber: form.phoneNumber || null,
            roleId: form.roleId || null,
            isActive: form.isActive === "true",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to update user");
        show("User updated successfully", "success");
        router.refresh();
        onSuccess?.();
      } catch (err: unknown) {
        show(err instanceof Error ? err.message : "Error updating user", "error");
      }
    });
  };

  return (
    <SlideFormShell>
      <SlideFormHeader icon={Pencil} title="Edit User" subtitle="Update user details" tone="indigo" />

      <SlideFormBody>
        <SlideFormSection icon={User} title="Personal Details" color="indigo">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input compact id="edit-user-firstName" label="First Name *" value={form.firstName} onChange={set("firstName")} error={errors.firstName} />
            <Input compact id="edit-user-lastName" label="Last Name *" value={form.lastName} onChange={set("lastName")} error={errors.lastName} />
            <Input compact id="edit-user-email" label="Email *" type="email" value={form.email} onChange={set("email")} error={errors.email} />
            <Input compact id="edit-user-phone" label="Phone Number" value={form.phoneNumber} onChange={set("phoneNumber")} error={errors.phoneNumber} />
          </div>
        </SlideFormSection>

        <SlideFormSection icon={Shield} title="Role & Status" color="violet">
          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Role</label>
              <select
                value={form.roleId}
                onChange={set("roleId")}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">Select role</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Status</label>
              <div className="flex gap-2">
                {(["true", "false"] as const).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, isActive: val }))}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold transition-all",
                      form.isActive === val
                        ? val === "true" ? "border-emerald-500 bg-emerald-500 text-white" : "border-amber-500 bg-amber-500 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    )}
                  >
                    {val === "true" ? "Active" : "Pending"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SlideFormSection>
      </SlideFormBody>

      <SlideFormFooter>
        {onCancel && (
          <Button variant="outline" size="sm" onClick={onCancel} disabled={isPending}>Cancel</Button>
        )}
        <Button size="sm" onClick={submit} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
          {isPending ? "Saving…" : "Save Changes"}
        </Button>
      </SlideFormFooter>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </SlideFormShell>
  );
}
