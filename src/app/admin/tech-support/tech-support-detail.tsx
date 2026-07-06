"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Loader2, MapPin, Pencil, Phone, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SlideFormBody, SlideFormFooter, SlideFormHeader, SlideFormSection,
  SlideFormSections, SlideFormShell,
} from "@/components/forms/compact-slide-form";
import { TechSupportForm } from "./tech-support-form";

type TechSupportRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  technology: string;
  location: string;
  availability: string | null;
  amount: string | null;
  createdAt: string;
};

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-800 break-words">{value?.trim() || "—"}</p>
    </div>
  );
}

export function TechSupportDetail({ personId }: { personId: string }) {
  const router = useRouter();
  const [person, setPerson] = useState<TechSupportRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/tech-support/${personId}`);
      if (!res.ok) throw new Error("Failed to load tech support details");
      setPerson(await res.json());
    } catch {
      setError("Could not load tech support details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/tech-support/${personId}`);
        if (!res.ok) throw new Error("Failed to load tech support details");
        const data = await res.json();
        if (!cancelled) setPerson(data);
      } catch {
        if (!cancelled) setError("Could not load tech support details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [personId]);

  if (editing && person) {
    return (
      <TechSupportForm
        techSupportId={personId}
        initialData={{
          ...person,
          availability: person.availability ?? "",
          amount: person.amount ?? "",
        }}
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
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="flex min-h-[280px] items-center justify-center p-8 text-center">
        <p className="text-sm font-medium text-rose-600">{error || "Expert not found"}</p>
      </div>
    );
  }

  const name = `${person.firstName} ${person.lastName}`;

  return (
    <SlideFormShell>
      <SlideFormHeader
        icon={Briefcase}
        title={name}
        subtitle={`${person.email} · ${person.technology}`}
        tone="amber"
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
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">{person.technology}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
            <MapPin className="h-3 w-3" />{person.location}
          </span>
          <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{person.phoneNumber}</span>
        </div>

        <SlideFormSections>
          <SlideFormSection icon={Briefcase} title="Identity & Contact" color="amber">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <DetailField label="First Name" value={person.firstName} />
              <DetailField label="Last Name" value={person.lastName} />
              <DetailField label="Email" value={person.email} />
              <DetailField label="Phone Number" value={person.phoneNumber} />
            </div>
          </SlideFormSection>

          <SlideFormSection icon={Zap} title="Skills & Availability" color="orange">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <DetailField label="Technology" value={person.technology} />
              <DetailField label="Availability" value={person.availability} />
              <DetailField label="Amount" value={person.amount} />
            </div>
          </SlideFormSection>

          <SlideFormSection icon={MapPin} title="Location" color="blue">
            <DetailField label="Location" value={person.location} />
          </SlideFormSection>
        </SlideFormSections>
      </SlideFormBody>

      <SlideFormFooter>
        <Button size="sm" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" />
          Edit Expert
        </Button>
      </SlideFormFooter>
    </SlideFormShell>
  );
}
