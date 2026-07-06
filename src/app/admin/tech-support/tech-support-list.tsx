"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Toast, useToast } from "@/components/ui/toast";
import { TabSearchBar } from "@/components/ui/tab-search-bar";
import { HighlightText } from "@/components/ui/highlight-text";
import { filterBySearch, searchBlob } from "@/lib/table-search";
import { cn } from "@/lib/utils";
import { Briefcase, Trash2, Loader2, MapPin, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { TechSupport } from "@/generated/prisma/client";

type SortDir = "asc" | "desc";

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

const TECH_COLOR: Record<string, string> = {
  ".Net": "bg-purple-100 text-purple-700",
  "Java": "bg-orange-100 text-orange-700",
  "DE": "bg-cyan-100 text-cyan-700",
  "DS/GenAi/ML": "bg-pink-100 text-pink-700",
  "Devops": "bg-teal-100 text-teal-700",
  "Mainframes": "bg-slate-100 text-slate-700",
  "Networking": "bg-blue-100 text-blue-700",
  "BA": "bg-amber-100 text-amber-700",
  "Sales Force": "bg-indigo-100 text-indigo-700",
};

const LOCATION_STYLE: Record<string, string> = {
  USA: "border-emerald-200 bg-emerald-50 text-emerald-700",
  India: "border-blue-200 bg-blue-50 text-blue-700",
  Other: "border-slate-200 bg-slate-50 text-slate-600",
};

export function TechSupportList({ people, onSelect }: { people: TechSupport[]; onSelect?: (id: string) => void }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast, show, hide } = useToast();
  const [sortCol, setSortCol] = useState("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [searchQuery, setSearchQuery] = useState("");

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  }

  function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return <ChevronsUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  }

  const filtered = useMemo(() => {
    return filterBySearch(people, searchQuery, (p) => searchBlob(
      p.firstName, p.lastName, p.email, p.phoneNumber, p.technology, p.location, p.availability, p.amount,
    ));
  }, [people, searchQuery]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortCol) {
        case "name":         return dir * (`${a.firstName} ${a.lastName}`).localeCompare(`${b.firstName} ${b.lastName}`);
        case "email":        return dir * a.email.localeCompare(b.email);
        case "technology":   return dir * a.technology.localeCompare(b.technology);
        case "location":     return dir * a.location.localeCompare(b.location);
        case "availability": return dir * (a.availability ?? "").localeCompare(b.availability ?? "");
        case "amount":       return dir * (parseFloat(a.amount ?? "0") - parseFloat(b.amount ?? "0"));
        default: return 0;
      }
    });
  }, [filtered, sortCol, sortDir]);

  const deletePerson = (id: string, name: string) => {
    if (!confirm(`Remove ${name} from tech support?`)) return;
    setDeletingId(id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/tech-support/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete");
        show(`${name} removed`, "success");
        router.refresh();
      } catch {
        show("Failed to remove tech support person", "error");
      } finally { setDeletingId(null); }
    });
  };

  const usaCount = people.filter((p) => p.location === "USA").length;
  const indiaCount = people.filter((p) => p.location === "India").length;

  if (people.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
          <Briefcase className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-700">No tech support added yet</p>
        <p className="text-xs text-slate-400 mt-1">Add your first expert using the button above</p>
      </div>
    );
  }

  const thCls = "px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap cursor-pointer select-none hover:bg-slate-700 transition-colors";
  const thFixed = "px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50">
            <Briefcase className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Tech Support Team</h3>
            <p className="text-xs text-slate-500">
              {searchQuery ? `${sorted.length} of ${people.length} shown` : `${people.length} expert${people.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:ml-auto">
        <div className="hidden sm:flex items-center gap-2">
          {usaCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
              <MapPin className="h-3 w-3 text-emerald-500" />
              <span className="text-xs font-semibold text-emerald-700">{usaCount} USA</span>
            </div>
          )}
          {indiaCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1">
              <MapPin className="h-3 w-3 text-blue-500" />
              <span className="text-xs font-semibold text-blue-700">{indiaCount} India</span>
            </div>
          )}
        </div>
          <TabSearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search tech support…" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-left">
              <th className={thCls} onClick={() => toggleSort("name")}>
                <span className="flex items-center gap-1.5">Expert <SortIcon col="name" /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("email")}>
                <span className="flex items-center gap-1.5">Contact <SortIcon col="email" /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("technology")}>
                <span className="flex items-center gap-1.5">Technology <SortIcon col="technology" /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("location")}>
                <span className="flex items-center gap-1.5">Location <SortIcon col="location" /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("availability")}>
                <span className="flex items-center gap-1.5">Availability <SortIcon col="availability" /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("amount")}>
                <span className="flex items-center gap-1.5">Amount <SortIcon col="amount" /></span>
              </th>
              <th className={thFixed} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((p) => {
              const name = `${p.firstName} ${p.lastName}`;
              return (
                <tr key={p.id} className="hover:bg-amber-50/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                        {initials(name)}
                      </div>
                      <button
                        type="button"
                        onClick={() => onSelect?.(p.id)}
                        className="font-semibold text-slate-900 whitespace-nowrap text-left transition-colors hover:text-amber-600 hover:underline"
                      >
                        <HighlightText text={name} query={searchQuery} />
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-xs text-slate-600 truncate max-w-[160px]">
                      <HighlightText text={p.email} query={searchQuery} />
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      <HighlightText text={p.phoneNumber} query={searchQuery} />
                    </p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", TECH_COLOR[p.technology] ?? "bg-slate-100 text-slate-700")}>
                      <HighlightText text={p.technology} query={searchQuery} />
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold", LOCATION_STYLE[p.location] ?? LOCATION_STYLE.Other)}>
                      <MapPin className="h-3 w-3" />
                      <HighlightText text={p.location} query={searchQuery} />
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                    <HighlightText text={p.availability} query={searchQuery} />
                  </td>
                  <td className="px-5 py-3.5 text-xs font-semibold text-slate-700 whitespace-nowrap">
                    <HighlightText text={p.amount} query={searchQuery} />
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      disabled={deletingId === p.id}
                      onClick={() => deletePerson(p.id, name)}
                      className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-colors disabled:opacity-40"
                      title="Remove">
                      {deletingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  );
}
