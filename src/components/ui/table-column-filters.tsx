"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { CalendarRange, ChevronDown, ChevronUp, ChevronsUpDown, Filter } from "lucide-react";

export type SortDir = "asc" | "desc";
export type DatePreset = "day" | "week" | "month" | "year";

export const DATE_PRESET_OPTIONS: { id: DatePreset; label: string }[] = [
  { id: "day", label: "1 Day" },
  { id: "week", label: "1 Week" },
  { id: "month", label: "1 Month" },
  { id: "year", label: "1 Year" },
];

export function matchesDatePreset(date: string | Date, preset: DatePreset) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compare = new Date(value);
  compare.setHours(0, 0, 0, 0);

  if (preset === "day") return compare.getTime() === today.getTime();

  if (preset === "week") {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);
    return compare >= weekStart;
  }

  if (preset === "month") {
    const monthStart = new Date(today);
    monthStart.setDate(today.getDate() - 29);
    return compare >= monthStart;
  }

  const yearStart = new Date(today);
  yearStart.setDate(today.getDate() - 364);
  return compare >= yearStart;
}

export function matchesCustomDateRange(date: string | Date, from: string, to: string) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return false;

  if (from) {
    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    if (value < fromDate) return false;
  }

  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    if (value > toDate) return false;
  }

  return true;
}

export function matchesDateFilters(
  date: string | Date,
  presets: Set<DatePreset>,
  customFrom: string,
  customTo: string
) {
  const hasFilter = presets.size > 0 || Boolean(customFrom) || Boolean(customTo);
  if (!hasFilter) return true;

  const presetMatch = [...presets].some((preset) => matchesDatePreset(date, preset));
  const customMatch = (customFrom || customTo) ? matchesCustomDateRange(date, customFrom, customTo) : false;
  return presetMatch || customMatch;
}

/** True when a record matches every active filter except `excludeKey`. */
export function recordMatchesFilters<TRecord, TFilterKey extends string>(
  record: TRecord,
  filters: Record<TFilterKey, Set<string>>,
  getValue: (record: TRecord, key: TFilterKey) => string,
  excludeKey?: TFilterKey,
  dateMatch?: (record: TRecord) => boolean,
) {
  for (const key of Object.keys(filters) as TFilterKey[]) {
    if (key === excludeKey) continue;
    const selected = filters[key];
    if (selected.size === 0) continue;
    if (!selected.has(getValue(record, key))) return false;
  }
  if (dateMatch && !dateMatch(record)) return false;
  return true;
}

/** Build per-column option lists from rows that match all other active filters. */
export function buildCascadingFilterOptions<TRecord, TFilterKey extends string>(
  records: TRecord[],
  filters: Record<TFilterKey, Set<string>>,
  keys: TFilterKey[],
  getValue: (record: TRecord, key: TFilterKey) => string,
  dateMatch?: (record: TRecord) => boolean,
): Record<TFilterKey, string[]> {
  const result = {} as Record<TFilterKey, string[]>;
  for (const key of keys) {
    const values = new Set<string>();
    for (const record of records) {
      if (!recordMatchesFilters(record, filters, getValue, key, dateMatch)) continue;
      values.add(getValue(record, key));
    }
    result[key] = [...values].sort((a, b) => a.localeCompare(b));
  }
  return result;
}

/** Drop selected values that no longer exist in the cascaded option set. */
export function pruneStaleFilters<TFilterKey extends string>(
  filters: Record<TFilterKey, Set<string>>,
  options: Record<TFilterKey, string[]>,
): Record<TFilterKey, Set<string>> | null {
  let changed = false;
  const next = { ...filters };
  for (const key of Object.keys(filters) as TFilterKey[]) {
    const selected = filters[key];
    if (selected.size === 0) continue;
    const allowed = new Set(options[key]);
    const pruned = new Set([...selected].filter((value) => allowed.has(value)));
    if (pruned.size !== selected.size) {
      next[key] = pruned;
      changed = true;
    }
  }
  return changed ? next : null;
}

function useFixedDropdownPosition(
  anchorRef: React.RefObject<HTMLElement | null>,
  open: boolean,
) {
  const [pos, setPos] = useState({ top: 0, left: 0, minWidth: 180 });

  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const update = () => {
      const rect = anchorRef.current!.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left, minWidth: Math.max(rect.width, 180) });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, anchorRef]);

  return pos;
}

