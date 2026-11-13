"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RequirementReport } from "@/lib/requirements/report";

const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const fmtDay = (key: string) =>
  new Date(`${key}T00:00:00.000Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });

const inputCls = "h-9 rounded-xl border border-slate-200 bg-white px-3 text-[13px] shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

export function RequirementReportView({ from, to, today, maxDays, report }: {
  from: string;
  to: string;
  today: string;
  maxDays: number;
  report: RequirementReport;
}) {
  const router = useRouter();
  const go = (f: string, t: string) => router.push(`/admin/reports/requirements?from=${f}&to=${t}`);
  const { days, rows, totals, answered } = report;
  const span = days.length;
  // Vendor Requirements can show today, the last 7 days or the last 30: pick the shortest that covers this report
  const back = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
  const listDays = back <= 0 ? "today" : back < 7 ? "7" : "30";

  const exportCsv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [
      ["Technology", ...days.flatMap((d) => [`${d} received`, `${d} resumes sent`]), "Total received", "Total resumes sent"],
      ...rows.map((r) => [r.technology, ...days.flatMap((_, i) => [r.received[i], r.sent[i]]), r.totalReceived, r.totalSent]),
      ["Total", ...days.flatMap((_, i) => [totals.received[i], totals.sent[i]]), totals.totalReceived, totals.totalSent],
    ];
    const blob = new Blob([lines.map((l) => l.map(esc).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Requirement_Report_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /** Up / down against the day before */
  const trend = (values: number[], i: number) =>
    i === 0 || values[i] === values[i - 1] ? null : values[i] > values[i - 1] ? "up" : "down";

  const th = "whitespace-nowrap px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300";

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/reports" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Reports
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Requirement Report</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Vendor requirement emails received each day by technology, and the resumes sent for them from Vendor Requirements (Central time).
          </p>
        </div>
        <button type="button" onClick={exportCsv} disabled={rows.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {[1, 7, 14, 30].map((n) => (
            <button key={n} type="button" onClick={() => go(addDays(today, -(n - 1)), today)}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition", to === today && span === n ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100")}>
              {n === 1 ? "Today" : `${n} days`}
            </button>
          ))}
        </div>
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          From
          <input type="date" value={from} max={to} onChange={(e) => e.target.value && go(e.target.value, to)} className={cn(inputCls, "mt-1 block")} />
        </label>
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          To
          <input type="date" value={to} min={from} max={today} onChange={(e) => e.target.value && go(from, e.target.value)} className={cn(inputCls, "mt-1 block")} />
        </label>
        <span className="pb-2 text-[11.5px] text-slate-400">Up to {maxDays} days at a time</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Requirements received", value: totals.totalReceived, color: "text-indigo-700" },
          { label: "Resumes sent", value: totals.totalSent, color: "text-emerald-700" },
          { label: "Requirements answered", value: answered, color: "text-sky-700" },
          { label: "Per day (average)", value: span ? Math.round(totals.totalReceived / span) : 0, color: "text-slate-800" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{s.label}</p>
            <p className={cn("mt-1 text-2xl font-bold tabular-nums", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-slate-800">
              <tr>
                <th className={cn(th, "sticky left-0 bg-slate-800 text-left")}>Technology</th>
                {days.map((d) => <th key={d} className={cn(th, "text-right")}>{fmtDay(d)}</th>)}
                <th className={cn(th, "border-l border-slate-700 text-right")}>Received</th>
                <th className={cn(th, "text-right")}>Resumes sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr><td colSpan={days.length + 3} className="px-4 py-12 text-center text-slate-400">No requirements were received on these dates.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.technology} className="hover:bg-slate-50">
                  <td className="sticky left-0 whitespace-nowrap bg-white px-3 py-2 font-semibold">
                    <Link href={`/admin/vendor-requirements?tech=${encodeURIComponent(r.technology)}&days=${listDays}`}
                      title={`Open ${r.technology} requirements in Vendor Requirements`} className="text-indigo-700 hover:underline">
                      {r.technology}
                    </Link>
                  </td>
                  {days.map((d, i) => <DayCell key={d} received={r.received[i]} sent={r.sent[i]} trend={trend(r.received, i)} />)}
                  <td className="border-l border-slate-100 px-3 py-2 text-right font-bold tabular-nums text-indigo-700">{r.totalReceived}</td>
                  <td className={cn("px-3 py-2 text-right font-bold tabular-nums", r.totalSent ? "text-emerald-700" : "text-slate-300")}>{r.totalSent}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td className="sticky left-0 bg-slate-50 px-3 py-2.5 font-bold text-slate-900">Total</td>
                  {days.map((d, i) => <DayCell key={d} received={totals.received[i]} sent={totals.sent[i]} trend={trend(totals.received, i)} bold />)}
                  <td className="border-l border-slate-200 px-3 py-2.5 text-right font-bold tabular-nums text-indigo-700">{totals.totalReceived}</td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-emerald-700">{totals.totalSent}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      <p className="text-[11.5px] text-slate-400">
        Click a technology to open its requirements in Vendor Requirements. Each day shows requirements received, with resumes sent that day underneath in green. ▲ ▼ compare with the day before.
        Counts every requirement the inbox reader stored (recruiter and consultant inboxes), including full-time and already-submitted ones that the Vendor Requirements list hides; our own company&apos;s mail is left out.
      </p>
    </div>
  );
}

function DayCell({ received, sent, trend, bold }: { received: number; sent: number; trend: "up" | "down" | null; bold?: boolean }) {
  return (
    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
      <span className={cn(received ? "text-slate-800" : "text-slate-300", bold && "font-bold")}>{received}</span>
      {trend && <span className={cn("ml-1 text-[9px]", trend === "up" ? "text-emerald-600" : "text-rose-500")}>{trend === "up" ? "▲" : "▼"}</span>}
      {sent > 0 && <span className="block text-[10.5px] font-semibold text-emerald-700">{sent} sent</span>}
    </td>
  );
}
