"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { filterBySearch, searchBlob } from "@/lib/table-search";
import { TabSearchBar } from "@/components/ui/tab-search-bar";
import { HighlightText } from "@/components/ui/highlight-text";
import {
  CheckboxHeaderFilter,
  DateHeaderFilter,
  buildCascadingFilterOptions,
  matchesDateFilters,
  pruneStaleFilters,
  type DatePreset,
} from "@/components/ui/table-column-filters";
import {
  DollarSign,
  Trash2,
  FileText,
  TrendingUp,
} from "lucide-react";

interface Expense {
  id: string;
  expenseId: string;
  date: string;
  category: string;
  description: string | null;
  amount: number;
  location: string;
  receiptFile: string | null;
  status: string;
  notes: string | null;
  submittedBy: { id: string; firstName: string; lastName: string; email: string };
  consultant: { id: string; firstName: string; lastName: string } | null;
}

type SortDir = "asc" | "desc";
type SortCol =
  | "expenseId"
  | "date"
  | "submittedBy"
  | "consultant"
  | "category"
  | "amount"
  | "location"
  | "status"
  | "receipt";
type FilterKey = Exclude<SortCol, "date">;
type Filters = Record<FilterKey, Set<string>>;
const FILTER_KEYS: FilterKey[] = [
  "expenseId", "submittedBy", "consultant", "category", "amount", "location", "status", "receipt",
];


const CATEGORY_ICONS: Record<string, string> = {
  "Travel": "✈️",
  "Food & Meals": "🍽️",
  Accommodation: "🏨",
  "Office Supplies": "📎",
  Training: "📚",
  Communication: "📡",
  Software: "💻",
  Other: "📦",
};

const STATUS_STYLE: Record<string, string> = {
  Approved: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-rose-100 text-rose-700",
  Pending: "bg-amber-100 text-amber-700",
};

const LOCATION_STYLE: Record<string, string> = {
  Onsite: "border-blue-200 bg-blue-50 text-blue-700",
  Offshore: "border-indigo-200 bg-indigo-50 text-indigo-700",
};

