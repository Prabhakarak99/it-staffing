"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { Loader2, Mail, Shield, UserPlus } from "lucide-react";
import type { Role } from "@/generated/prisma/client";
import { isValidEmail, validateOptionalPhone } from "@/lib/validators";

interface Props { roles: Role[]; onSuccess?: () => void; }

const EMPTY = {
  firstName: "", lastName: "", email: "",
  phoneNumber: "", businessNumber: "",
  startDate: "", endDate: "", roleId: "",
};

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

export function OnboardRecruiterForm({ roles, onSuccess }: Props) {
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
    const bizErr = validateOptionalPhone(form.businessNumber);
    if (bizErr) errs.businessNumber = bizErr;
    if (!form.startDate) errs.startDate = "Required";
    return errs;
  };

  const submit = () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    startTransition(async () => {
      try {
        const payload = new FormData();
        Object.entries(form).forEach(([key, value]) => payload.append(key, value));
        const res = await fetch("/api/recruiters", {
          method: "POST",
          body: payload,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to onboard recruiter");
        if (data.emailError) {
          show(`Recruiter added, but email failed: ${data.emailError}`, "error");
        } else {
          show(`Recruiter onboarded! Activation email sent to ${form.email}`, "success");
        }
        setForm(EMPTY);
        router.refresh();
        onSuccess?.();
      } catch (err: unknown) {
        show(err instanceof Error ? err.message : "Error onboarding recruiter", "error");
      }
    });
  };

  const fullName = [form.firstName, form.lastName].filter(Boolean).join(" ");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Gradient header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute -left-4 bottom-0 h-16 w-16 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm shadow-inner">
            <UserPlus className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-white">Onboard New Recruiter</h2>
            <p className="text-sm text-white/70">Create account and send activation email</p>
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
        {/* Email notification banner */}
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100">
            <Mail className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-900">Activation email will be sent automatically</p>
            <p className="text-xs text-blue-700 mt-0.5">
              The recruiter will receive an email at{" "}
              <span className="font-semibold">{form.email || "their email address"}</span>{" "}
              to set their password and activate their account.
            </p>
          </div>
        </div>

        {/* Identity */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2.5 rounded-t-xl border-b border-emerald-100 bg-emerald-50 px-4 py-3">
            <UserPlus className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Personal Details</span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Input compact id="rec-firstName" label="First Name *" placeholder="Jane" value={form.firstName} onChange={set("firstName")} error={errors.firstName} />
              <Input compact id="rec-lastName" label="Last Name *" placeholder="Smith" value={form.lastName} onChange={set("lastName")} error={errors.lastName} />
              <Input compact id="rec-email" label="Email *" type="email" placeholder="jane@company.com" value={form.email} onChange={set("email")} error={errors.email} />
              <Input compact id="rec-phone" label="Phone Number" type="tel" placeholder="555-000-0000" value={form.phoneNumber} onChange={set("phoneNumber")} error={errors.phoneNumber} />
              <Input compact id="rec-business" label="Business Number" type="tel" placeholder="555-000-0000" value={form.businessNumber} onChange={set("businessNumber")} error={errors.businessNumber} />
            </div>
          </div>
        </div>

        {/* Role & Employment */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2.5 rounded-t-xl border-b border-blue-100 bg-blue-50 px-4 py-3">
            <Shield className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Role & Employment</span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {/* Role selector as pills */}
              <div className="flex flex-col gap-2 lg:col-span-3">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</label>
                <div className="flex flex-wrap gap-1.5">
                  {roles.map((r) => (
                    <button key={r.id} type="button"
                      onClick={() => setForm((p) => ({ ...p, roleId: p.roleId === r.id ? "" : r.id }))}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-semibold transition-all",
                        form.roleId === r.id
                          ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50"
                      )}>
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>
              <Input compact id="rec-start" label="Start Date *" type="date" value={form.startDate} onChange={set("startDate")} error={errors.startDate} />
              <Input compact id="rec-end" label="End Date" type="date" value={form.endDate} onChange={set("endDate")} />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={submit} disabled={isPending} className="px-8">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {isPending ? "Onboarding…" : "Onboard & Send Activation Email"}
          </Button>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  );
}
