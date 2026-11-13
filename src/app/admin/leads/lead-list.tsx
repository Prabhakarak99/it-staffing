"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { TabSearchBar } from "@/components/ui/tab-search-bar";
import { HighlightText } from "@/components/ui/highlight-text";
import { filterBySearch, searchBlob } from "@/lib/table-search";
import {
  CheckboxHeaderFilter,
  buildCascadingFilterOptions,
  pruneStaleFilters,
  type SortDir,
} from "@/components/ui/table-column-filters";
import { ArrowRightCircle, Trash2, Users } from "lucide-react";
import { LEAD_STATUSES, STATUS_STYLES, fmtOptDate, isLeadStatus, leadLabel, type LeadRow } from "@/lib/leads/fields";

type FilterKey =
  | "consultantName" | "phoneNumber" | "email" | "visaStatus" | "university"
  | "state" | "optStartDate" | "status" | "comments";
type SortCol = FilterKey | "createdAt";
type Filters = Record<FilterKey, Set<string>>;
const FILTER_KEYS: FilterKey[] = [
  "consultantName", "phoneNumber", "email", "visaStatus", "university", "state", "optStartDate", "status", "comments",
];

const COLUMNS: { key: FilterKey; label: string }[] = [
  { key: "consultantName", label: "Full Name" },
  { key: "phoneNumber", label: "Contact Number" },
  { key: "email", label: "Email ID" },
  { key: "visaStatus", label: "Visa Status" },
  { key: "university", label: "University" },
  { key: "state", label: "State" },
  { key: "optStartDate", label: "OPT Start Date" },
  { key: "status", label: "Status" },
  { key: "comments", label: "Comments" },
];

type Lead = LeadRow;

const EMPTY_FILTERS = (): Filters =>
  Object.fromEntries(FILTER_KEYS.map((k) => [k, new Set<string>()])) as Filters;

function getFilterValue(lead: Lead, key: FilterKey): string {
  switch (key) {
    case "comments":
      return lead.comments?.trim() ? "Has Comments" : "No Comments";
    case "optStartDate":
      return fmtOptDate(lead.optStartDate) ?? "—";
    case "consultantName":
    case "email":
    case "status":
      return lead[key];
    default:
      return lead[key]?.trim() || "—";
  }
}

