"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Check, ChevronDown, Globe2, Loader2, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompanyOption { id: string; name: string; slug: string; kind: string; status: string }

/**
 * The company shown next to the logo. For the Platform Super Admin it is a switcher: any company, the
 * platform's shared settings, or the All companies view (where new records can't be added).
 */
export function CompanySwitcher({ companyName, isPlatformAdmin }: { companyName: string; isPlatformAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [companies, setCompanies] = useState<CompanyOption[] | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = () => {
    setOpen((o) => !o);
    if (companies) return;
    fetch("/api/platform/companies")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setCompanies)
      .catch(() => setError("Could not load companies"));
  };

  const switchTo = async (companyId: string) => {
    setSwitching(companyId);
    setError("");
    const res = await fetch("/api/platform/switch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId }) }).catch(() => null);
    if (!res?.ok) {
      setSwitching(null);
      setError((await res?.json().catch(() => null))?.error ?? "Could not switch");
      return;
    }
    // A full reload, so every screen reads the new company
    window.location.assign("/admin");
  };

  const label = (
    <>
      <Building2 className="h-4 w-4 shrink-0 text-indigo-400" />
      <span className="truncate text-[13.5px] font-semibold text-slate-100" title={`Company: ${companyName}`}>{companyName}</span>
    </>
  );

  if (!isPlatformAdmin) return <div className="flex min-w-0 items-center gap-2 border-l border-white/[0.08] pl-3">{label}</div>;

  const customers = (companies ?? []).filter((c) => c.kind === "company");
  const platform = (companies ?? []).find((c) => c.kind === "platform");
  const item = (id: string, text: string, icon: React.ReactNode, hint?: string, active?: boolean) => (
    <button
      key={id}
      type="button"
      onClick={() => void switchTo(id)}
      disabled={!!switching}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-100 disabled:opacity-60"
    >
      {switching === id ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{text}</span>
        {hint && <span className="block truncate text-[11px] text-slate-400">{hint}</span>}
      </span>
      {active && <Check className="h-4 w-4 text-indigo-600" />}
    </button>
  );

  return (
    <div ref={ref} className="relative flex min-w-0 items-center border-l border-white/[0.08] pl-3">
      <button type="button" onClick={toggle} className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.08]" aria-haspopup="menu" aria-expanded={open}>
        {label}
        <span className="hidden shrink-0 rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300 sm:inline">Super Admin</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>
      {open && (
        <div role="menu" className="absolute left-3 top-[calc(100%+8px)] z-50 w-72 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          <p className="px-3 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">Work in</p>
          {!companies && !error && <p className="flex items-center gap-2 px-3 py-2 text-[12.5px] text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</p>}
          {customers.map((c) =>
            item(c.id, c.name, <Building2 className={cn("h-4 w-4", c.status === "active" ? "text-indigo-500" : "text-slate-300")} />, c.status === "active" ? `?company=${c.slug}` : "Suspended", c.name === companyName),
          )}
          {companies && (
            <div className="mt-1 border-t border-slate-100 pt-1">
              {item("all", "All companies", <Globe2 className="h-4 w-4 text-emerald-600" />, "See everything; switch to a company to add records", companyName === "All companies")}
              {platform && item(platform.id, "Platform: shared settings", <Settings2 className="h-4 w-4 text-amber-600" />, "Shared AI keys and job sources", companyName === platform.name)}
            </div>
          )}
          {error && <p className="px-3 py-2 text-[12px] font-medium text-rose-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
