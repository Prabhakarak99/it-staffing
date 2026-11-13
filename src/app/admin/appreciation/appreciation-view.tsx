import { Award, CalendarCheck, Send } from "lucide-react";
import { Header } from "@/components/layout/header";
import { cn } from "@/lib/utils";
import type { AppreciationBoard, Category } from "@/lib/appreciation/data";

const rupees = (n: number) => `₹${(Math.round(n * 100) / 100).toLocaleString("en-IN")}`;
const fmtMonth = (month: string) =>
  new Date(`${month}-01T00:00:00.000Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" });

const CATEGORY: Record<Category, { label: string; unit: string; icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  submissions: { label: "Most submissions", unit: "submissions", icon: Send, cls: "bg-indigo-50 text-indigo-700" },
  interviews: { label: "Most interviews", unit: "interviews", icon: CalendarCheck, cls: "bg-violet-50 text-violet-700" },
};

export function AppreciationView({ board, prize, myId, hasAccount }: {
  board: AppreciationBoard;
  prize: number;
  myId: string;
  /** Super Admin has no account of their own to win into */
  hasAccount: boolean;
}) {
  const { awards, accounts, myTotal, current } = board;
  const months = [...new Set(awards.map((a) => a.month))];
  const th = "whitespace-nowrap px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-300";

  return (
    <>
      <Header title="Appreciation" subtitle={`${rupees(prize)} each month for the most submissions and for the most interviews`} />
      <div className="space-y-5 p-4 sm:p-6">
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-3 text-[12.5px] text-slate-700">
          <Award className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p>
            On the 1st of every month, the person with the <b>most submissions</b> and the person with the <b>most interviews</b> in the month before each get <b>{rupees(prize)}</b>.
            Only first place wins. If several people tie for first, they share the {rupees(prize)} equally (two people: {rupees(prize / 2)} each).
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {hasAccount && (
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">My appreciation total</p>
              <p className={cn("mt-1 text-2xl font-bold tabular-nums", myTotal ? "text-emerald-700" : "text-slate-400")}>{rupees(myTotal)}</p>
            </div>
          )}
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Awards given</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-800">{awards.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total given</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-indigo-700">{rupees(awards.reduce((n, a) => n + a.amount, 0))}</p>
          </div>
        </div>

        {/* The running month */}
        <div className="grid gap-4 lg:grid-cols-2">
          {(Object.keys(CATEGORY) as Category[]).map((c) => {
            const meta = CATEGORY[c];
            const rows = current.standings[c];
            const top = rows[0]?.count ?? 0;
            return (
              <section key={c} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
                  <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", meta.cls)}><meta.icon className="h-3.5 w-3.5" /></span>
                  <div>
                    <h2 className="text-[13.5px] font-bold text-slate-800">{meta.label}: {fmtMonth(current.month)} so far</h2>
                    <p className="text-[11px] text-slate-400">Top five right now. The award is decided on the 1st of next month.</p>
                  </div>
                </div>
                {rows.length === 0 ? (
                  <p className="px-5 py-8 text-center text-[12.5px] text-slate-400">No {meta.unit} yet this month.</p>
                ) : (
                  <ol className="divide-y divide-slate-100">
                    {rows.map((r, i) => (
                      <li key={r.userId} className={cn("flex items-center gap-3 px-5 py-2.5 text-[12.5px]", r.userId === myId && "bg-indigo-50/50")}>
                        <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold", r.count === top ? "bg-amber-400 text-white" : "bg-slate-100 text-slate-500")}>
                          {r.count === top ? 1 : i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{r.name}{r.userId === myId ? " (you)" : ""}</span>
                        <span className="tabular-nums font-bold text-slate-700">{r.count}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            );
          })}
        </div>

        {/* Winners by month */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <p className="border-b border-slate-100 px-5 py-3 text-[14px] font-bold text-slate-800">Winners by month</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-slate-800">
                <tr>{["Month", "Award", "Winner", "Count", "Amount"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {awards.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">No awards yet. The first ones are added on December 1, 2026, for November.</td></tr>
                )}
                {months.flatMap((m) =>
                  awards.filter((a) => a.month === m).map((a, i) => (
                    <tr key={a.id} className={cn("hover:bg-slate-50", a.userId === myId && "bg-indigo-50/40")}>
                      <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-slate-800">{i === 0 ? fmtMonth(m) : ""}</td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-semibold", CATEGORY[a.category].cls)}>{CATEGORY[a.category].label}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-slate-800">{a.name}{a.userId === myId ? " (you)" : ""}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-slate-600">{a.count} {CATEGORY[a.category].unit}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-bold tabular-nums text-emerald-700">
                        {rupees(a.amount)}{a.amount < prize ? <span className="ml-1 text-[11px] font-medium text-slate-400">shared</span> : null}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Accounts */}
        {accounts.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <p className="border-b border-slate-100 px-5 py-3 text-[14px] font-bold text-slate-800">Appreciation accounts</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="bg-slate-800">
                  <tr>{["Name", "Awards won", "Total"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {accounts.map((a) => (
                    <tr key={a.userId} className={cn("hover:bg-slate-50", a.userId === myId && "bg-indigo-50/40")}>
                      <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-slate-800">{a.name}{a.userId === myId ? " (you)" : ""}</td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-600">{a.wins}</td>
                      <td className="px-4 py-2.5 font-bold tabular-nums text-emerald-700">{rupees(a.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-slate-900">Total</td>
                    <td className="px-4 py-2.5 font-bold tabular-nums text-slate-700">{accounts.reduce((n, a) => n + a.wins, 0)}</td>
                    <td className="px-4 py-2.5 font-bold tabular-nums text-emerald-700">{rupees(accounts.reduce((n, a) => n + a.total, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