const EMPTY_FILTERS = (): Filters => ({
  expenseId: new Set(),
  submittedBy: new Set(),
  consultant: new Set(),
  category: new Set(),
  amount: new Set(),
  location: new Set(),
  status: new Set(),
  receipt: new Set(),
});

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtMoney(amount: number) {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

function getFilterValue(expense: Expense, key: FilterKey): string {
  switch (key) {
    case "expenseId":
      return expense.expenseId;
    case "submittedBy":
      return `${expense.submittedBy.firstName} ${expense.submittedBy.lastName}`;
    case "consultant":
      return expense.consultant ? `${expense.consultant.firstName} ${expense.consultant.lastName}` : "—";
    case "category":
      return expense.category;
    case "amount":
      return fmtMoney(expense.amount);
    case "location":
      return expense.location;
    case "status":
      return expense.status;
    case "receipt":
      return expense.receiptFile ? "Has Receipt" : "No Receipt";
  }
}

export function ExpenseList({ expenses, onSelect }: { expenses: Expense[]; onSelect?: (id: string) => void }) {
  const [list, setList] = useState(expenses);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setList(expenses);
  }, [expenses]);
  const [sortCol, setSortCol] = useState<SortCol>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [datePresets, setDatePresets] = useState<Set<DatePreset>>(new Set());
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [, startTransition] = useTransition();
  const { toast, show, hide } = useToast();
  const router = useRouter();

  const deleteExpense = (id: string, expenseId: string) => {
    if (!confirm(`Delete expense ${expenseId}?`)) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Delete failed");
        setList((prev) => prev.filter((e) => e.id !== id));
        show(`Expense ${expenseId} deleted`, "success");
        router.refresh();
      } catch {
        show("Failed to delete expense", "error");
      }
    });
  };

  const setFilter = (key: FilterKey, next: Set<string>) =>
    setFilters((prev) => ({ ...prev, [key]: next }));

  const searched = useMemo(() => {
    return filterBySearch(list, searchQuery, (e) => searchBlob(
      e.expenseId, e.category, e.description, e.location, e.status, e.notes,
      e.submittedBy.firstName, e.submittedBy.lastName, e.submittedBy.email,
      e.consultant?.firstName, e.consultant?.lastName, fmtMoney(e.amount),
    ));
  }, [list, searchQuery]);

  const filterOptions = useMemo(() => {
    return buildCascadingFilterOptions(
      searched,
      filters,
      FILTER_KEYS,
      getFilterValue,
      (expense) => matchesDateFilters(expense.date, datePresets, customFrom, customTo),
    );
  }, [searched, filters, datePresets, customFrom, customTo]);

  useEffect(() => {
    setFilters((prev) => {
      const pruned = pruneStaleFilters(prev, filterOptions);
      return pruned ?? prev;
    });
  }, [filterOptions]);

  const filtered = useMemo(() => {
    return searched.filter((expense) => {
      const matchesFields = FILTER_KEYS.every((key) => {
        const selected = filters[key];
        if (selected.size === 0) return true;
        return selected.has(getFilterValue(expense, key));
      });
      if (!matchesFields) return false;
      return matchesDateFilters(expense.date, datePresets, customFrom, customTo);
    });
  }, [searched, filters, datePresets, customFrom, customTo]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortCol) {
        case "expenseId":
          return dir * a.expenseId.localeCompare(b.expenseId);
        case "date":
          return dir * (new Date(a.date).getTime() - new Date(b.date).getTime());
        case "submittedBy":
          return dir * (`${a.submittedBy.firstName} ${a.submittedBy.lastName}`).localeCompare(`${b.submittedBy.firstName} ${b.submittedBy.lastName}`);
        case "consultant":
          return dir * ((a.consultant ? `${a.consultant.firstName} ${a.consultant.lastName}` : "").localeCompare(b.consultant ? `${b.consultant.firstName} ${b.consultant.lastName}` : ""));
        case "category":
          return dir * a.category.localeCompare(b.category);
        case "amount":
          return dir * (a.amount - b.amount);
        case "location":
          return dir * a.location.localeCompare(b.location);
        case "status":
          return dir * a.status.localeCompare(b.status);
        case "receipt":
          return dir * ((a.receiptFile ? 1 : 0) - (b.receiptFile ? 1 : 0));
      }
    });
  }, [filtered, sortCol, sortDir]);

  const activeFilterCount = useMemo(() => {
    const fieldCount = (Object.values(filters) as Set<string>[]).filter((set) => set.size > 0).length;
    const dateCount = datePresets.size > 0 || customFrom || customTo ? 1 : 0;
    return fieldCount + dateCount;
  }, [filters, datePresets, customFrom, customTo]);

  if (list.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
          <DollarSign className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-700">No expenses recorded yet</p>
        <p className="mt-1 text-xs text-slate-400">Use the New Expense button to submit the first one.</p>
      </div>
    );
  }

  const total = list.reduce((sum, e) => sum + e.amount, 0);
  const approvedTotal = list.filter((e) => e.status === "Approved").reduce((sum, e) => sum + e.amount, 0);
  const pendingCount = list.filter((e) => e.status === "Pending").length;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50">
            <DollarSign className="h-4 w-4 text-teal-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Expense Records</h3>
            <p className="text-xs text-slate-500">
              {activeFilterCount > 0 || searchQuery ? `${sorted.length} of ${list.length} shown` : `${list.length} total`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 sm:ml-auto">
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setFilters(EMPTY_FILTERS());
                setDatePresets(new Set());
                setCustomFrom("");
                setCustomTo("");
              }}
              className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-100"
            >
              Clear all filters ({activeFilterCount})
            </button>
          )}
          {pendingCount > 0 && (
            <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1">
              <span className="text-xs font-semibold text-amber-700">{pendingCount} Pending</span>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2">
            <TrendingUp className="h-3.5 w-3.5 text-teal-600" />
            <div>
              <p className="text-[9px] font-bold uppercase text-teal-600/70">Total</p>
              <p className="text-sm font-bold text-teal-700">{fmtMoney(total)}</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 md:flex">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            <div>
              <p className="text-[9px] font-bold uppercase text-emerald-600/70">Approved</p>
              <p className="text-sm font-bold text-emerald-700">{fmtMoney(approvedTotal)}</p>
            </div>
          </div>
          <TabSearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search expenses…" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-left">
              <CheckboxHeaderFilter
                label="Expense ID"
                sortCol="expenseId"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={(col) => setSortCol((prev) => {
                  if (prev === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                  else setSortDir("asc");
                  return col;
                })}
                options={filterOptions.expenseId}
                selected={filters.expenseId}
                onChange={(next) => setFilter("expenseId", next)}
              />
              <DateHeaderFilter
                sortCol="date"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={(col) => setSortCol((prev) => {
                  if (prev === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                  else setSortDir("asc");
                  return col;
                })}
                selectedPresets={datePresets}
                onPresetsChange={setDatePresets}
                customFrom={customFrom}
                customTo={customTo}
                onCustomFromChange={setCustomFrom}
                onCustomToChange={setCustomTo}
                accentClass="text-teal-600"
                thClassName="relative px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap"
              />
              <CheckboxHeaderFilter
                label="Submitted By"
                sortCol="submittedBy"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={(col) => setSortCol((prev) => {
                  if (prev === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                  else setSortDir("asc");
                  return col;
                })}
                options={filterOptions.submittedBy}
                selected={filters.submittedBy}
                onChange={(next) => setFilter("submittedBy", next)}
              />
              <CheckboxHeaderFilter
                label="Consultant"
                sortCol="consultant"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={(col) => setSortCol((prev) => {
                  if (prev === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                  else setSortDir("asc");
                  return col;
                })}
                options={filterOptions.consultant}
                selected={filters.consultant}
                onChange={(next) => setFilter("consultant", next)}
              />
              <CheckboxHeaderFilter
                label="Category"
                sortCol="category"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={(col) => setSortCol((prev) => {
                  if (prev === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                  else setSortDir("asc");
                  return col;
                })}
                options={filterOptions.category}
                selected={filters.category}
                onChange={(next) => setFilter("category", next)}
              />
              <CheckboxHeaderFilter
                label="Amount"
                sortCol="amount"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={(col) => setSortCol((prev) => {
                  if (prev === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                  else setSortDir("asc");
                  return col;
                })}
                options={filterOptions.amount}
                selected={filters.amount}
                onChange={(next) => setFilter("amount", next)}
              />
              <CheckboxHeaderFilter
                label="Location"
                sortCol="location"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={(col) => setSortCol((prev) => {
                  if (prev === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                  else setSortDir("asc");
                  return col;
                })}
                options={filterOptions.location}
                selected={filters.location}
                onChange={(next) => setFilter("location", next)}
              />
              <CheckboxHeaderFilter
                label="Status"
                sortCol="status"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={(col) => setSortCol((prev) => {
                  if (prev === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                  else setSortDir("asc");
                  return col;
                })}
                options={filterOptions.status}
                selected={filters.status}
                onChange={(next) => setFilter("status", next)}
              />
              <CheckboxHeaderFilter
                label="Receipt"
                sortCol="receipt"
                sortDir={sortDir}
                currentSort={sortCol}
                onSort={(col) => setSortCol((prev) => {
                  if (prev === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                  else setSortDir("asc");
                  return col;
                })}
                options={filterOptions.receipt}
                selected={filters.receipt}
                onChange={(next) => setFilter("receipt", next)}
              />
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-5 py-10 text-center text-sm text-slate-400">
                  No expenses match the selected filters.
                </td>
              </tr>
            ) : (
              sorted.map((e) => (
                <tr key={e.id} className={cn("transition-colors hover:bg-teal-50/20", e.status === "Rejected" && "opacity-70")}>
                  <td className="px-5 py-3.5">
                    <button
                      type="button"
                      onClick={() => onSelect?.(e.id)}
                      className="font-mono text-xs font-bold text-teal-700 transition-colors hover:text-teal-900 hover:underline"
                    >
                      <HighlightText text={e.expenseId} query={searchQuery} />
                    </button>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-600">
                    <HighlightText text={fmtDate(e.date)} query={searchQuery} />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">
                        {initials(`${e.submittedBy.firstName} ${e.submittedBy.lastName}`)}
                      </div>
                      <div className="min-w-0">
                        <p className="whitespace-nowrap text-xs font-semibold text-slate-900">
                          <HighlightText text={`${e.submittedBy.firstName} ${e.submittedBy.lastName}`} query={searchQuery} />
                        </p>
                        <p className="max-w-[140px] truncate text-[10px] text-slate-400">
                          <HighlightText text={e.submittedBy.email} query={searchQuery} />
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-600">
                    <HighlightText
                      text={e.consultant ? `${e.consultant.firstName} ${e.consultant.lastName}` : undefined}
                      query={searchQuery}
                    />
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                      <span>{CATEGORY_ICONS[e.category] ?? "📦"}</span>
                      <HighlightText text={e.category} query={searchQuery} />
                    </span>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className="text-sm font-bold text-slate-900">
                      <HighlightText text={fmtMoney(e.amount)} query={searchQuery} />
                    </span>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", LOCATION_STYLE[e.location] ?? "border-slate-200 bg-slate-50 text-slate-600")}>
                      <HighlightText text={e.location} query={searchQuery} />
                    </span>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLE[e.status] ?? "bg-slate-100 text-slate-600")}>
                      <HighlightText text={e.status} query={searchQuery} />
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {e.receiptFile ? (
                      <a
                        href={`/uploads/receipts/${e.receiptFile}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-100"
                      >
                        <FileText className="h-3 w-3" />
                        View
                      </a>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => deleteExpense(e.id, e.expenseId)}
                      className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
                      title="Delete expense"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
