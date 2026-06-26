"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { UserPlus, Loader2 } from "lucide-react";
import type { Role } from "@/generated/prisma/client";
import { isValidEmail, validateOptionalPhone, validatePassword } from "@/lib/validators";

interface Props {
  roles: Role[];
}

const EMPTY = {
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  password: "",
  roleId: "",
  isActive: "false",
};

export function CreateUserForm({ roles }: Props) {
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
    const passErr = validatePassword(form.password);
    if (passErr) errs.password = passErr;
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
      } catch (err: unknown) {
        show(err instanceof Error ? err.message : "Error creating user", "error");
      }
    });
  };

  const roleOptions = roles.map((r) => ({ value: r.id, label: r.name }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-indigo-600" />
          Create New User
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            id="firstName"
            label="First Name *"
            placeholder="John"
            value={form.firstName}
            onChange={set("firstName")}
            error={errors.firstName}
          />
          <Input
            id="lastName"
            label="Last Name *"
            placeholder="Doe"
            value={form.lastName}
            onChange={set("lastName")}
            error={errors.lastName}
          />
          <Input
            id="email"
            label="Email *"
            type="email"
            placeholder="john@example.com"
            value={form.email}
            onChange={set("email")}
            error={errors.email}
          />
          <Input
            id="phoneNumber"
            label="Phone Number"
            type="tel"
            placeholder="555-000-0000"
            value={form.phoneNumber}
            onChange={set("phoneNumber")}
            error={errors.phoneNumber}
          />
          <Input
            id="password"
            label="Password *"
            type="password"
            placeholder="Min 8 characters"
            value={form.password}
            onChange={set("password")}
            error={errors.password}
          />
          <Select
            id="roleId"
            label="Role"
            options={roleOptions}
            placeholder="Select a role"
            value={form.roleId}
            onChange={set("roleId")}
          />
          <div className="flex flex-col gap-1">
            <Select
              id="isActive"
              label="Status"
              options={[
                { value: "false", label: "Pending Activation (sends email)" },
                { value: "true", label: "Active (no email)" },
              ]}
              value={form.isActive}
              onChange={set("isActive")}
            />
            {form.isActive === "false" && (
              <p className="text-xs text-indigo-600">
                ✉ An activation email will be sent to {form.email || "the user"}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={submit} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Create User & Send Email
          </Button>
        </div>
      </CardContent>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </Card>
  );
}
