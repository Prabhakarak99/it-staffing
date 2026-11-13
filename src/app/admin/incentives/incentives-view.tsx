"use client";

import Link from "next/link";
import { Calculator, Trophy } from "lucide-react";
import { Header } from "@/components/layout/header";
import { SubmissionRecords } from "@/components/placements/submission-records";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { RUPEES_PER_RATE_DOLLAR, WAIT_MONTHS, type IncentiveState } from "@/lib/incentives/calc";
import type { IncentiveRow } from "@/lib/incentives/data";
import type { ConfirmationRow } from "@/lib/profit-sharing/data";

type Tab = "placements" | "calculations";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "placements", label: "Placements", icon: Trophy },
  { id: "calculations", label: "Calculations", icon: Calculator },
];

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const fmtDay = (key: string | null) =>
  key ? new Date(`${key}T00:00:00.000Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }) : "—";

const STATE: Record<IncentiveState, { label: string; cls: string }> = {
  active: { label: "Earning", cls: "bg-emerald-50 text-emerald-700" },
  waiting: { label: "Not started yet", cls: "bg-amber-50 text-amber-700" },
  ended: { label: "Project ended", cls: "bg-slate-100 text-slate-600" },
  "no-start": { label: "Start date missing", cls: "bg-rose-50 text-rose-700" },
  "no-rate": { label: "Bill rate missing", cls: "bg-rose-50 text-rose-700" },
};

export function IncentivesView({ tab, today, all, placements, board }: {
  tab: Tab;
  today: string;
  /** Sees every recruiter's placements (Super Admin, Admin / Manager / CEO roles) */
  all: boolean;
  placements: ConfirmationRow[];
  board: IncentiveRow[];
}) {
  const { toast, show, hide } = useToast();

  return (
    <>
      <Header title="Incentives" subtitle={all ? "Every recruiter's placements and incentive" : "Your placements and the incentive they earn"} />
      <div className="space-y-4 p-4 sm:p-6">
        {/* Links, not state: the Calculations board is worked out fresh each time it's opened */}
        <div className="flex w-fit gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {TABS.map((t) => (
            <Link key={t.id} href={`/admin/incentives?tab=${t.id}`}
              className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition", tab === t.id ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100")}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </Link>
          ))}
        </div>

        {tab === "placements" ? (
          <SubmissionRecords noun="placement" apiBase="/api/incentives/placements" lookupUrl="/api/incentives/lookup"
            initialRows={placements} today={today} withBillRate showRecruiter={all} notify={show} />
        ) : (
          <Board rows={board} today={today} all={all} />
        )}
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </>
  );
}

function Board({ rows, today, all }: { rows: IncentiveRow[]; today: string; all: boolean }) {
  const sum = (pick: (r: IncentiveRow) => number) => rows.reduce((n, r) => n + pick(r), 0);
  // Monthly total: what the placements earning today add up to in a full month
  const monthlyNow = sum((r) => (r.state === "active" ? r.monthly : 0));
  const thisMonth = sum((r) => r.thisMonth);
  const tillDate = sum((r) => r.tillDate);
  const monthName = new Date(`${today}T00:00:00.000Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
  const th = "whitespace-nowrap px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-300";
  const headers: [string, boolean][] = [
    ["Consultant", false], ...(all ? [["Recruiter", false] as [string, boolean]] : []), ["Client", false], ["Bill rate", true], ["Start date", false],
    ["Incentive from", false], ["End date", false], ["Status", false], ["Monthly incentive", true], [`This month (${monthName})`, true], ["Eligible till date", true],
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Placements", value: String(rows.length), color: "text-slate-800" },
          { label: "Monthly incentive (earning now)", value: rupees(monthlyNow), color: "text-indigo-700" },
          { label: "This month so far", value: rupees(thisMonth), color: "text-sky-700" },
          { label: "Eligible till date", value: rupees(tillDate), color: "text-emerald-700" },
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
              <tr>{headers.map(([h, right]) => <th key={h} className={cn(th, right ? "text-right" : "text-left")}>{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr><td colSpan={headers.length} className="px-4 py-12 text-center text-slate-400">No placements yet. Add one on the Placements tab and it appears here.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <p className="font-semibold text-slate-800">{r.consultantName}</p>
                    <p className="text-[11px] text-slate-400">{r.submissionCode}</p>
                  </td>
                  {all && <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{r.recruiterName || "—"}</td>}
                  <td className="px-4 py-2.5 text-slate-600">{r.clientName ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-slate-700">{r.billRate ? `$${r.billRate}/hr` : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{fmtDay(r.startDate)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{fmtDay(r.eligibleFrom)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{r.endDate ? fmtDay(r.endDate) : "Running"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-semibold", STATE[r.state].cls)}>{STATE[r.state].label}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-indigo-700">{r.monthly ? rupees(r.monthly) : "—"}</td>
                  <td className={cn("whitespace-nowrap px-4 py-2.5 text-right tabular-nums", r.thisMonth ? "font-semibold text-sky-700" : "text-slate-300")}>{rupees(r.thisMonth)}</td>
                  <td className={cn("whitespace-nowrap px-4 py-2.5 text-right tabular-nums", r.tillDate ? "font-bold text-emerald-700" : "text-slate-300")}>{rupees(r.tillDate)}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={headers.length - 3} className="px-4 py-3 font-bold text-slate-900">Total · {rows.length} placement{rows.length === 1 ? "" : "s"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-indigo-700">{rupees(monthlyNow)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-sky-700">{rupees(thisMonth)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-emerald-700">{rupees(tillDate)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      <p className="text-[11.5px] text-slate-400">
        Monthly incentive = bill rate × ₹{RUPEES_PER_RATE_DOLLAR} (a $70/hr placement earns ₹7,000 a month). It starts {WAIT_MONTHS} months after the project start date and runs to the end date.
        It is added day by day: the monthly amount divided by the days in that month, counted through today ({fmtDay(today)}). The monthly total counts placements earning today.
      </p>
    </>
  );
}