export function LeadList({
  leads,
  showOwner,
  onSelect,
  onLeadsChange,
}: {
  leads: Lead[];
  showOwner?: boolean;
  onSelect?: (id: string) => void;
  onLeadsChange?: React.Dispatch<React.SetStateAction<Lead[]>>;
}) {
  const [sortCol, setSortCol] = useState<SortCol>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [, startTransition] = useTransition();
  const router = useRouter();
  const { toast, show, hide } = useToast();

  const setFilter = (key: FilterKey, next: Set<string>) =>
    setFilters((prev) => ({ ...prev, [key]: next }));

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const searched = useMemo(() => {
    return filterBySearch(leads, searchQuery, (lead) => searchBlob(
      lead.consultantName, lead.phoneNumber, lead.email, lead.visaStatus, lead.university, lead.state,
      fmtOptDate(lead.optStartDate), lead.status, lead.comments, lead.createdByName,
    ));
  }, [leads, searchQuery]);

  const filterOptions = useMemo(() => {
    return buildCascadingFilterOptions(searched, filters, FILTER_KEYS, getFilterValue);
  }, [searched, filters]);

  useEffect(() => {
    setFilters((prev) => {
      const pruned = pruneStaleFilters(prev, filterOptions);
      return pruned ?? prev;
    });
  }, [filterOptions]);

  const filtered = useMemo(() => {
    return searched.filter((lead) =>
      FILTER_KEYS.every((key) => {
        const selected = filters[key];
        if (selected.size === 0) return true;
        return selected.has(getFilterValue(lead, key));
      })
    );
  }, [searched, filters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortCol === "createdAt" || sortCol === "optStartDate") {
        const t = (v: string | null) => (v ? new Date(v).getTime() : 0);
        return dir * (t(a[sortCol]) - t(b[sortCol]));
      }
      return dir * (a[sortCol] ?? "").localeCompare(b[sortCol] ?? "");
    });
  }, [filtered, sortCol, sortDir]);

  const activeFilterCount = useMemo(
    () => (Object.values(filters) as Set<string>[]).filter((set) => set.size > 0).length,
    [filters]
  );

  const deleteLead = (id: string, consultantName: string) => {
    if (!confirm(`Remove lead for ${consultantName}?`)) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete lead");
        onLeadsChange?.((prev) => prev.filter((lead) => lead.id !== id));
        show(`Removed lead for ${consultantName}`, "success");
        router.refresh();
      } catch {
        show("Failed to remove lead", "error");
      }
    });
  };

  const changeStatus = (lead: Lead, status: string) => {
    const previous = lead.status;
    onLeadsChange?.((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status } : l)));
    startTransition(async () => {
      try {
        const res = await fetch(`/api/leads/${lead.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) throw new Error();
        show(`${leadLabel(lead)} marked ${status}`, "success");
      } catch {
        onLeadsChange?.((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: previous } : l)));
        show("Failed to update status", "error");
      }
    });
  };

  const convertLead = (id: string, consultantName: string) => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/leads/${id}/convert`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to convert lead");
        onLeadsChange?.((prev) => prev.filter((lead) => lead.id !== id));
        show(`${consultantName} added to Consultants and moved to Pre-Marketing`, "success");
        router.refresh();
      } catch (err) {
        show(err instanceof Error ? err.message : "Failed to convert lead", "error");
      }
    });
  };

  if (leads.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
          <Users className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-700">No leads created yet</p>
        <p className="mt-1 text-xs text-slate-400">Use the Add New Lead button to create the first lead.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50">
            <Users className="h-4 w-4 text-sky-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Lead Records</h3>
            <p className="text-xs text-slate-500">
              {activeFilterCount > 0 || searchQuery ? `${sorted.length} of ${leads.length} shown` : `${leads.length} total`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:ml-auto">
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS())}
            className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100"
          >
            Clear all filters ({activeFilterCount})
          </button>
        )}
          <TabSearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search leads…" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-left">
              {COLUMNS.map(({ key, label }) => (
                <CheckboxHeaderFilter key={key} label={label} sortCol={key} sortDir={sortDir} currentSort={sortCol} onSort={toggleSort} options={filterOptions[key]} selected={filters[key]} onChange={(next) => setFilter(key, next)} accentClass="text-sky-600" hoverClass="hover:bg-sky-50" thClassName="relative px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap" />
              ))}
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-5 py-10 text-center text-sm text-slate-400">
                  No leads match the selected filters.
                </td>
              </tr>
            ) : (
              sorted.map((lead) => (
                <tr key={lead.id} className="transition-colors hover:bg-sky-50/20">
                  <td className="px-5 py-3.5">
                    <button
                      type="button"
                      onClick={() => onSelect?.(lead.id)}
                      className="text-sm font-semibold text-slate-900 text-left transition-colors hover:text-sky-600 hover:underline"
                    >
                      {lead.consultantName ? <HighlightText text={lead.consultantName} query={searchQuery} /> : <span className="font-medium italic text-slate-400">No name</span>}
                    </button>
                    {showOwner && (
                      <p className="mt-0.5 text-[11px] text-slate-400">Added by {lead.createdByName ?? "—"}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                    <HighlightText text={lead.phoneNumber} query={searchQuery} />
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                    <HighlightText text={lead.email} query={searchQuery} />
                  </td>
                  {[lead.visaStatus, lead.university, lead.state, fmtOptDate(lead.optStartDate)].map((v, i) => (
                    <td key={i} className="px-5 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                      {v ? <HighlightText text={v} query={searchQuery} /> : <span className="text-slate-300">—</span>}
                    </td>
                  ))}
                  <td className="px-5 py-3.5">
                    <select
                      value={lead.status}
                      onChange={(e) => changeStatus(lead, e.target.value)}
                      className={cn(
                        "rounded-lg border px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-400/30",
                        isLeadStatus(lead.status) ? STATUS_STYLES[lead.status] : "border-slate-200 bg-white text-slate-600",
                      )}
                    >
                      {!isLeadStatus(lead.status) && <option value={lead.status}>{lead.status}</option>}
                      {LEAD_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                    </select>
                  </td>
                  <td className="w-[280px] min-w-[220px] max-w-[280px] px-5 py-3.5 align-top">
                    {lead.comments ? (
                      <p className="whitespace-normal break-words text-[13px] leading-relaxed text-slate-600">
                        <HighlightText text={lead.comments} query={searchQuery} />
                      </p>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => convertLead(lead.id, leadLabel(lead))}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                        title="Convert to consultant"
                      >
                        <ArrowRightCircle className="h-3.5 w-3.5" />
                        Convert
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteLead(lead.id, leadLabel(lead))}
                        className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
                        title="Delete lead"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  );
}
