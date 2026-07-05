"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { buildRecruiterUrl } from "@/lib/recruiter-nav";
import { buildScopedListUrl } from "@/lib/list-deep-link";
import { PROJECT_STATUS_COLORS } from "@/lib/project-status";
import {
  CalendarRange,
  ChevronDown,
  ChevronUp,
  Filter,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import type { RecruiterUser } from "./recruiter-list";

type CandidateRange = "all" | "day" | "week" | "month";

interface DateRangeFilters {
  range: CandidateRange;
  from: string;
  to: string;
}

interface CandidateFilters {
  candidateId: string;
  submissions: DateRangeFilters;
  interviews: DateRangeFilters;
}

const RANGE_OPTIONS: CandidateRange[] = ["all", "day", "week", "month"];
const DEFAULT_DATE_FILTERS: DateRangeFilters = { range: "all", from: "", to: "" };
const DEFAULT_FILTERS: CandidateFilters = {
  candidateId: "",
  submissions: { ...DEFAULT_DATE_FILTERS },
  interviews: { ...DEFAULT_DATE_FILTERS },
};

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { dateStyle: "medium" });
}

function fmtDateTime(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function matchesDateRange(createdAt: string, filters: DateRangeFilters) {
  const createdDate = new Date(createdAt);

  if (filters.from) {
    const from = new Date(filters.from);
    from.setHours(0, 0, 0, 0);
    if (createdDate < from) return false;
  }

  if (filters.to) {
    const to = new Date(filters.to);
    to.setHours(23, 59, 59, 999);
    if (createdDate > to) return false;
  }

  if (filters.from || filters.to) return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (filters.range === "day") {
    const compare = new Date(createdDate);
    compare.setHours(0, 0, 0, 0);
    return compare.getTime() === today.getTime();
  }

  if (filters.range === "week") {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);
    return createdDate >= weekStart;
  }

  if (filters.range === "month") {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    return createdDate >= monthStart;
  }

  return true;
}

function isFilterActive(filters: DateRangeFilters) {
  return Boolean(filters.range !== "all" || filters.from || filters.to);
}

function submissionCustomer(submission: RecruiterUser["assignedCandidates"][number]["submissions"][number]) {
  return submission.clientName?.trim() || submission.vendorCompany?.trim() || "";
}

function matchesSubmissionFilters(
  submission: RecruiterUser["assignedCandidates"][number]["submissions"][number],
  filters: DateRangeFilters
) {
  return matchesDateRange(submission.createdAt, filters);
}

function matchesInterviewFilters(
  interview: RecruiterUser["assignedCandidates"][number]["submissions"][number]["interviews"][number],
  filters: DateRangeFilters
) {
  return matchesDateRange(interview.createdAt, filters);
}

function countActiveFilters(filters: CandidateFilters) {
  let n = 0;
  if (filters.candidateId) n++;
  if (isFilterActive(filters.submissions)) n++;
  if (isFilterActive(filters.interviews)) n++;
  return n;
}

const selectCls =
  "h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20";

