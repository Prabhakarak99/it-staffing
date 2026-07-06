"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Toast, useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { TabSearchBar } from "@/components/ui/tab-search-bar";
import { HighlightText } from "@/components/ui/highlight-text";
import { filterBySearch, searchBlob } from "@/lib/table-search";
import {
  CheckboxHeaderFilter,
  DateHeaderFilter,
  matchesDateFilters,
  buildCascadingFilterOptions,
  pruneStaleFilters,
  type DatePreset,
  type SortDir,
} from "@/components/ui/table-column-filters";

const STATUSES = [
  "Submission Submitted", "In Review", "Rejected",
  "Moved to Client", "Confirmation",
];

interface SubmissionRecord {
  id: string;
  submissionId: string;
  submissionDate: string | Date;
  technology: string;
  payRate: string | null;
  vendorCompany: string;
  vendorRecruiterName: string;
  clientName: string | null;
  clientLocation: string | null;
  status: string;
  recruiter: { firstName: string; lastName: string };
  consultant: { firstName: string; lastName: string; technology: string | null };
}

type SortCol =
  | "submissionId"
  | "submissionDate"
  | "recruiter"
  | "consultant"
  | "technology"
  | "vendorCompany"
  | "clientName"
  | "payRate"
  | "status";

type FilterKey = Exclude<SortCol, "submissionDate">;
type Filters = Record<FilterKey, Set<string>>;
const FILTER_KEYS: FilterKey[] = [
  "submissionId", "recruiter", "consultant", "technology",
  "vendorCompany", "clientName", "payRate", "status",
];

const EMPTY_FILTERS = (): Filters => ({
  submissionId: new Set(),
  recruiter: new Set(),
  consultant: new Set(),
  technology: new Set(),
  vendorCompany: new Set(),
  clientName: new Set(),
  payRate: new Set(),
  status: new Set(),
});

function fmt(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { dateStyle: "medium" });
}

function getFilterValue(submission: SubmissionRecord, key: FilterKey): string {
  switch (key) {
    case "submissionId":
      return submission.submissionId;
    case "recruiter":
      return `${submission.recruiter.firstName} ${submission.recruiter.lastName}`;
    case "consultant":
      return `${submission.consultant.firstName} ${submission.consultant.lastName}`;
    case "technology":
      return submission.technology;
    case "vendorCompany":
      return submission.vendorCompany;
    case "clientName":
      return submission.clientName?.trim() || "—";
    case "payRate":
      return submission.payRate?.trim() || "—";
    case "status":
      return submission.status;
  }
}

