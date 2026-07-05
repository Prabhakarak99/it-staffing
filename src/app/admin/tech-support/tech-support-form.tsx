"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { Briefcase, Loader2, Globe, Zap, User } from "lucide-react";
import { isValidEmail, isValidPhone } from "@/lib/validators";

const TECHNOLOGIES = [".Net", "Java", "DE", "DS/GenAi/ML", "Devops", "Mainframes", "Networking", "BA", "Sales Force"];
const LOCATIONS = ["USA", "India", "Other"];

const EMPTY = {
  firstName: "", lastName: "", email: "", phoneNumber: "",
  technology: "", location: "", availability: "", amount: "",
};

type FormErrors = Partial<Record<keyof typeof EMPTY, string>>;

function PillChips({ label, value, options, onChange, required, colorMap }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
  required?: boolean; colorMap?: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}{required && " *"}
      </label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button key={opt} type="button" onClick={() => onChange(value === opt ? "" : opt)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition-all",
              value === opt
                ? (colorMap?.[opt] ?? "border-amber-500 bg-amber-500 text-white shadow-sm")
                : "border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:bg-amber-50"
            )}>{opt}</button>
        ))}
      </div>
    </div>
  );
}

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

export function TechSupportForm({
  techSupportId,
  initialData,
  onSuccess,
  onCancel,
}: {
  techSupportId?: string;
  initialData?: Partial<typeof EMPTY> | null;
  onSuccess?: () => void;
  onCancel?: () => void;
} = {}) {
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    ...(initialData ? {
      firstName: initialData.firstName ?? "",
      lastName: initialData.lastName ?? "",
      email: initialData.email ?? "",
      phoneNumber: initialData.phoneNumber ?? "",
      technology: initialData.technology ?? "",
      location: initialData.location ?? "",
      availability: initialData.availability ?? "",
      amount: initialData.amount ?? "",
    } : {}),
  }));
  const [errors, setErrors] = useState<FormErrors>({});
  const [isPending, startTransition] = useTransition();
  const { toast, show, hide } = useToast();
  const router = useRouter();

  const set = (field: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const validate = (): FormErrors => {
    const errs: FormErrors = {};
    if (!form.firstName.trim()) errs.firstName = "Required";
    if (!form.lastName.trim()) errs.lastName = "Required";
    if (!form.email.trim()) errs.email = "Required";
    else if (!isValidEmail(form.email)) errs.email = "Invalid email address";
    if (!form.phoneNumber.trim()) errs.phoneNumber = "Required";
    else if (!isValidPhone(form.phoneNumber)) errs.phoneNumber = "Invalid phone format";
    if (!form.technology) errs.technology = "Required";
    if (!form.location) errs.location = "Required";
    return errs;
  };

  const submit = () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    startTransition(async () => {
      try {
        const res = await fetch(techSupportId ? `/api/tech-support/${techSupportId}` : "/api/tech-support", {
          method: techSupportId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Failed to ${techSupportId ? "update" : "add"} tech support`);
        show(`${form.firstName} ${form.lastName} ${techSupportId ? "updated" : "added"} successfully`, "success");
        if (!techSupportId) setForm(EMPTY);
        router.refresh();
        onSuccess?.();
      } catch (err: unknown) {
        show(err instanceof Error ? err.message : "Error adding tech support", "error");
      }
    });
  };

  const fullName = [form.firstName, form.lastName].filter(Boolean).join(" ");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Gradient header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-3">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute -left-4 bottom-0 h-16 w-16 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm shadow-inner">
            <Briefcase className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-white">{techSupportId ? "Edit Tech Support" : "Add Tech Support"}</h2>
            <p className="text-sm text-white/70">{techSupportId ? "Update expert details" : "Onboard a technical support expert"}</p>
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
          <div className="flex items-center gap-2.5 rounded-t-xl border-b border-amber-100 bg-amber-50 px-4 py-3">
            <User className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Identity & Contact</span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Input compact id="ts-firstName" label="First Name *" placeholder="Jane" value={form.firstName} onChange={set("firstName")} error={errors.firstName} />
              <Input compact id="ts-lastName" label="Last Name *" placeholder="Smith" value={form.lastName} onChange={set("lastName")} error={errors.lastName} />
              <Input compact id="ts-email" label="Email *" type="email" placeholder="jane@company.com" value={form.email} onChange={set("email")} error={errors.email} />
              <Input compact id="ts-phone" label="Phone Number *" type="tel" placeholder="555-000-0000" value={form.phoneNumber} onChange={set("phoneNumber")} error={errors.phoneNumber} />
            </div>
          </div>
        </div>

        {/* Skills */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2.5 rounded-t-xl border-b border-orange-100 bg-orange-50 px-4 py-3">
            <Zap className="h-4 w-4 text-orange-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Skills & Availability</span>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <PillChips label="Technology *" value={form.technology} options={TECHNOLOGIES}
                onChange={(v) => setForm((p) => ({ ...p, technology: v }))} required />
              {errors.technology && <p className="mt-1 text-xs text-rose-500">{errors.technology}</p>}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input compact id="ts-availability" label="Availability (CST Time)" placeholder="e.g. 9 AM – 6 PM CST" value={form.availability} onChange={set("availability")} />
              <Input compact id="ts-amount" label="Amount (USD)" placeholder="e.g. $75/hr" value={form.amount} onChange={set("amount")} />
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2.5 rounded-t-xl border-b border-blue-100 bg-blue-50 px-4 py-3">
            <Globe className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Location</span>
          </div>
          <div className="p-4">
            <div>
              <PillChips label="Location *" value={form.location} options={LOCATIONS}
                onChange={(v) => setForm((p) => ({ ...p, location: v }))} required
                colorMap={{
                  USA: "border-emerald-500 bg-emerald-500 text-white shadow-sm",
                  India: "border-blue-500 bg-blue-500 text-white shadow-sm",
                  Other: "border-slate-500 bg-slate-500 text-white shadow-sm",
                }} />
              {errors.location && <p className="mt-1 text-xs text-rose-500">{errors.location}</p>}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
          )}
          <Button onClick={submit} disabled={isPending} className="px-8">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Briefcase className="h-4 w-4" />}
            {isPending ? "Saving…" : techSupportId ? "Save Changes" : "Add Tech Support"}
          </Button>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  );
}