export function RecruiterAssignedCandidates({
  recruiterId,
  assignedCandidates,
  variant = "inline",
  initialFiltersOpen = false,
  initialCandidateId,
}: {
  recruiterId: string;
  assignedCandidates: RecruiterUser["assignedCandidates"];
  variant?: "inline" | "panel";
  initialFiltersOpen?: boolean;
  initialCandidateId?: string;
}) {
  const [filters, setFilters] = useState<CandidateFilters>(() => ({
    ...DEFAULT_FILTERS,
    candidateId: initialCandidateId ?? "",
  }));
  const [filtersOpen, setFiltersOpen] = useState(initialFiltersOpen);
  const [activeFilterTab, setActiveFilterTab] = useState<"submissions" | "interviews">("submissions");

  useEffect(() => {
    setFiltersOpen(initialFiltersOpen);
  }, [initialFiltersOpen]);

  useEffect(() => {
    if (initialCandidateId) {
      setFilters((prev) => ({ ...prev, candidateId: initialCandidateId }));
    }
  }, [initialCandidateId]);

  const filteredCandidates = useMemo(() => {
    return assignedCandidates
      .filter((candidate) => !filters.candidateId || candidate.id === filters.candidateId)
      .map((candidate) => {
        const filteredSubmissions = candidate.submissions.filter((submission) =>
          matchesSubmissionFilters(submission, filters.submissions)
        );
        const filteredInterviews = candidate.submissions.flatMap((submission) =>
          submission.interviews
            .filter((interview) => matchesInterviewFilters(interview, filters.interviews))
            .map((interview) => interview)
        );
        return {
          candidate,
          filteredSubmissions,
          filteredInterviews,
          interviewCount: filteredInterviews.length,
          latestSubmission: filteredSubmissions[0] ?? null,
        };
      })
      .filter((entry) => {
        const subActive = isFilterActive(filters.submissions);
        const intActive = isFilterActive(filters.interviews);
        if (!subActive && !intActive) return true;
        if (subActive && intActive) {
          return entry.filteredSubmissions.length > 0 || entry.interviewCount > 0;
        }
        if (subActive) return entry.filteredSubmissions.length > 0;
        return entry.interviewCount > 0;
      });
  }, [assignedCandidates, filters]);

  const totalSubmissions = useMemo(
    () => assignedCandidates.reduce((sum, c) => sum + c.submissions.length, 0),
    [assignedCandidates]
  );

  const totalInterviews = useMemo(
    () => assignedCandidates.reduce(
      (sum, c) => sum + c.submissions.reduce((s, sub) => s + sub.interviews.length, 0),
      0
    ),
    [assignedCandidates]
  );

  const activeFilterCount = countActiveFilters(filters);
  const typeFilters = filters[activeFilterTab];

  const setCandidateFilter = (
    type: "candidate" | "submissions" | "interviews",
    patch: Partial<DateRangeFilters> | { candidateId: string }
  ) => {
    setFilters((current) => {
      if (type === "candidate") {
        return { ...current, candidateId: (patch as { candidateId: string }).candidateId };
      }
      return {
        ...current,
        [type]: { ...current[type], ...(patch as Partial<DateRangeFilters>) },
      };
    });
  };

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  const saveReturnUrl = () => {
    const returnUrl = buildRecruiterUrl({
      expanded: variant === "inline" ? recruiterId : undefined,
      detail: variant === "panel" ? recruiterId : undefined,
      filters: filtersOpen,
      candidate: filters.candidateId || undefined,
    });
    window.history.replaceState(null, "", returnUrl);
  };

  const wrapperCls = cn(
    "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
    variant === "inline" && "border-l-4 border-l-emerald-500"
  );

  return (
    <div className={wrapperCls}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-emerald-50/40 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
            <Users className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Assigned Candidates</p>
            <p className="text-[11px] text-slate-500">
              {filteredCandidates.length} of {assignedCandidates.length} shown
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700">
            {totalSubmissions} submissions
          </span>
          <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700">
            {totalInterviews} interviews
          </span>
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
              filtersOpen || activeFilterCount > 0
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
            {filtersOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Collapsible filters */}
      {filtersOpen && (
        <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
            {/* Candidate */}
            <div className="w-full min-w-[180px] sm:w-auto sm:min-w-[200px]">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Candidate
              </label>
              <select
                value={filters.candidateId}
                onChange={(e) => setCandidateFilter("candidate", { candidateId: e.target.value })}
                className={selectCls}
              >
                <option value="">All candidates ({assignedCandidates.length})</option>
                {assignedCandidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.firstName} {candidate.lastName}
                  </option>
                ))}
              </select>
            </div>

            {/* Submissions / Interviews toggle */}
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <CalendarRange className="h-3 w-3 text-indigo-500" />
                Filter by
              </label>
              <div className="flex h-8 rounded-lg border border-slate-200 bg-white p-0.5">
                {(["submissions", "interviews"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveFilterTab(tab)}
                    className={cn(
                      "rounded-md px-3 text-[11px] font-semibold capitalize transition-colors",
                      activeFilterTab === tab
                        ? "bg-indigo-600 text-white"
                        : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick range */}
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Quick range
              </label>
              <div className="flex h-8 items-center gap-1">
                {RANGE_OPTIONS.map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setCandidateFilter(activeFilterTab, { range })}
                    className={cn(
                      "h-8 rounded-md border px-2.5 text-[11px] font-semibold transition-colors",
                      typeFilters.range === range
                        ? "border-indigo-500 bg-indigo-500 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300"
                    )}
                  >
                    {range === "all" ? "All" : range === "day" ? "1D" : range === "week" ? "1W" : "1M"}
                  </button>
                ))}
              </div>
            </div>

            {/* Date range */}
            <div className="w-[140px]">
              <Input
                compact
                id={`${activeFilterTab}-from`}
                label="From"
                type="date"
                value={typeFilters.from}
                onChange={(e) => setCandidateFilter(activeFilterTab, { from: e.target.value })}
              />
            </div>
            <div className="w-[140px]">
              <Input
                compact
                id={`${activeFilterTab}-to`}
                label="To"
                type="date"
                value={typeFilters.to}
                onChange={(e) => setCandidateFilter(activeFilterTab, { to: e.target.value })}
              />
            </div>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="mb-0.5 text-[11px] font-semibold text-slate-500 hover:text-rose-600 sm:ml-auto"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {/* Active filter chips (when collapsed but filters applied) */}
      {!filtersOpen && activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-4 py-2">
          <Filter className="h-3 w-3 text-slate-400" />
          {filters.candidateId && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
              1 candidate selected
            </span>
          )}
          {isFilterActive(filters.submissions) && (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700">
              Submission filters active
            </span>
          )}
          {isFilterActive(filters.interviews) && (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700">
              Interview filters active
            </span>
          )}
          <button type="button" onClick={clearFilters} className="text-[10px] font-semibold text-slate-500 hover:text-rose-600">
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      {assignedCandidates.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm font-medium text-slate-500">No candidates assigned yet</p>
          <p className="mt-1 text-xs text-slate-400">Candidates will appear here once assigned via Pre-Marketing</p>
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm font-medium text-slate-500">No matches for current filters</p>
          <button type="button" onClick={clearFilters} className="mt-2 text-xs font-semibold text-emerald-600 hover:underline">
            Reset filters
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Candidate</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Marketing Start</th>
                <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">Subs</th>
                <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">Ints</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Customers</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Last Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCandidates.map(({ candidate, filteredSubmissions, filteredInterviews, interviewCount, latestSubmission }) => {
                const candName = `${candidate.firstName} ${candidate.lastName}`;
                const statusColor = PROJECT_STATUS_COLORS[candidate.projectStatus ?? ""] ?? PROJECT_STATUS_COLORS["Pre-Marketing"];
                const customers = filteredSubmissions.length > 0
                  ? [...new Set(filteredSubmissions.map((s) => submissionCustomer(s) || "—"))]
                  : [];
                const subsHref = filteredSubmissions.length > 0
                  ? buildScopedListUrl("/admin/submissions/list", filteredSubmissions)
                  : null;
                const intsHref = filteredInterviews.length > 0
                  ? buildScopedListUrl("/admin/interviews/list", filteredInterviews)
                  : null;

                return (
                  <tr key={candidate.id} className="transition-colors hover:bg-emerald-50/30">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700">
                          {initials(candName)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 whitespace-nowrap">{candName}</p>
                          <p className="truncate text-xs text-slate-500 max-w-[180px]">{candidate.email}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {candidate.technology && (
                              <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                                {candidate.technology}
                              </span>
                            )}
                            {candidate.marketingVisaStatus && (
                              <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                {candidate.marketingVisaStatus}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {candidate.projectStatus ? (
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          statusColor.bg,
                          statusColor.text
                        )}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", statusColor.dot)} />
                          {candidate.projectStatus}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                      {fmtDate(candidate.marketingStartDate)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {subsHref ? (
                        <Link
                          href={subsHref}
                          onClick={saveReturnUrl}
                          title={`View ${filteredSubmissions.length} submission${filteredSubmissions.length === 1 ? "" : "s"} for ${candName}`}
                          className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-sky-100 text-[11px] font-bold text-sky-700 transition-all hover:bg-sky-200 hover:ring-2 hover:ring-sky-300"
                        >
                          {filteredSubmissions.length}
                        </Link>
                      ) : (
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-300">
                          0
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {intsHref ? (
                        <Link
                          href={intsHref}
                          onClick={saveReturnUrl}
                          title={`View ${interviewCount} interview${interviewCount === 1 ? "" : "s"} for ${candName}`}
                          className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-violet-100 text-[11px] font-bold text-violet-700 transition-all hover:bg-violet-200 hover:ring-2 hover:ring-violet-300"
                        >
                          {interviewCount}
                        </Link>
                      ) : (
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-300">
                          0
                        </span>
                      )}
                    </td>
                    <td className="max-w-[160px] px-4 py-3">
                      <p className="truncate text-xs text-slate-600" title={customers.join(", ")}>
                        {customers.length > 0 ? customers.join(", ") : "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {latestSubmission ? (
                        <div>
                          <p className="font-mono text-[11px] font-semibold text-slate-800">{latestSubmission.submissionId}</p>
                          <p className="text-[10px] text-slate-400">{fmtDateTime(latestSubmission.createdAt)}</p>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
