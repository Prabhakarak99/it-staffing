"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Download, Loader2, Minus, Plus, RefreshCw, Search } from "lucide-react";
import { Toast, useToast } from "@/components/ui/toast";
import { APP_TZ, dayKeyOf, dayStart } from "@/lib/tz";
import type { MarketConsultant, ReportRecruiter, ReportRow } from "@/app/api/reports/route";

/* ── Report definitions ─────────────────────────────────────────────────── */
type ReportKey = "recruiter-submissions" | "recruiter-interviews" | "consultant-submissions" | "consultant-interviews" | "consultant-zero";
type Period = "daily" | "weekly" | "monthly";
const PERIODS: Period[] = ["daily", "weekly", "monthly"];
const PERIOD_TITLE: Record<Period, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
const CURRENT_LABEL: Record<Period, string> = { daily: "Today", weekly: "This week", monthly: "This month" };

const REPORTS: { key: ReportKey; label: string; type: "submissions" | "interviews"; by: "recruiter" | "consultant" | "zero" }[] = [
  { key: "recruiter-submissions",  label: "Submissions By Recruiter", type: "submissions", by: "recruiter" },
  { key: "recruiter-interviews",   label: "Interviews By Recruiter",  type: "interviews",  by: "recruiter" },
  { key: "consultant-submissions", label: "Consultant Submissions",   type: "submissions", by: "consultant" },
  { key: "consultant-interviews",  label: "Consultant Interviews",    type: "interviews",  by: "consultant" },
  { key: "consultant-zero",        label: "Zero Submissions",         type: "submissions", by: "zero" },
];

/* ── Period helpers ─────────────────────────────────────────────────────── */
// Calendar math runs on plain dates; each period is then sent as Central-time instants (src/lib/tz.ts)
function startOfWeek(d: Date) {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); // Monday
  return s;
}

function periodRange(period: Period, anchor: Date) {
  if (period === "daily") {
    const from = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    return { from, to: new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1) };
  }
  if (period === "weekly") {
    const from = startOfWeek(anchor);
    const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7);
    return { from, to };
  }
  const from = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  return { from, to: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1) };
}

function shiftAnchor(period: Period, anchor: Date, dir: -1 | 1) {
  if (period === "monthly") return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
  const days = period === "weekly" ? 7 : 1;
  return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + days * dir);
}

