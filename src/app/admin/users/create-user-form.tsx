"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { UserPlus, Loader2, Shield, Mail, Lock } from "lucide-react";
import type { Role } from "@/generated/prisma/client";
import { isValidEmail, validateOptionalPhone, validatePassword } from "@/lib/validators";

interface Props { roles: Role[]; onSuccess?: () => void; }

const EMPTY = {
  firstName: "", lastName: "", email: "", phoneNumber: "",
  password: "", roleId: "", isActive: "false",
};

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

export function CreateUserForm({ roles, onSuccess }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<typeof EMPTY>>({});
  const [isPending, startTransition] = useTransition();
  const { toast, show, hide } = useToast();
  const router = useRouter();

  const set = (field: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const validate = () => {
    const errs: Partial<typeof EMPTY> = {};
    if (!form.firstName.trim()) errs.firstName = "Required";
    if (!form.lastName.trim()) errs.lastName = "Required";
    if (!form.email.trim()) errs.email = "Required";
    else if (!isValidEmail(form.email)) errs.email = "Invalid email address";
    const phoneErr = validateOptionalPhone(form.phoneNumber);
    if (phoneErr) errs.phoneNumber = phoneErr;
    const passErr = validatePassword(form.password);
    if (passErr) errs.password = passErr;
    return errs;
  };

  const submit = () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    startTransition(async () => {
      try {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to create user");
        if (data.emailError) {
          show(`User created, but email failed: ${data.emailError}`, "error");
        } else if (data.emailSent) {
          show("User created! Activation email sent successfully.", "success");
        } else {
          show("User created with Active status (no email needed).", "success");
        }
        setForm(EMPTY);
        router.refresh();
        onSuccess?.();
      } catch (err: unknown) {
        show(err instanceof Error ? err.message : "Error creating user", "error");
      }
    });
  };

  const fullName = [form.firstName, form.lastName].filter(Boolean).join(" ");
  const isActive = form.isActive === "true";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Gradient header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute -left-4 bottom-0 h-16 w-16 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm shadow-inner">
            <UserPlus className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-white">Create New User</h2>
            <p className="text-sm text-white/70">Create a system user account with role assignment</p>
          </div>
          {fullName && (
            <div className="ml-auto flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[9px] font-bold text-white">
                {initials(form.firstName || "?", form.lastName || "?")}
              </div>
              <span className="text-xs font-semibold text-white">{fullName}</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">

        {/* Identity */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2.5 rounded-t-xl border-b border-violet-100 bg-violet-50 px-4 py-3">
            <UserPlus className="h-4 w-4 text-violet-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Identity</span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Input compact id="firstName" label="First Name *" placeholder="John" value={form.firstName} onChange={set("firstName")} error={errors.firstName} />
              <Input compact id="lastName" label="Last Name *" placeholder="Doe" value={form.lastName} onChange={set("lastName")} error={errors.lastName} />
              <Input compact id="email" label="Email *" type="email" placeholder="john@example.com" value={form.email} onChange={set("email")} error={errors.email} />
              <Input compact id="phoneNumber" label="Phone Number" type="tel" placeholder="555-000-0000" value={form.phoneNumber} onChange={set("phoneNumber")} error={errors.phoneNumber} />
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2.5 rounded-t-xl border-b border-indigo-100 bg-indigo-50 px-4 py-3">
            <Lock className="h-4 w-4 text-indigo-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Security</span>
          </div>
          <div className="p-4">
            <div className="max-w-sm">
              <Input compact id="password" label="Password *" type="password" placeholder="Min 8 characters" value={form.password} onChange={set("password")} error={errors.password} />
            </div>
          </div>
        </div>

        {/* Role & Status */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2.5 rounded-t-xl border-b border-blue-100 bg-blue-50 px-4 py-3">
            <Shield className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Role & Access</span>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Role</label>
              <div className="flex flex-wrap gap-2">
                {roles.map((r) => (
                  <button key={r.id} type="button"
                    onClick={() => setForm((p) => ({ ...p, roleId: p.roleId === r.id ? "" : r.id }))}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold transition-all",
                      form.roleId === r.id
                        ? "border-indigo-500 bg-indigo-500 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50"
                    )}>{r.name}</button>
                ))}
              </div>
            </div>

            {/* Active Status toggle */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Activation Status</label>
              <div className="flex gap-3">
                <button type="button"
                  onClick={() => setForm((p) => ({ ...p, isActive: "false" }))}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-4 py-3 text-left transition-all",
                    !isActive
                      ? "border-amber-400 bg-amber-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  )}>
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", !isActive ? "bg-amber-100" : "bg-slate-100")}>
                    <Mail className={cn("h-4 w-4", !isActive ? "text-amber-600" : "text-slate-400")} />
                  </div>
                  <div>
                    <p className={cn("text-xs font-bold", !isActive ? "text-amber-800" : "text-slate-600")}>Pending Activation</p>
                    <p className="text-[10px] text-slate-400">Sends activation email</p>
                  </div>
                </button>
                <button type="button"
                  onClick={() => setForm((p) => ({ ...p, isActive: "true" }))}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-4 py-3 text-left transition-all",
                    isActive
                      ? "border-emerald-400 bg-emerald-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  )}>
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", isActive ? "bg-emerald-100" : "bg-slate-100")}>
                    <Shield className={cn("h-4 w-4", isActive ? "text-emerald-600" : "text-slate-400")} />
                  </div>
                  <div>
                    <p className={cn("text-xs font-bold", isActive ? "text-emerald-800" : "text-slate-600")}>Active</p>
                    <p className="text-[10px] text-slate-400">No email needed</p>
                  </div>
                </button>
              </div>
              {!isActive && form.email && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600">
                  <Mail className="h-3.5 w-3.5" />
                  Activation email will be sent to <strong>{form.email}</strong>
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={submit} disabled={isPending} className="px-8">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {isPending ? "Creating…" : "Create User & Send Email"}
          </Button>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  );
}