export function SubmissionList({
  submissions,
  onSelect,
  initialSearch = "",
  initialIds,
}: {
  submissions: SubmissionRecord[];
  onSelect?: (id: string) => void;
  initialSearch?: string;
  initialIds?: string[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { toast, show, hide } = useToast();
  const [sortCol, setSortCol] = useState<SortCol>("submissionDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [datePresets, setDatePresets] = useState<Set<DatePreset>>(new Set());
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  useEffect(() => {
    setSearchQuery(initialSearch);
  }, [initialSearch]);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  };

  const setFilter = (key: FilterKey, next: Set<string>) =>
    setFilters((prev) => ({ ...prev, [key]: next }));

  const scoped = useMemo(() => {
    if (!initialIds?.length) return submissions;
    const idSet = new Set(initialIds);
    return submissions.filter((s) => idSet.has(s.id));
  }, [submissions, initialIds]);

  const searched = useMemo(() => {
    return filterBySearch(scoped, searchQuery, (s) => searchBlob(
      s.submissionId, s.technology, s.payRate, s.vendorCompany, s.vendorRecruiterName,
      s.clientName, s.clientLocation, s.status,
      s.recruiter.firstName, s.recruiter.lastName,
      s.consultant.firstName, s.consultant.lastName,
    ));
  }, [scoped, searchQuery]);

  const filterOptions = useMemo(() => {
    return buildCascadingFilterOptions(
      searched,
      filters,
      FILTER_KEYS,
      getFilterValue,
      (submission) => matchesDateFilters(submission.submissionDate, datePresets, customFrom, customTo),
    );
  }, [searched, filters, datePresets, customFrom, customTo]);

  useEffect(() => {
    setFilters((prev) => {
      const pruned = pruneStaleFilters(prev, filterOptions);
      return pruned ?? prev;
    });
  }, [filterOptions]);

  const filtered = useMemo(() => {
    return searched.filter((submission) => {
      const matchesFields = (Object.keys(filters) as FilterKey[]).every((key) => {
        const selected = filters[key];
        if (selected.size === 0) return true;
        return selected.has(getFilterValue(submission, key));
      });
      if (!matchesFields) return false;
      return matchesDateFilters(submission.submissionDate, datePresets, customFrom, customTo);
    });
  }, [searched, filters, datePresets, customFrom, customTo]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortCol) {
        case "submissionId":   return dir * a.submissionId.localeCompare(b.submissionId);
        case "submissionDate": return dir * (new Date(a.submissionDate).getTime() - new Date(b.submissionDate).getTime());
        case "recruiter":      return dir * (`${a.recruiter.firstName} ${a.recruiter.lastName}`).localeCompare(`${b.recruiter.firstName} ${b.recruiter.lastName}`);
        case "consultant":     return dir * (`${a.consultant.firstName} ${a.consultant.lastName}`).localeCompare(`${b.consultant.firstName} ${b.consultant.lastName}`);
        case "technology":     return dir * a.technology.localeCompare(b.technology);
        case "vendorCompany":  return dir * a.vendorCompany.localeCompare(b.vendorCompany);
        case "clientName":     return dir * (a.clientName ?? "").localeCompare(b.clientName ?? "");
        case "payRate":        return dir * (parseFloat(a.payRate ?? "0") - parseFloat(b.payRate ?? "0"));
        case "status":         return dir * a.status.localeCompare(b.status);
        default: return 0;
      }
    });
  }, [filtered, sortCol, sortDir]);

  const activeFilterCount = useMemo(() => {
    const fieldCount = (Object.values(filters) as Set<string>[]).filter((set) => set.size > 0).length;
    const dateCount = datePresets.size > 0 || customFrom || customTo ? 1 : 0;
    return fieldCount + dateCount;
  }, [filters, datePresets, customFrom, customTo]);

  const updateStatus = (id: string, status: string) => {
    setUpdatingId(id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/submissions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) throw new Error("Failed to update status");
        router.refresh();
      } catch {
        show("Failed to update status", "error");
      } finally {
        setUpdatingId(null);
      }
    });
  };

  const openSubmission = (id: string) => {
    if (onSelect) onSelect(id);
    else router.push(`/admin/submissions/${id}`);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50">
            <FileText className="h-4 w-4 text-sky-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">All Submissions</h3>
            <p className="text-xs text-slate-500">
              {activeFilterCount > 0 || searchQuery || initialIds?.length
                ? `${sorted.length} of ${initialIds?.length ? scoped.length : submissions.length} shown`
                : `${submissions.length} total`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:ml-auto">
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={() => {
              setFilters(EMPTY_FILTERS());
              setDatePresets(new Set());
              setCustomFrom("");
              setCustomTo("");
            }}
            className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100"
          >
            Clear all filters ({activeFilterCount})
          </button>
        )}
          <TabSearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search submissions…" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-800">
            <tr>
              <CheckboxHeaderFilter
                label="Sub ID"
                sortCol="submissionId"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={toggleSort}
                options={filterOptions.submissionId}
                selected={filters.submissionId}
                onChange={(next) => setFilter("submissionId", next)}
              />
              <DateHeaderFilter
                sortCol="submissionDate"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={toggleSort}
                selectedPresets={datePresets}
                onPresetsChange={setDatePresets}
                customFrom={customFrom}
                customTo={customTo}
                onCustomFromChange={setCustomFrom}
                onCustomToChange={setCustomTo}
              />
              <CheckboxHeaderFilter
                label="Recruiter"
                sortCol="recruiter"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={toggleSort}
                options={filterOptions.recruiter}
                selected={filters.recruiter}
                onChange={(next) => setFilter("recruiter", next)}
              />
              <CheckboxHeaderFilter
                label="Consultant"
                sortCol="consultant"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={toggleSort}
                options={filterOptions.consultant}
                selected={filters.consultant}
                onChange={(next) => setFilter("consultant", next)}
              />
              <CheckboxHeaderFilter
                label="Technology"
                sortCol="technology"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={toggleSort}
                options={filterOptions.technology}
                selected={filters.technology}
                onChange={(next) => setFilter("technology", next)}
              />
              <CheckboxHeaderFilter
                label="Vendor"
                sortCol="vendorCompany"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={toggleSort}
                options={filterOptions.vendorCompany}
                selected={filters.vendorCompany}
                onChange={(next) => setFilter("vendorCompany", next)}
              />
              <CheckboxHeaderFilter
                label="Client"
                sortCol="clientName"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={toggleSort}
                options={filterOptions.clientName}
                selected={filters.clientName}
                onChange={(next) => setFilter("clientName", next)}
              />
              <CheckboxHeaderFilter
                label="Pay Rate"
                sortCol="payRate"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={toggleSort}
                options={filterOptions.payRate}
                selected={filters.payRate}
                onChange={(next) => setFilter("payRate", next)}
              />
              <CheckboxHeaderFilter
                label="Status"
                sortCol="status"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={toggleSort}
                options={filterOptions.status}
                selected={filters.status}
                onChange={(next) => setFilter("status", next)}
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  {submissions.length === 0 ? "No submissions yet." : "No submissions match the selected filters."}
                </td>
              </tr>
            ) : (
              sorted.map((s) => (
                <tr key={s.id} className="hover:bg-sky-50/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openSubmission(s.id)}
                      className="text-blue-700 hover:text-blue-900 hover:underline"
                    >
                      <HighlightText text={s.submissionId} query={searchQuery} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                    <HighlightText text={fmt(s.submissionDate)} query={searchQuery} />
                  </td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap text-xs">
                    <HighlightText text={`${s.recruiter.firstName} ${s.recruiter.lastName}`} query={searchQuery} />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap text-xs">
                    <HighlightText text={`${s.consultant.firstName} ${s.consultant.lastName}`} query={searchQuery} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant="info"><HighlightText text={s.technology} query={searchQuery} /></Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                    <HighlightText text={s.vendorCompany} query={searchQuery} />
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                    <HighlightText text={s.clientName} query={searchQuery} />
                    {s.clientLocation && (
                      <span className="block text-xs text-slate-400">
                        <HighlightText text={s.clientLocation} query={searchQuery} />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                    <HighlightText text={s.payRate} query={searchQuery} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <select
                      value={s.status}
                      disabled={updatingId === s.id}
                      onChange={(e) => updateStatus(s.id, e.target.value)}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 disabled:opacity-50"
                    >
                      {STATUSES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
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