function periodLabel(period: Period, from: Date, to: Date) {
  if (period === "monthly") return from.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  if (period === "daily")
    return from.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const last = new Date(to.getFullYear(), to.getMonth(), to.getDate() - 1);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(from)} – ${fmt(last)}, ${last.getFullYear()}`;
}

const toYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function parseYmd(value: string | undefined) {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : centralToday();
}

/** Today's Central date as a calendar date */
function centralToday() {
  const [y, m, d] = dayKeyOf().split("-").map(Number);
  return new Date(y, m - 1, d);
}

function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── View ───────────────────────────────────────────────────────────────── */
interface DisplayRow {
  key: string;
  cells: string[];
  count: number;
  /** Nothing submitted in the period (In-Market consultant or recruiter) */
  zero?: boolean;
  /** Recruiter reports: the consultant / technology breakdown shown when expanded */
  details?: ReportRow[];
}

interface ReportResult {
  key: string;
  rows: ReportRow[];
  /** Submission reports only: In-Market consultants and recruiters, for the zero rows */
  consultants: MarketConsultant[];
  recruiters: ReportRecruiter[];
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { timeZone: APP_TZ, month: "short", day: "numeric", year: "numeric" }) : "Never";

interface ReportsViewProps {
  initialReport?: string;
  initialPeriod?: string;
  initialDate?: string;
}

export function ReportsView({ initialReport, initialPeriod, initialDate }: ReportsViewProps) {
  const { toast, show, hide } = useToast();
  const [reportKey, setReportKey] = useState<ReportKey>(
    REPORTS.find((r) => r.key === initialReport)?.key ?? "recruiter-submissions"
  );
  const [period, setPeriod] = useState<Period>(PERIODS.find((p) => p === initialPeriod) ?? "weekly");
  const [anchor, setAnchor] = useState<Date>(() => parseYmd(initialDate));
  const [result, setResult] = useState<ReportResult | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpanded = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const report = REPORTS.find((r) => r.key === reportKey)!;
  const { from, to } = useMemo(() => periodRange(period, anchor), [period, anchor]);
  const today = centralToday();
  const isCurrentPeriod = from <= today && today < to;
  const fromIso = dayStart(toYmd(from)).toISOString();
  const toIso = dayStart(toYmd(to)).toISOString();
  const title = `${PERIOD_TITLE[period]} ${report.label}`;
  const countLabel = report.type === "submissions" ? "Submissions Count" : "Interviews Done";
  const isZero = report.by === "zero";

  // Keep the selection in the URL so refresh / back restores it
  useEffect(() => {
    const params = new URLSearchParams({ report: reportKey, period, date: toYmd(anchor) });
    window.history.replaceState(null, "", `/admin/reports?${params}`);
  }, [reportKey, period, anchor]);

  // Loading = the latest request key hasn't resolved yet (bump `reloadTick` to refetch)
  const requestKey = `${report.type}|${fromIso}|${toIso}|${reloadTick}`;
  const isLoading = result?.key !== requestKey;
  const rows = useMemo(() => (isLoading || !result ? [] : result.rows), [isLoading, result]);
  const consultants = useMemo(() => (isLoading || !result ? [] : result.consultants), [isLoading, result]);
  const recruiters = useMemo(() => (isLoading || !result ? [] : result.recruiters), [isLoading, result]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ type: report.type, from: fromIso, to: toIso });
    fetch(`/api/reports?${params}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load report");
        return {
          rows: data.rows as ReportRow[],
          consultants: (data.consultants ?? []) as MarketConsultant[],
          recruiters: (data.recruiters ?? []) as ReportRecruiter[],
        };
      })
      .catch((err) => {
        if (!cancelled) show(err instanceof Error ? err.message : "Failed to load report", "error");
        return { rows: [], consultants: [], recruiters: [] };
      })
      .then((loaded) => {
        if (!cancelled) setResult({ key: requestKey, ...loaded });
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, report.type, fromIso, toIso, show]);

  // Recruiter reports show only the totals per recruiter (no consultant names);
  // consultant reports keep the consultant / recruiter / technology breakdown.
  // Submission reports also list In-Market consultants and recruiters with zero submissions.
  const headers =
    report.by === "recruiter"
      ? ["Recruiter Name"]
      : isZero
        ? ["Consultant Name", "Recruiter Name", "Technology", "Last Submission"]
        : ["Consultant Name", "Recruiter Name", "Technology"];

  const tableRows = useMemo<DisplayRow[]>(() => {
    const submitted = new Set(rows.map((r) => r.consultantId));
    const idle = consultants.filter((c) => !submitted.has(c.id));
    if (report.by === "zero") {
      return idle.map((c) => ({
        key: c.id,
        cells: [c.name, c.recruiterName, c.technology, fmtDate(c.lastSubmittedAt)],
        count: 0,
        zero: true,
      }));
    }
    if (report.by === "consultant") {
      return [
        ...rows.map((r) => ({
          key: `${r.recruiterId}|${r.consultantId}|${r.technology}`,
          cells: [r.consultantName, r.recruiterName, r.technology],
          count: r.count,
        })),
        ...idle.map((c) => ({ key: c.id, cells: [c.name, c.recruiterName, c.technology], count: 0, zero: true })),
      ];
    }
    const byRecruiter = new Map<string, DisplayRow>();
    for (const r of rows) {
      const row = byRecruiter.get(r.recruiterId);
      if (row) {
        row.count += r.count;
        row.details!.push(r);
      } else {
        byRecruiter.set(r.recruiterId, { key: r.recruiterId, cells: [r.recruiterName], count: r.count, details: [r] });
      }
    }
    for (const row of byRecruiter.values()) {
      row.details!.sort(
        (a, b) => b.count - a.count || a.consultantName.localeCompare(b.consultantName) || a.technology.localeCompare(b.technology)
      );
    }
    for (const r of recruiters) {
      if (!byRecruiter.has(r.id)) byRecruiter.set(r.id, { key: r.id, cells: [r.name], count: 0, zero: true });
    }
    return [...byRecruiter.values()];
  }, [rows, consultants, recruiters, report.by]);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tableRows
      .filter((r) => !q || r.cells.join(" ").toLowerCase().includes(q))
      .sort((a, b) =>
        report.by === "recruiter"
          ? b.count - a.count || a.cells[0].localeCompare(b.cells[0])
          : a.cells[0].localeCompare(b.cells[0]) || b.count - a.count || a.cells[1].localeCompare(b.cells[1])
      );
  }, [tableRows, query, report.by]);

  const total = visibleRows.reduce((sum, r) => sum + r.count, 0);
  const primaryCount = new Set(visibleRows.map((r) => r.cells[0])).size;
  const zeroCount = visibleRows.filter((r) => r.zero).length;
  const colSpan = headers.length + (isZero ? 1 : 2);

  const exportCsv = () =>
    isZero
      ? downloadCsv(
          `${title.replace(/\s+/g, "-")}-${toYmd(from)}.csv`,
          ["#", ...headers],
          visibleRows.map((r, i) => [i + 1, ...r.cells])
        )
      : downloadCsv(
          `${title.replace(/\s+/g, "-")}-${toYmd(from)}.csv`,
          ["#", ...headers, countLabel],
          [
            ...visibleRows.map((r, i) => [i + 1, ...r.cells, r.count]),
            ["", "Total", ...headers.slice(1).map(() => ""), total],
          ]
        );

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">Reporting</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Reports</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Daily, weekly and monthly submission and interview counts by recruiter and consultant.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setReloadTick((t) => t + 1)}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={isLoading || visibleRows.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Report picker */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {REPORTS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setReportKey(r.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                r.key === reportKey ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition",
                p === period ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">{title}</h2>
            <div className="mt-1 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setAnchor(shiftAnchor(period, anchor, -1))}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Previous period"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[170px] text-center text-sm font-medium text-slate-700">
                {periodLabel(period, from, to)}
              </span>
              <button
                type="button"
                onClick={() => setAnchor(shiftAnchor(period, anchor, 1))}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Next period"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {!isCurrentPeriod && (
                <button
                  type="button"
                  onClick={() => setAnchor(centralToday())}
                  className="ml-1 rounded-lg px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                >
                  {CURRENT_LABEL[period]}
                </button>
              )}
            </div>
          </div>
          <div className="relative min-w-[240px] max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={report.by === "recruiter" ? "Search recruiter..." : "Search consultant, recruiter, technology..."}
              className="w-full rounded-xl border border-slate-200 py-2 pl-10 pr-3 text-sm outline-none ring-indigo-500 focus:ring-2"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-6 border-b border-slate-100 px-5 py-3 text-sm">
          {isZero ? (
            <>
              <span className="text-slate-500">
                In-Market consultants with zero submissions:{" "}
                <span className="font-bold text-rose-600">{visibleRows.length}</span>
              </span>
              <span className="text-slate-500">
                In-Market consultants: <span className="font-bold text-slate-900">{consultants.length}</span>
              </span>
            </>
          ) : (
            <>
              <span className="text-slate-500">
                {report.type === "submissions" ? "Total submissions" : "Total interviews done"}:{" "}
                <span className="font-bold text-slate-900">{total}</span>
              </span>
              <span className="text-slate-500">
                {report.by === "recruiter" ? "Recruiters" : "Consultants"}:{" "}
                <span className="font-bold text-slate-900">{primaryCount}</span>
              </span>
              {report.type === "submissions" && (
                <span className="text-slate-500">
                  Zero submissions: <span className="font-bold text-rose-600">{zeroCount}</span>
                </span>
              )}
            </>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="w-16 px-5 py-3">#</th>
                {headers.map((h) => (
                  <th key={h} className="px-5 py-3">{h}</th>
                ))}
                {!isZero && <th className="px-5 py-3 text-right">{countLabel}</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={colSpan} className="px-5 py-12 text-center text-slate-400">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-5 py-12 text-center text-slate-400">
                    {isZero
                      ? "Every In-Market consultant has a submission in this period."
                      : `No ${report.type === "submissions" ? "submissions" : "interviews"} in this period.`}
                  </td>
                </tr>
              ) : (
                visibleRows.map((r, i) => {
                  const isOpen = expanded.has(r.key);
                  return (
                    <Fragment key={r.key}>
                      <tr className={cn("border-b border-slate-50 hover:bg-slate-50/60", isOpen && "bg-indigo-50/40")}>
                        <td className="px-5 py-3 text-slate-400">
                          <div className="flex items-center gap-2">
                            {!!r.details?.length && (
                              <button
                                type="button"
                                onClick={() => toggleExpanded(r.key)}
                                aria-expanded={isOpen}
                                aria-label={isOpen ? "Hide consultants" : "Show consultants"}
                                className="flex h-5 w-5 items-center justify-center rounded border border-slate-300 text-slate-600 transition hover:border-indigo-500 hover:text-indigo-600"
                              >
                                {isOpen ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                              </button>
                            )}
                            {i + 1}
                          </div>
                        </td>
                        {r.cells.map((cell, ci) => (
                          <td
                            key={ci}
                            className={cn("px-5 py-3", ci === 0 ? "font-medium text-slate-800" : "text-slate-700")}
                          >
                            {cell}
                          </td>
                        ))}
                        {!isZero && (
                          <td className={cn("px-5 py-3 text-right font-semibold", r.zero ? "text-rose-600" : "text-slate-900")}>
                            {r.count}
                          </td>
                        )}
                      </tr>
                      {isOpen && r.details && (
                        <tr className="border-b border-slate-100 bg-slate-50/60">
                          <td colSpan={colSpan} className="px-5 py-3 pl-14">
                            <table className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
                              <thead>
                                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  <th className="w-12 px-4 py-2">#</th>
                                  <th className="px-4 py-2">Consultant Name</th>
                                  <th className="px-4 py-2">Technology</th>
                                  <th className="px-4 py-2 text-right">{countLabel}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.details.map((d, di) => (
                                  <tr
                                    key={`${d.consultantId}|${d.technology}`}
                                    className="border-b border-slate-50 last:border-0"
                                  >
                                    <td className="px-4 py-2 text-slate-400">{di + 1}</td>
                                    <td className="px-4 py-2 text-slate-800">{d.consultantName}</td>
                                    <td className="px-4 py-2 text-slate-600">{d.technology}</td>
                                    <td className="px-4 py-2 text-right font-semibold text-slate-900">{d.count}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
            {!isLoading && !isZero && visibleRows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50/60 font-semibold text-slate-900">
                  <td className="px-5 py-3" colSpan={colSpan - 1}>Total</td>
                  <td className="px-5 py-3 text-right">{total}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  );
}
