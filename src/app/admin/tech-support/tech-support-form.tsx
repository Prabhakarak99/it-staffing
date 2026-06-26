"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { Briefcase, Loader2 } from "lucide-react";
import { isValidEmail, isValidPhone, validateOptionalUrl } from "@/lib/validators";

const TECHNOLOGIES = [
  ".Net", "Java", "DE", "DS/GenAi/ML", "Devops",
  "Mainframes", "Networking", "BA", "Sales Force",
];

const LOCATIONS = ["USA", "India", "Other"];

const EMPTY = {
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  technology: "",
  location: "",
  availability: "",
  calendarLink: "",
  amount: "",
};

type FormErrors = Partial<Record<keyof typeof EMPTY, string>>;

export function TechSupportForm() {
  const [form, setForm] = useState(EMPTY);
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
    else if (!isValidPhone(form.phoneNumber)) errs.phoneNumber = "Invalid phone format (e.g. 555-000-0000)";
    if (!form.technology) errs.technology = "Required";
    if (!form.location) errs.location = "Required";
    const urlErr = validateOptionalUrl(form.calendarLink);
    if (urlErr) errs.calendarLink = urlErr;
    return errs;
  };

  const submit = () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});

    startTransition(async () => {
      try {
        const res = await fetch("/api/tech-support", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            phoneNumber: form.phoneNumber,
            technology: form.technology,
            location: form.location,
            availability: form.availability,
            calendarLink: form.calendarLink,
            amount: form.amount,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to add tech support");
        show(`${form.firstName} ${form.lastName} added successfully`, "success");
        setForm(EMPTY);
        router.refresh();
      } catch (err: unknown) {
        show(err instanceof Error ? err.message : "Error adding tech support", "error");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-indigo-600" />
          Add Tech Support
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Name */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Tech Support Name</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="ts-firstName" label="First Name *" placeholder="Jane"
              value={form.firstName} onChange={set("firstName")} error={errors.firstName}
            />
            <Input
              id="ts-lastName" label="Last Name *" placeholder="Smith"
              value={form.lastName} onChange={set("lastName")} error={errors.lastName}
            />
          </div>
        </div>

        {/* Contact */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Contact</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              id="ts-email" label="Email *" type="email" placeholder="jane@company.com"
              value={form.email} onChange={set("email")} error={errors.email}
            />
            <Input
              id="ts-phone" label="Phone Number *" type="tel" placeholder="555-000-0000"
              value={form.phoneNumber} onChange={set("phoneNumber")} error={errors.phoneNumber}
            />
            <Select
              id="ts-location" label="Location *"
              options={LOCATIONS.map((l) => ({ value: l, label: l }))}
              placeholder="Select location"
              value={form.location} onChange={set("location")} error={errors.location}
            />
          </div>
        </div>

        {/* Skills & Schedule */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Skills & Availability</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Select
              id="ts-technology" label="Technology *"
              options={TECHNOLOGIES.map((t) => ({ value: t, label: t }))}
              placeholder="Select technology"
              value={form.technology} onChange={set("technology")} error={errors.technology}
            />
            <Input
              id="ts-availability" label="Availability (CST Time)" placeholder="e.g. 9 AM – 6 PM CST"
              value={form.availability} onChange={set("availability")}
            />
            <Input
              id="ts-amount" label="Amount (USD)" placeholder="e.g. $75/hr"
              value={form.amount} onChange={set("amount")}
            />
          </div>
        </div>

        {/* Calendar */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            id="ts-calendar" label="Calendar Link" placeholder="https://calendly.com/…"
            value={form.calendarLink} onChange={set("calendarLink")} error={errors.calendarLink}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={submit} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Briefcase className="h-4 w-4" />}
            {isPending ? "Adding…" : "Add Tech Support"}
          </Button>
        </div>
      </CardContent>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </Card>
  );
}
