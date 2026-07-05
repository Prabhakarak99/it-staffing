"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Toast, useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
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

const INTERVIEW_STATUSES = ["Rejected", "Moved To Next Round", "Confirmation"];

const LEVEL_VARIANT: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  Screening: "info",
  "Level 1": "default",
  "Level 2": "default",
  "Level 3": "warning",
  Final: "success",
};

function calcDuration(start: string | Date, end: string | Date): string {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (diff <= 0) return "—";
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

interface InterviewRecord {
  id: string;
  interviewId: string;
  interviewStartDate: string | Date;
  interviewEndDate: string | Date;
  interviewLevel: string;
  interviewStatus: string;
  techSupportFeedback: string | null;
  amount: string | null;
  recruiter: { firstName: string; lastName: string };
  submission: {
    submissionId: string;
    technology: string;
    vendorCompany: string;
    clientName: string | null;
    clientLocation: string | null;
    consultant: { firstName: string; lastName: string };
  };
  techSupport: { firstName: string; lastName: string } | null;
}

type SortCol =
  | "interviewId"
  | "date"
  | "consultant"
  | "recruiter"
  | "submission"
  | "level"
  | "vendor"
  | "client"
  | "techSupport"
  | "amount"
  | "status";

type FilterKey = Exclude<SortCol, "date">;
type Filters = Record<FilterKey, Set<string>>;
const FILTER_KEYS: FilterKey[] = [
  "interviewId", "consultant", "recruiter", "submission", "level",
  "vendor", "client", "techSupport", "amount", "status",
];

const EMPTY_FILTERS = (): Filters => ({
  interviewId: new Set(),
  consultant: new Set(),
  recruiter: new Set(),
  submission: new Set(),
  level: new Set(),
  vendor: new Set(),
  client: new Set(),
  techSupport: new Set(),
  amount: new Set(),
  status: new Set(),
});

function getFilterValue(interview: InterviewRecord, key: FilterKey): string {
  switch (key) {
    case "interviewId":
      return interview.interviewId;
    case "consultant":
      return `${interview.submission.consultant.firstName} ${interview.submission.consultant.lastName}`;
    case "recruiter":
      return `${interview.recruiter.firstName} ${interview.recruiter.lastName}`;
    case "submission":
      return interview.submission.submissionId;
    case "level":
      return interview.interviewLevel;
    case "vendor":
      return interview.submission.vendorCompany;
    case "client":
      return interview.submission.clientName?.trim() || "—";
    case "techSupport":
      return interview.techSupport
        ? `${interview.techSupport.firstName} ${interview.techSupport.lastName}`
        : "—";
    case "amount":
      return interview.amount?.trim() || "—";
    case "status":
      return interview.interviewStatus;
  }
}

export function InterviewList({
  interviews,
  onSelect,
  initialSearch = "",
  initialIds,
}: {
  interviews: InterviewRecord[];
  onSelect?: (id: string) => void;
  initialSearch?: string;
  initialIds?: string[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { toast, show, hide } = useToast();
  const [sortCol, setSortCol] = useState<SortCol>("date");
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
    if (!initialIds?.length) return interviews;
    const idSet = new Set(initialIds);
    return interviews.filter((iv) => idSet.has(iv.id));
  }, [interviews, initialIds]);

  const searched = useMemo(() => {
    return filterBySearch(scoped, searchQuery, (iv) => searchBlob(
      iv.interviewId, iv.interviewLevel, iv.interviewStatus, iv.amount, iv.techSupportFeedback,
      iv.recruiter.firstName, iv.recruiter.lastName,
      iv.submission.submissionId, iv.submission.technology, iv.submission.vendorCompany,
      iv.submission.clientName, iv.submission.consultant.firstName, iv.submission.consultant.lastName,
      iv.techSupport?.firstName, iv.techSupport?.lastName,
    ));
  }, [scoped, searchQuery]);

  const filterOptions = useMemo(() => {
    return buildCascadingFilterOptions(
      searched,
      filters,
      FILTER_KEYS,
      getFilterValue,
      (interview) => matchesDateFilters(interview.interviewStartDate, datePresets, customFrom, customTo),
    );
  }, [searched, filters, datePresets, customFrom, customTo]);

  useEffect(() => {
    setFilters((prev) => {
      const pruned = pruneStaleFilters(prev, filterOptions);
      return pruned ?? prev;
    });
  }, [filterOptions]);

  const filtered = useMemo(() => {
    return searched.filter((interview) => {
      const matchesFields = (Object.keys(filters) as FilterKey[]).every((key) => {
        const selected = filters[key];
        if (selected.size === 0) return true;
        return selected.has(getFilterValue(interview, key));
      });
      if (!matchesFields) return false;
      return matchesDateFilters(interview.interviewStartDate, datePresets, customFrom, customTo);
    });
  }, [searched, filters, datePresets, customFrom, customTo]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortCol) {
        case "interviewId":  return dir * a.interviewId.localeCompare(b.interviewId);
        case "date":         return dir * (new Date(a.interviewStartDate).getTime() - new Date(b.interviewStartDate).getTime());
        case "consultant":   return dir * (`${a.submission.consultant.firstName} ${a.submission.consultant.lastName}`).localeCompare(`${b.submission.consultant.firstName} ${b.submission.consultant.lastName}`);
        case "recruiter":    return dir * (`${a.recruiter.firstName} ${a.recruiter.lastName}`).localeCompare(`${b.recruiter.firstName} ${b.recruiter.lastName}`);
        case "submission":   return dir * a.submission.submissionId.localeCompare(b.submission.submissionId);
        case "level":        return dir * a.interviewLevel.localeCompare(b.interviewLevel);
        case "vendor":       return dir * a.submission.vendorCompany.localeCompare(b.submission.vendorCompany);
        case "client":       return dir * (a.submission.clientName ?? "").localeCompare(b.submission.clientName ?? "");
        case "techSupport":  return dir * (`${a.techSupport?.firstName ?? ""} ${a.techSupport?.lastName ?? ""}`).localeCompare(`${b.techSupport?.firstName ?? ""} ${b.techSupport?.lastName ?? ""}`);
        case "amount":       return dir * (parseFloat(a.amount ?? "0") - parseFloat(b.amount ?? "0"));
        case "status":       return dir * a.interviewStatus.localeCompare(b.interviewStatus);
        default: return 0;
      }
    });
  }, [filtered, sortCol, sortDir]);

  const activeFilterCount = useMemo(() => {
    const fieldCount = (Object.values(filters) as Set<string>[]).filter((set) => set.size > 0).length;
    const dateCount = datePresets.size > 0 || customFrom || customTo ? 1 : 0;
    return fieldCount + dateCount;
  }, [filters, datePresets, customFrom, customTo]);

  const fmtDate = (d: string | Date) =>
    new Date(d).toLocaleDateString("en-US", { dateStyle: "medium" });

  const updateStatus = (id: string, interviewStatus: string) => {
    setUpdatingId(id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/interviews/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interviewStatus }),
        });
        if (!res.ok) throw new Error("Failed");
        router.refresh();
      } catch {
        show("Failed to update status", "error");
      } finally {
        setUpdatingId(null);
      }
    });
  };

  const thFixed = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300 whitespace-nowrap";
  const filterAccent = "text-indigo-600";
  const filterHover = "hover:bg-indigo-50";
  const openInterview = (id: string) => {
    if (onSelect) onSelect(id);
    else router.push(`/admin/interviews/${id}`);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50">
            <Calendar className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">All Interviews</h3>
            <p className="text-xs text-slate-500">
              {activeFilterCount > 0 || searchQuery || initialIds?.length
                ? `${sorted.length} of ${initialIds?.length ? scoped.length : interviews.length} shown`
                : `${interviews.length} total`}
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
            className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
          >
            Clear all filters ({activeFilterCount})
          </button>
        )}
          <TabSearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search interviews…" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-800">
            <tr>
              <CheckboxHeaderFilter
                label="Interview ID"
                sortCol="interviewId"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={toggleSort}
                options={filterOptions.interviewId}
                selected={filters.interviewId}
                onChange={(next) => setFilter("interviewId", next)}
                accentClass={filterAccent}
                hoverClass={filterHover}
              />
              <DateHeaderFilter
                sortCol="date"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={toggleSort}
                selectedPresets={datePresets}
                onPresetsChange={setDatePresets}
                customFrom={customFrom}
                customTo={customTo}
                onCustomFromChange={setCustomFrom}
                onCustomToChange={setCustomTo}
                accentClass={filterAccent}
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
                accentClass={filterAccent}
                hoverClass={filterHover}
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
                accentClass={filterAccent}
                hoverClass={filterHover}
              />
              <CheckboxHeaderFilter
                label="Submission"
                sortCol="submission"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={toggleSort}
                options={filterOptions.submission}
                selected={filters.submission}
                onChange={(next) => setFilter("submission", next)}
                accentClass={filterAccent}
                hoverClass={filterHover}
              />
              <th className={thFixed}>Duration</th>
              <CheckboxHeaderFilter
                label="Level"
                sortCol="level"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={toggleSort}
                options={filterOptions.level}
                selected={filters.level}
                onChange={(next) => setFilter("level", next)}
                accentClass={filterAccent}
                hoverClass={filterHover}
              />
              <CheckboxHeaderFilter
                label="Vendor"
                sortCol="vendor"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={toggleSort}
                options={filterOptions.vendor}
                selected={filters.vendor}
                onChange={(next) => setFilter("vendor", next)}
                accentClass={filterAccent}
                hoverClass={filterHover}
              />
              <CheckboxHeaderFilter
                label="Client"
                sortCol="client"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={toggleSort}
                options={filterOptions.client}
                selected={filters.client}
                onChange={(next) => setFilter("client", next)}
                accentClass={filterAccent}
                hoverClass={filterHover}
              />
              <CheckboxHeaderFilter
                label="Tech Support"
                sortCol="techSupport"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={toggleSort}
                options={filterOptions.techSupport}
                selected={filters.techSupport}
                onChange={(next) => setFilter("techSupport", next)}
                accentClass={filterAccent}
                hoverClass={filterHover}
              />
              <CheckboxHeaderFilter
                label="Amount"
                sortCol="amount"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={toggleSort}
                options={filterOptions.amount}
                selected={filters.amount}
                onChange={(next) => setFilter("amount", next)}
                accentClass={filterAccent}
                hoverClass={filterHover}
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
                accentClass={filterAccent}
                hoverClass={filterHover}
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-12 text-center text-slate-400">
                  {interviews.length === 0 ? "No interviews yet." : "No interviews match the selected filters."}
                </td>
              </tr>
            ) : (
              sorted.map((iv) => (
                <tr key={iv.id} className="hover:bg-indigo-50/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openInterview(iv.id)}
                      className="text-blue-700 hover:text-blue-900 hover:underline"
                    >
                      <HighlightText text={iv.interviewId} query={searchQuery} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                    <HighlightText text={fmtDate(iv.interviewStartDate)} query={searchQuery} />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap text-xs">
                    <HighlightText text={`${iv.submission.consultant.firstName} ${iv.submission.consultant.lastName}`} query={searchQuery} />
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                    <HighlightText text={`${iv.recruiter.firstName} ${iv.recruiter.lastName}`} query={searchQuery} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                    <HighlightText text={iv.submission.submissionId} query={searchQuery} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                      <HighlightText text={calcDuration(iv.interviewStartDate, iv.interviewEndDate)} query={searchQuery} />
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant={LEVEL_VARIANT[iv.interviewLevel] ?? "default"}>
                      <HighlightText text={iv.interviewLevel} query={searchQuery} />
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                    <HighlightText text={iv.submission.vendorCompany} query={searchQuery} />
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                    <HighlightText text={iv.submission.clientName} query={searchQuery} />
                    {iv.submission.clientLocation && (
                      <span className="block text-xs text-slate-400">
                        <HighlightText text={iv.submission.clientLocation} query={searchQuery} />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                    <HighlightText
                      text={iv.techSupport ? `${iv.techSupport.firstName} ${iv.techSupport.lastName}` : undefined}
                      query={searchQuery}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                    <HighlightText text={iv.amount} query={searchQuery} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <select
                      value={iv.interviewStatus}
                      disabled={updatingId === iv.id}
                      onChange={(e) => updateStatus(iv.id, e.target.value)}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 disabled:opacity-50"
                    >
                      {INTERVIEW_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
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
