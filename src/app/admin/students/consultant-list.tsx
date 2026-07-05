"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  normalizeConsultantComments,
  type ConsultantComment,
} from "@/lib/premarketing-checklist";
import { PROJECT_STATUS_COLORS } from "@/lib/project-status";
import { filterBySearch, searchBlob } from "@/lib/table-search";
import { TabSearchBar } from "@/components/ui/tab-search-bar";
import { HighlightText } from "@/components/ui/highlight-text";
import {
  CheckboxHeaderFilter,
  buildCascadingFilterOptions,
  pruneStaleFilters,
  type SortDir,
} from "@/components/ui/table-column-filters";
import { GraduationCap, ExternalLink } from "lucide-react";

type Consultant = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  personalPhone?: string | null;
  technology?: string | null;
  visaStatus?: string | null;
  marketingVisaStatus?: string | null;
  projectStatus?: string | null;
  offerLetterType?: string | null;
  workMode?: string | null;
  comments?: ConsultantComment[] | unknown[];
  onboardingStartDate?: string | null;
  marketingStartDate?: string | null;
  createdAt: string;
  driveLocation?: string | null;
};

type FilterKey =
  | "name"
  | "email"
  | "technology"
  | "visaStatus"
  | "marketingVisaStatus"
  | "projectStatus"
  | "daysInMarket"
  | "comments";

type Filters = Record<FilterKey, Set<string>>;
const FILTER_KEYS: FilterKey[] = [
  "name", "email", "technology", "visaStatus", "marketingVisaStatus",
  "projectStatus", "daysInMarket", "comments",
];

const EMPTY_FILTERS = (): Filters => ({
  name: new Set(),
  email: new Set(),
  technology: new Set(),
  visaStatus: new Set(),
  marketingVisaStatus: new Set(),
  projectStatus: new Set(),
  daysInMarket: new Set(),
  comments: new Set(),
});

const WORK_MODE_COLOR: Record<string, string> = {
  Remote: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Hybrid: "border-amber-200 bg-amber-50 text-amber-700",
  Onsite: "border-blue-200 bg-blue-50 text-blue-700",
};

