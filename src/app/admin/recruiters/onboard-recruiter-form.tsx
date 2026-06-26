"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { UserPlus, Loader2, Mail } from "lucide-react";
import type { Role } from "@/generated/prisma/client";
import { isValidEmail, validateOptionalPhone } from "@/lib/validators";

interface Props {
  roles: Role[];
}

const EMPTY = {
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  businessNumber: "",
  startDate: "",
  endDate: "",
  roleId: "",
};

export function OnboardRecruiterForm({ roles }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<typeof EMPTY>>({});
  const [isPending, startTransition] = useTransition();
  const { toast, show, hide } = useToast();
  const router = useRouter();

  const set = (field: keyof typeof EMPTY) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

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
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    startTransition(async () => {
      try {
        const res = await fetch("/api/recruiters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
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
      } catch (err: unknown) {
        show(err instanceof Error ? err.message : "Error onboarding recruiter", "error");
      }
    });
  };

  const roleOptions = roles.map((r) => ({ value: r.id, label: r.name }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-green-600" />
          Onboard New Recruiter
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Info banner */}
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
          <Mail className="h-4 w-4 shrink-0" />
          An activation email will be sent automatically so the recruiter can set their password.
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            id="rec-firstName"
            label="First Name *"
            placeholder="Jane"
            value={form.firstName}
            onChange={set("firstName")}
            error={errors.firstName}
          />
          <Input
            id="rec-lastName"
            label="Last Name *"
            placeholder="Smith"
            value={form.lastName}
            onChange={set("lastName")}
            error={errors.lastName}
          />
          <Input
            id="rec-email"
            label="Email *"
            type="email"
            placeholder="jane@company.com"
            value={form.email}
            onChange={set("email")}
            error={errors.email}
          />
          <Input
            id="rec-phone"
            label="Phone Number"
            type="tel"
            placeholder="555-000-0000"
            value={form.phoneNumber}
            onChange={set("phoneNumber")}
            error={errors.phoneNumber}
          />
          <Input
            id="rec-business"
            label="Business Number"
            type="tel"
            placeholder="555-000-0000"
            value={form.businessNumber}
            onChange={set("businessNumber")}
            error={errors.businessNumber}
          />
          <Select
            id="rec-role"
            label="Role"
            options={roleOptions}
            placeholder="Select a role"
            value={form.roleId}
            onChange={set("roleId")}
          />
          <Input
            id="rec-start"
            label="Start Date *"
            type="date"
            value={form.startDate}
            onChange={set("startDate")}
            error={errors.startDate}
          />
          <Input
            id="rec-end"
            label="End Date"
            type="date"
            value={form.endDate}
            onChange={set("endDate")}
          />
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={submit} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Onboard & Send Activation Email
          </Button>
        </div>
      </CardContent>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </Card>
  );
}
