"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Pencil, Phone, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SlideFormBody, SlideFormFooter, SlideFormHeader, SlideFormSection,
  SlideFormSections, SlideFormShell,
} from "@/components/forms/compact-slide-form";
import { EditUserForm } from "./edit-user-form";
import type { Role } from "@/generated/prisma/client";

type UserRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
  isActive: boolean;
  roleId: string | null;
  role: Role | null;
  createdAt: string;
};

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-800 break-words">{value?.trim() || "—"}</p>
    </div>
  );
}

export function UserDetail({ userId, roles }: { userId: string; roles: Role[] }) {
  const router = useRouter();
  const [user, setUser] = useState<UserRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/users/${userId}`);
      if (!res.ok) throw new Error("Failed to load user");
      setUser(await res.json());
    } catch {
      setError("Could not load user details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/users/${userId}`);
        if (!res.ok) throw new Error("Failed to load user");
        const data = await res.json();
        if (!cancelled) setUser(data);
      } catch {
        if (!cancelled) setError("Could not load user details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (editing && user) {
    return (
      <EditUserForm
        roles={roles}
        userId={userId}
        initialData={user}
        onCancel={() => setEditing(false)}
        onSuccess={() => {
          setEditing(false);
          load();
          router.refresh();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex min-h-[280px] items-center justify-center p-8 text-center">
        <p className="text-sm font-medium text-rose-600">{error || "User not found"}</p>
      </div>
    );
  }

  const name = `${user.firstName} ${user.lastName}`;

  return (
    <SlideFormShell>
      <SlideFormHeader
        icon={Users}
        title={name}
        subtitle={`${user.email} · Joined ${fmtDate(user.createdAt)}`}
        tone="indigo"
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

      <SlideFormBody>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {user.isActive ? "Active" : "Pending"}
          </span>
          {user.role && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-semibold text-indigo-700">{user.role.name}</span>
          )}
          {user.phoneNumber && (
            <span className="inline-flex items-center gap-1 text-slate-500"><Phone className="h-3 w-3" />{user.phoneNumber}</span>
          )}
        </div>

        <SlideFormSections>
          <SlideFormSection icon={Users} title="Personal Information" color="indigo">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <DetailField label="First Name" value={user.firstName} />
              <DetailField label="Last Name" value={user.lastName} />
              <DetailField label="Email" value={user.email} />
              <DetailField label="Phone Number" value={user.phoneNumber} />
            </div>
          </SlideFormSection>

          <SlideFormSection icon={Shield} title="Role & Status" color="violet">
            <div className="grid grid-cols-2 gap-2">
              <DetailField label="Role" value={user.role?.name ?? null} />
              <DetailField label="Status" value={user.isActive ? "Active" : "Pending"} />
            </div>
          </SlideFormSection>

          <SlideFormSection icon={Mail} title="Account" color="slate">
            <DetailField label="Created" value={fmtDate(user.createdAt)} />
          </SlideFormSection>
        </SlideFormSections>
      </SlideFormBody>

      <SlideFormFooter>
        <Button size="sm" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" />
          Edit User
        </Button>
      </SlideFormFooter>
    </SlideFormShell>
  );
}