function FilterDropdownPortal({
  anchorRef,
  open,
  onClose,
  children,
  className,
  minWidth,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  minWidth?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const pos = useFixedDropdownPosition(anchorRef, open);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose, anchorRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      className={cn("fixed z-[9999] rounded-lg border border-slate-200 bg-white shadow-xl", className)}
      style={{ top: pos.top, left: pos.left, minWidth: minWidth ?? pos.minWidth }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}

export function CheckboxHeaderFilter<T extends string>({
  label,
  sortCol,
  sortDir,
  currentSort,
  onSort,
  options,
  selected,
  onChange,
  accentClass = "text-sky-600",
  hoverClass = "hover:bg-sky-50",
  thClassName = "relative px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-300 whitespace-nowrap",
}: {
  label: string;
  sortCol: T;
  sortDir: SortDir;
  currentSort: T;
  onSort: (col: T) => void;
  options: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  accentClass?: string;
  hoverClass?: string;
  thClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLTableCellElement>(null);
  const active = selected.size > 0;

  const toggle = (value: string) => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  };

  const SortIcon = currentSort !== sortCol
    ? <ChevronsUpDown className="h-3 w-3 opacity-30" />
    : sortDir === "asc"
      ? <ChevronUp className="h-3 w-3" />
      : <ChevronDown className="h-3 w-3" />;

  return (
    <th ref={anchorRef} className={thClassName}>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onSort(sortCol)} className="flex items-center gap-1.5 transition-colors hover:text-white">
          {label}
          {SortIcon}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn("rounded p-0.5 transition-colors hover:text-white", active ? "text-amber-300" : "text-slate-400")}
        >
          <Filter className="h-3 w-3" />
        </button>
      </div>

      <FilterDropdownPortal anchorRef={anchorRef} open={open} onClose={() => setOpen(false)} className="max-w-[260px]">
        <div className="max-h-56 overflow-y-auto py-1">
          {options.length === 0 ? (
            <p className="px-3 py-2 text-[11px] text-slate-400">No values</p>
          ) : (
            options.map((opt) => (
              <label
                key={opt}
                className={cn("flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[11px] font-medium normal-case tracking-normal text-slate-700", hoverClass)}
              >
                <input
                  type="checkbox"
                  checked={selected.has(opt)}
                  onChange={() => toggle(opt)}
                  className={cn("h-3.5 w-3.5 rounded border-slate-300 focus:ring-2", accentClass.replace("text-", "text-").includes("sky") ? "text-sky-600 focus:ring-sky-500" : "text-indigo-600 focus:ring-indigo-500")}
                />
                <span className="truncate">{opt}</span>
              </label>
            ))
          )}
        </div>
        {active && (
          <div className="border-t border-slate-100 px-3 py-2">
            <button type="button" onClick={() => onChange(new Set())} className={cn("text-[10px] font-semibold hover:underline", accentClass)}>
              Clear filter
            </button>
          </div>
        )}
      </FilterDropdownPortal>
    </th>
  );
}

export function DateHeaderFilter<T extends string>({
  label = "Date",
  sortCol,
  sortDir,
  currentSort,
  onSort,
  selectedPresets,
  onPresetsChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  accentClass = "text-sky-600",
  thClassName = "relative px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-300 whitespace-nowrap",
}: {
  label?: string;
  sortCol: T;
  sortDir: SortDir;
  currentSort: T;
  onSort: (col: T) => void;
  selectedPresets: Set<DatePreset>;
  onPresetsChange: (next: Set<DatePreset>) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
  accentClass?: string;
  thClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLTableCellElement>(null);
  const active = selectedPresets.size > 0 || Boolean(customFrom) || Boolean(customTo);

  const toggle = (value: DatePreset) => {
    const next = new Set(selectedPresets);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onPresetsChange(next);
  };

  const SortIcon = currentSort !== sortCol
    ? <ChevronsUpDown className="h-3 w-3 opacity-30" />
    : sortDir === "asc"
      ? <ChevronUp className="h-3 w-3" />
      : <ChevronDown className="h-3 w-3" />;

  return (
    <th ref={anchorRef} className={thClassName}>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onSort(sortCol)} className="flex items-center gap-1.5 transition-colors hover:text-white">
          {label}
          {SortIcon}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn("rounded p-0.5 transition-colors hover:text-white", active ? "text-amber-300" : "text-slate-400")}
        >
          <CalendarRange className="h-3 w-3" />
        </button>
      </div>

      <FilterDropdownPortal anchorRef={anchorRef} open={open} onClose={() => setOpen(false)} minWidth={260}>
        <div className="p-3">
          <div className="space-y-1">
            {DATE_PRESET_OPTIONS.map((preset) => (
              <label
                key={preset.id}
                className="flex cursor-pointer items-center gap-2 text-[11px] font-medium normal-case tracking-normal text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={selectedPresets.has(preset.id)}
                  onChange={() => toggle(preset.id)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span>{preset.label}</span>
              </label>
            ))}
          </div>

          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Custom Range</p>
            <div className="grid grid-cols-1 gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => onCustomFromChange(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 px-2 text-[11px] text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
              <input
                type="date"
                value={customTo}
                onChange={(e) => onCustomToChange(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 px-2 text-[11px] text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
            </div>
          </div>

          {active && (
            <div className="mt-3 border-t border-slate-100 pt-2">
              <button
                type="button"
                onClick={() => {
                  onPresetsChange(new Set());
                  onCustomFromChange("");
                  onCustomToChange("");
                }}
                className={cn("text-[10px] font-semibold hover:underline", accentClass)}
              >
                Clear filter
              </button>
            </div>
          )}
        </div>
      </FilterDropdownPortal>
    </th>
  );
}
