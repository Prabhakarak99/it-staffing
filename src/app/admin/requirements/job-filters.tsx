"use client";

import { cn } from "@/lib/utils";
import { X, SlidersHorizontal } from "lucide-react";

export interface Filters {
  keyword: string;
  technology: string;
  source: string;
  location: string;
  dateFrom: string;
  jobType: string;
  sourceType: string;
}

export const EMPTY_FILTERS: Filters = {
  keyword: "", technology: "", source: "", location: "", dateFrom: "", jobType: "", sourceType: "",
};

const SOURCES = ["LinkedIn", "Indeed", "Google", "Greenhouse", "Lever", "Ashby", "SmartRecruiters", "Workday"];

const JOB_TYPES = [
  { label: "All", value: "" },
  { label: "C2C", value: "C2C" },
  { label: "W2", value: "W2" },
  { label: "1099", value: "1099" },
  { label: "Contract", value: "Contract" },
];

const SOURCE_TYPES = [
  { label: "All", value: "" },
  { label: "Company sites", value: "ats" },
  { label: "Job boards", value: "board" },
];

const DATE_OPTIONS = [
  { label: "All Time", value: "" },
  { label: "Today",    value: new Date().toISOString().split("T")[0] },
  { label: "This Week", value: (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split("T")[0]; })() },
  { label: "This Month", value: (() => { const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0]; })() },
];

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">{children}</p>;
}


export function JobFilters({ filters, onChange }: Props) {
  const set = (key: keyof Filters) => (val: string) => onChange({ ...filters, [key]: val });
  const isActive = Object.values(filters).some((v) => v !== "");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-cyan-600" />
          <span className="text-[13px] font-bold text-slate-900">Filters</span>
          {isActive && (
            <span className="h-2 w-2 rounded-full bg-cyan-500" />
          )}
        </div>
        {isActive && (
          <button
            onClick={() => onChange(EMPTY_FILTERS)}
            className="flex items-center gap-1 text-[11px] font-semibold text-rose-500 hover:text-rose-600 transition-colors"
          >
            <X className="h-3 w-3" /> Clear All
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Keyword */}
        <div>
          <Label>Keyword Search</Label>
          <input
            type="text"
            placeholder="Title, description, company…"
            value={filters.keyword}
            onChange={(e) => set("keyword")(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 placeholder-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
          />
        </div>

        {/* Technology */}
        <div>
          <Label>Technology</Label>
          <input
            type="text"
            placeholder="e.g. Java, SAP, MES…"
            value={filters.technology}
            onChange={(e) => set("technology")(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 placeholder-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
          />
        </div>

        {/* Employment type */}
        <div>
          <Label>Employment Type</Label>
          <div className="flex flex-wrap gap-1.5">
            {JOB_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => set("jobType")(t.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-semibold transition-all",
                  filters.jobType === t.value
                    ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Where the job came from */}
        <div>
          <Label>Found On</Label>
          <div className="flex flex-wrap gap-1.5">
            {SOURCE_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => set("sourceType")(t.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-semibold transition-all",
                  filters.sourceType === t.value
                    ? "border-indigo-500 bg-indigo-500 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Source */}
        <div>
          <Label>Source</Label>
          <div className="flex flex-wrap gap-1.5">
            {["", ...SOURCES].map((s) => (
              <button
                key={s}
                onClick={() => set("source")(s)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-semibold transition-all",
                  filters.source === s
                    ? "border-cyan-500 bg-cyan-500 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:bg-cyan-50"
                )}
              >
                {s || "All"}
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div>
          <Label>Location</Label>
          <input
            type="text"
            placeholder="City or State…"
            value={filters.location}
            onChange={(e) => set("location")(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 placeholder-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
          />
        </div>

        {/* Date Posted */}
        <div>
          <Label>Date Scraped</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {DATE_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => set("dateFrom")(o.value)}
                className={cn(
                  "rounded-lg border py-2 text-[11px] font-semibold transition-all",
                  filters.dateFrom === o.value
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