const TECH_COLOR: Record<string, string> = {
  ".Net": "bg-purple-100 text-purple-700",
  Java: "bg-orange-100 text-orange-700",
  DE: "bg-cyan-100 text-cyan-700",
  "DS/GenAi/ML": "bg-pink-100 text-pink-700",
  Devops: "bg-teal-100 text-teal-700",
  Mainframes: "bg-slate-100 text-slate-700",
  Networking: "bg-blue-100 text-blue-700",
  BA: "bg-amber-100 text-amber-700",
  "Sales Force": "bg-indigo-100 text-indigo-700",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function parseComments(value: Consultant["comments"]): ConsultantComment[] {
  return normalizeConsultantComments(value);
}

function daysBetween(startDate: string | null | undefined): number | null {
  if (!startDate) return null;
  const start = new Date(startDate);
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diff < 0 ? 0 : diff;
}

function getDaysMetric(consultant: Consultant): number | null {
  if (consultant.projectStatus === "Pre-Marketing") {
    return daysBetween(consultant.onboardingStartDate ?? consultant.createdAt);
  }
  if (consultant.projectStatus === "In-Market") {
    return daysBetween(consultant.marketingStartDate);
  }
  return null;
}

function daysInMarketLabel(days: number | null): string {
  if (days === null) return "Not started";
  if (days === 0) return "0 days";
  return `${days} day${days === 1 ? "" : "s"}`;
}

function commentFilterLabel(comments: ConsultantComment[]): string {
  return comments.length > 0 ? "Has comments" : "No comments";
}

function getFilterValue(c: Consultant, key: FilterKey): string {
  const comments = parseComments(c.comments);
  switch (key) {
    case "name":
      return `${c.firstName} ${c.lastName}`;
    case "email":
      return c.email;
    case "technology":
      return c.technology?.trim() || "—";
    case "visaStatus":
      return c.visaStatus?.trim() || "—";
    case "marketingVisaStatus":
      return c.marketingVisaStatus?.trim() || "—";
    case "projectStatus":
      return c.projectStatus?.trim() || "—";
    case "daysInMarket":
      return daysInMarketLabel(getDaysMetric(c));
    case "comments":
      return commentFilterLabel(comments);
  }
}

export function ConsultantList({
  consultants,
  onSelect,
}: {
  consultants: Consultant[];
  onSelect?: (id: string) => void;
}) {
  const [sortCol, setSortCol] = useState("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [searchQuery, setSearchQuery] = useState("");

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  const searched = useMemo(() => {
    return filterBySearch(consultants, searchQuery, (c) => searchBlob(
      c.firstName, c.lastName, c.email, c.personalPhone, c.technology,
      c.visaStatus, c.marketingVisaStatus, c.projectStatus, c.driveLocation,
      ...parseComments(c.comments).map((cm) => cm.note || cm.item),
    ));
  }, [consultants, searchQuery]);

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
    return searched.filter((c) =>
      FILTER_KEYS.every((key) => {
        const selected = filters[key];
        if (selected.size === 0) return true;
        return selected.has(getFilterValue(c, key));
      })
    );
  }, [searched, filters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortCol) {
        case "name":
          return dir * `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
        case "email":
          return dir * a.email.localeCompare(b.email);
        case "technology":
          return dir * (a.technology ?? "").localeCompare(b.technology ?? "");
        case "visaStatus":
          return dir * (a.visaStatus ?? "").localeCompare(b.visaStatus ?? "");
        case "marketingVisaStatus":
          return dir * (a.marketingVisaStatus ?? "").localeCompare(b.marketingVisaStatus ?? "");
        case "projectStatus":
          return dir * (a.projectStatus ?? "").localeCompare(b.projectStatus ?? "");
        case "daysInMarket": {
          const aDays = getDaysMetric(a) ?? -1;
          const bDays = getDaysMetric(b) ?? -1;
          return dir * (aDays - bDays);
        }
        case "comments":
          return dir * (parseComments(a.comments).length - parseComments(b.comments).length);
        default:
          return 0;
      }
    });
  }, [filtered, sortCol, sortDir]);

  const activeFilterCount = useMemo(
    () => (Object.values(filters) as Set<string>[]).filter((s) => s.size > 0).length,
    [filters]
  );

  const activeCount = consultants.filter((c) => c.projectStatus === "In-Project").length;
  const inMarketCount = consultants.filter((c) => c.projectStatus === "In-Market").length;
  const preMarketingCount = consultants.filter((c) => c.projectStatus === "Pre-Marketing").length;

  const setFilter = (key: FilterKey, next: Set<string>) =>
    setFilters((prev) => ({ ...prev, [key]: next }));

  if (consultants.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
          <GraduationCap className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-700">No consultants onboarded yet</p>
        <p className="text-xs text-slate-400 mt-1">Add a consultant using the button above</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50">
            <GraduationCap className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Consultants</h3>
            <p className="text-xs text-slate-500">
              {activeFilterCount > 0 || searchQuery
                ? `${sorted.length} of ${consultants.length} shown`
                : `${consultants.length} onboarded`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:ml-auto">
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS())}
              className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              Clear all filters ({activeFilterCount})
            </button>
          )}
          <div className="hidden sm:flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span className="text-xs font-semibold text-amber-700">{preMarketingCount} Pre-Marketing</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-emerald-700">{activeCount} On Project</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              <span className="text-xs font-semibold text-slate-600">{inMarketCount} In Market</span>
            </div>
          </div>
          <TabSearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search consultants…" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-left">
              <CheckboxHeaderFilter
                label="Consultant"
                sortCol="name"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={toggleSort}
                options={filterOptions.name}
                selected={filters.name}
                onChange={(next) => setFilter("name", next)}
                accentClass="text-violet-600"
                hoverClass="hover:bg-violet-50"
                thClassName="relative px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap"
              />
              <CheckboxHeaderFilter
                label="Contact"
                sortCol="email"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={toggleSort}
                options={filterOptions.email}
                selected={filters.email}
                onChange={(next) => setFilter("email", next)}
                accentClass="text-violet-600"
                hoverClass="hover:bg-violet-50"
                thClassName="relative px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap"
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
                accentClass="text-violet-600"
                hoverClass="hover:bg-violet-50"
                thClassName="relative px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap"
              />
              <CheckboxHeaderFilter
                label="Original Visa"
                sortCol="visaStatus"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={toggleSort}
                options={filterOptions.visaStatus}
                selected={filters.visaStatus}
                onChange={(next) => setFilter("visaStatus", next)}
                accentClass="text-violet-600"
                hoverClass="hover:bg-violet-50"
                thClassName="relative px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap"
              />
              <CheckboxHeaderFilter
                label="Marketing Visa"
                sortCol="marketingVisaStatus"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={toggleSort}
                options={filterOptions.marketingVisaStatus}
                selected={filters.marketingVisaStatus}
                onChange={(next) => setFilter("marketingVisaStatus", next)}
                accentClass="text-violet-600"
                hoverClass="hover:bg-violet-50"
                thClassName="relative px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap"
              />
              <CheckboxHeaderFilter
                label="Project Status"
                sortCol="projectStatus"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={toggleSort}
                options={filterOptions.projectStatus}
                selected={filters.projectStatus}
                onChange={(next) => setFilter("projectStatus", next)}
                accentClass="text-violet-600"
                hoverClass="hover:bg-violet-50"
                thClassName="relative px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap"
              />
              <CheckboxHeaderFilter
                label="Days"
                sortCol="daysInMarket"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={toggleSort}
                options={filterOptions.daysInMarket}
                selected={filters.daysInMarket}
                onChange={(next) => setFilter("daysInMarket", next)}
                accentClass="text-violet-600"
                hoverClass="hover:bg-violet-50"
                thClassName="relative px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap"
              />
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap">Drive</th>
              <CheckboxHeaderFilter
                label="Comments"
                sortCol="comments"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={toggleSort}
                options={filterOptions.comments}
                selected={filters.comments}
                onChange={(next) => setFilter("comments", next)}
                accentClass="text-violet-600"
                hoverClass="hover:bg-violet-50"
                thClassName="relative px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap"
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-sm text-slate-400">
                  {consultants.length === 0 ? "No consultants onboarded yet." : "No consultants match the selected filters."}
                </td>
              </tr>
            ) : (
              sorted.map((c) => {
                const name = `${c.firstName} ${c.lastName}`;
                const projColor =
                  PROJECT_STATUS_COLORS[c.projectStatus ?? ""] ?? PROJECT_STATUS_COLORS["Pre-Marketing"];
                const comments = parseComments(c.comments);
                const days = getDaysMetric(c);
                return (
                  <tr key={c.id} className="hover:bg-indigo-50/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                          {initials(name)}
                        </div>
                        <button
                          type="button"
                          onClick={() => onSelect?.(c.id)}
                          className="font-semibold text-slate-900 whitespace-nowrap text-left transition-colors hover:text-indigo-600 hover:underline"
                        >
                          <HighlightText text={name} query={searchQuery} />
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-xs text-slate-600 truncate max-w-[160px]">
                        <HighlightText text={c.email} query={searchQuery} />
                      </p>
                      {c.personalPhone && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          <HighlightText text={c.personalPhone} query={searchQuery} />
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {c.technology ? (
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                            TECH_COLOR[c.technology] ?? "bg-slate-100 text-slate-700"
                          )}
                        >
                          <HighlightText text={c.technology} query={searchQuery} />
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {c.visaStatus ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                          <HighlightText text={c.visaStatus} query={searchQuery} />
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {c.marketingVisaStatus ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                          <HighlightText text={c.marketingVisaStatus} query={searchQuery} />
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {c.projectStatus ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                            projColor.bg,
                            projColor.text
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", projColor.dot)} />
                          <HighlightText text={c.projectStatus} query={searchQuery} />
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {days !== null ? (
                        <div>
                          <p className="text-xs font-semibold text-indigo-700">{days}</p>
                          <p className="text-[10px] text-slate-400">days</p>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {c.driveLocation ? (
                        <a
                          href={c.driveLocation}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                        >
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="w-[240px] max-w-[240px] px-5 py-3.5 align-top">
                      {comments.length > 0 ? (
                        <ul className="list-disc space-y-1 pl-4 text-[10px] leading-relaxed text-slate-500">
                          {comments.map((comment, index) => (
                            <li
                              key={`${comment.updatedAt}-${index}`}
                              className="whitespace-normal break-words"
                              title={comment.note || comment.item || "Pre-Marketing comment"}
                            >
                              <HighlightText
                                text={comment.note || comment.item || "Pre-Marketing comment"}
                                query={searchQuery}
                              />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
