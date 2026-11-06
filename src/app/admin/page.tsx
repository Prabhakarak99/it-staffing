export const dynamic = "force-dynamic";

import Link from "next/link";
import { Header } from "@/components/layout/header";
import { EmailActivityCards } from "@/components/email-activity";
import { getEmailActivity } from "@/lib/gmail/activity";
import { isGmailConfigured } from "@/lib/gmail/oauth";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Users, UserPlus, Shield, Briefcase,
  GraduationCap, FileText, Calendar,
  TrendingUp, MapPin, DollarSign, ArrowRight,
  BarChart3, Activity, Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_TZ, centralHour, centralPeriods } from "@/lib/tz";
import { getTodayAttendance, type TodayPerson } from "@/lib/attendance/team";

function greeting() {
  const h = centralHour();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function todayStr() {
  return new Date().toLocaleDateString("en-US", {
    timeZone: APP_TZ, weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

// ── Shared components ─────────────────────────────────────────────────────────
interface StatCardProps {
  label: string; value: number; sub?: string; href: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string; iconColor: string; valueColor: string; accent: string;
}

function StatCard({ label, value, sub, href, icon: Icon, iconBg, iconColor, valueColor, accent }: StatCardProps) {
  return (
    <Link href={href} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all duration-200 hover:shadow-md">
      <div className={cn("absolute left-0 top-0 h-full w-[3px] rounded-l-xl", accent)} />
      <div className="relative flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", iconBg)}>
            <Icon className={cn("h-4 w-4", iconColor)} />
          </div>
          <div className="min-w-0">
            <p className={cn("text-xl font-bold tabular-nums leading-none", valueColor)}>{value.toLocaleString()}</p>
            <p className="mt-0.5 truncate text-[12px] font-medium text-slate-600">{label}</p>
            {sub && <p className="truncate text-[10px] text-slate-400">{sub}</p>}
          </div>
        </div>
        <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-slate-500" />
      </div>
    </Link>
  );
}

function PipelineBar({ label, count, total, barColor, dotColor }: {
  label: string; count: number; total: number; barColor: string; dotColor: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex w-[100px] shrink-0 items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotColor)} />
        <span className="truncate text-[11px] font-medium text-slate-600">{label}</span>
      </div>
      <div className="flex flex-1 items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-slate-100">
          <div className={cn("h-full rounded-full transition-all duration-500", barColor)} style={{ width: `${pct}%` }} />
        </div>
        <span className="w-6 text-right text-[11px] font-bold tabular-nums text-slate-700">{count}</span>
        <span className="w-7 text-[10px] text-slate-400">{pct}%</span>
      </div>
    </div>
  );
}

function QuickAction({ label, href, icon: Icon, color }: {
  label: string; href: string; icon: React.ComponentType<{ className?: string }>; color: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] font-semibold text-slate-700 shadow-sm transition-all duration-150 hover:border-slate-300 hover:bg-slate-50">
      <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", color)}>
        <Icon className="h-3 w-3 text-white" />
      </div>
      {label}
    </Link>
  );
}

// ── Consultant Today / Week / Month count table ───────────────────────────────
interface PeriodCounts { today: number; week: number; month: number }
interface ConsultantCountRow extends PeriodCounts { id: string; name: string; technology: string | null }

/** Banner tile: who is in today. Hover (or keyboard focus) shows the present / absent names. */
function AttendanceTodayTile({ present, absent, total }: { present: TodayPerson[]; absent: TodayPerson[]; total: number }) {
  return (
    <div className="group relative">
      <Link
        href="/admin/attendance?tab=team"
        className="block rounded-lg border border-white/[0.08] bg-white/[0.05] px-2.5 py-1.5 text-center backdrop-blur-sm transition hover:border-white/20"
      >
        <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Present Today</p>
        <p className="text-[16px] font-bold tabular-nums leading-none text-sky-300">
          {present.length}<span className="text-[11px] font-semibold text-slate-500">/{total}</span>
        </p>
      </Link>
      <div className="invisible absolute right-0 top-full z-50 pt-2 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
        <div className="w-[420px] max-w-[90vw] rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12px] font-bold text-slate-800">Attendance today</p>
            <Link href="/admin/attendance?tab=team" className="text-[11px] font-semibold text-indigo-600 hover:underline">Full report →</Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { title: "Present", people: present, head: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
              { title: "Absent", people: absent, head: "bg-rose-50 text-rose-700", dot: "bg-rose-500" },
            ].map(({ title, people, head, dot }) => (
              <div key={title} className="overflow-hidden rounded-lg border border-slate-100">
                <p className={cn("flex items-center justify-between px-2.5 py-1.5 text-[11px] font-bold", head)}>
                  {title} <span className="tabular-nums">{people.length}</span>
                </p>
                <ul className="max-h-64 divide-y divide-slate-50 overflow-y-auto">
                  {people.length === 0 ? (
                    <li className="px-2.5 py-2 text-[11px] text-slate-400">No one</li>
                  ) : (
                    people.map((p) => (
                      <li key={p.id} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11.5px] text-slate-700">
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
                        <span className="truncate">{p.name}</span>
                        {p.pending && <span className="ml-auto shrink-0 rounded bg-amber-50 px-1 text-[9.5px] font-semibold text-amber-700">Awaiting approval</span>}
                        {p.onLeave && <span className="ml-auto shrink-0 rounded bg-sky-50 px-1 text-[9.5px] font-semibold text-sky-700">On leave</span>}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CountCell({ value, color }: { value: number; color: string }) {
  return (
    <td className="px-1 py-3.5 text-center">
      <span className={cn("text-[13px] font-bold tabular-nums", value > 0 ? color : "text-slate-300")}>{value}</span>
    </td>
  );
}

function PercentBadge({ pct }: { pct: number }) {
  const color = pct >= 100 ? "bg-emerald-100 text-emerald-700" : pct >= 50 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-600";
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums", color)}>{pct}%</span>;
}

/** weeklyTarget: per-consultant weekly goal; when set, adds a "Week %" column and an average row */
function ConsultantCountTable({ title, subtitle, icon: Icon, iconBg, iconColor, rows, weeklyTarget }: {
  title: string; subtitle: string;
  icon: React.ComponentType<{ className?: string }>; iconBg: string; iconColor: string;
  rows: ConsultantCountRow[]; weeklyTarget?: number;
}) {
  const totals = rows.reduce((t, r) => ({ today: t.today + r.today, week: t.week + r.week, month: t.month + r.month }), { today: 0, week: 0, month: 0 });
  const weekPct = (week: number) => (weeklyTarget ? Math.round((week / weeklyTarget) * 100) : 0);
  const avgPct = rows.length > 0 ? Math.round(rows.reduce((sum, r) => sum + weekPct(r.week), 0) / rows.length) : 0;
  const colCount = weeklyTarget ? 5 : 4;
  const th = "px-1 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4 flex items-center gap-2.5">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", iconBg)}>
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>
        <div>
          <p className="text-[13px] font-bold text-slate-900">{title}</p>
          <p className="text-[11px] text-slate-400">{subtitle}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <GraduationCap className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-[13px] font-semibold text-slate-500">No consultants assigned to you yet</p>
          <p className="mt-1 text-[11px] text-slate-400">Consultants appear here once assigned to you or once you add activity for them</p>
        </div>
      ) : (
        <div>
          <table className="w-full table-fixed">
            <thead>
              <tr className="bg-slate-800">
                <th className={cn(th, "text-left pl-5")}>Consultant</th>
                <th className={cn(th, "text-center w-[15%]")}>Today</th>
                <th className={cn(th, "text-center w-[15%]")}>Week</th>
                <th className={cn(th, "text-center w-[15%]")}>Month</th>
                {weeklyTarget && <th className={cn(th, "text-center w-[17%] pr-3")}>Week %</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-indigo-50/20 transition-colors">
                  <td className="pl-5 pr-2 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-bold text-violet-700">
                        {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-semibold text-slate-800">{c.name}</p>
                        {c.technology && <p className="truncate text-[10px] text-slate-400">{c.technology}</p>}
                      </div>
                    </div>
                  </td>
                  <CountCell value={c.today} color="text-emerald-600" />
                  <CountCell value={c.week} color="text-sky-700" />
                  <CountCell value={c.month} color="text-violet-700" />
                  {weeklyTarget && (
                    <td className="px-5 py-3.5 text-center"><PercentBadge pct={weekPct(c.week)} /></td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <td className="pl-5 pr-2 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Total</td>
                <td className="px-1 py-3 text-center text-[13px] font-bold tabular-nums text-slate-800">{totals.today}</td>
                <td className="px-1 py-3 text-center text-[13px] font-bold tabular-nums text-slate-800">{totals.week}</td>
                <td className="px-1 py-3 text-center text-[13px] font-bold tabular-nums text-slate-800">{totals.month}</td>
                {weeklyTarget && <td className="px-1 py-3" />}
              </tr>
              {weeklyTarget && (
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td colSpan={colCount - 1} className="pl-5 pr-2 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Average % <span className="font-medium normal-case tracking-normal text-slate-400">({weeklyTarget}/wk = 100%)</span>
                  </td>
                  <td className="px-1 py-3 text-center"><PercentBadge pct={avgPct} /></td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default async function AdminDashboard() {
  const session = await getSession();
  if (!session) redirect("/login");

  const isRecruiter = session.roleName === "Recruiter";

  const me = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { firstName: true, lastName: true },
  });
  const firstName = me?.firstName ?? session.email.split("@")[0];

  /* ══════════════════════════════════════════════════════════════════════════
     RECRUITER DASHBOARD
  ══════════════════════════════════════════════════════════════════════════ */
  if (isRecruiter) {
    // ── Date boundaries (Central time, Mon-based week) ───────────────────────
    const { today: todayStart, week: weekStart, month: monthStart } = centralPeriods();

    // Each consultant should get 10 submissions per 5-day work week (= 100%)
    const WEEKLY_SUB_TARGET = 10;

    // The week can start in the previous month, so fetch from whichever is earlier
    const periodStart = weekStart < monthStart ? weekStart : monthStart;

    // ── Queries ──────────────────────────────────────────────────────────────
    const [periodSubs, periodIntvs, assigned, monthSubsByRecruiter, recruiters] = await Promise.all([
      prisma.submission.findMany({
        where: { recruiterId: session.userId, createdAt: { gte: periodStart } },
        select: { consultantId: true, createdAt: true },
      }),
      prisma.interview.findMany({
        where: { recruiterId: session.userId, createdAt: { gte: periodStart } },
        select: { createdAt: true, submission: { select: { consultantId: true } } },
      }),
      // Consultants assigned to this recruiter
      prisma.preMarketing.findMany({
        where: { recruiterId: session.userId },
        select: { consultantId: true },
      }),
      // Company-wide monthly submissions per recruiter (for the rank); the latest one is when they
      // reached their current count, which breaks ties
      prisma.submission.groupBy({
        by: ["recruiterId"],
        where: { createdAt: { gte: monthStart } },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      // Every recruiter (rank denominator, and the order for those with no submissions yet)
      prisma.user.findMany({ where: { role: { name: "Recruiter" } }, select: { id: true, firstName: true, lastName: true } }),
    ]);

    // My consultants = assigned to me + any I submitted/interviewed this period
    const cIds = [...new Set([
      ...assigned.map((a) => a.consultantId),
      ...periodSubs.map((s) => s.consultantId),
      ...periodIntvs.map((i) => i.submission.consultantId),
    ])];
    const consultants = cIds.length > 0
      ? await prisma.student.findMany({ where: { id: { in: cIds } }, select: { id: true, firstName: true, lastName: true, technology: true } })
      : [];

    const tally = (items: { consultantId: string; createdAt: Date }[]) => {
      const counts = new Map<string, PeriodCounts>();
      for (const { consultantId, createdAt } of items) {
        const c = counts.get(consultantId) ?? { today: 0, week: 0, month: 0 };
        if (createdAt >= todayStart) c.today++;
        if (createdAt >= weekStart) c.week++;
        if (createdAt >= monthStart) c.month++;
        counts.set(consultantId, c);
      }
      return counts;
    };
    const subCounts = tally(periodSubs);
    const intvCounts = tally(periodIntvs.map((i) => ({ consultantId: i.submission.consultantId, createdAt: i.createdAt })));
    const zero: PeriodCounts = { today: 0, week: 0, month: 0 };

    const buildRows = (counts: Map<string, PeriodCounts>): ConsultantCountRow[] =>
      consultants
        .map((c) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`,
          technology: c.technology,
          ...(counts.get(c.id) ?? zero),
        }))
        .sort((a, b) => b.today - a.today || b.week - a.week || b.month - a.month || a.name.localeCompare(b.name));

    // Gmail received / sent counts (filled by the background worker once Gmail is connected)
    const emailActivity = (await isGmailConfigured()) ? await getEmailActivity(session.userId, false) : null;

    const submissionRows = buildRows(subCounts);
    const interviewRows = buildRows(intvCounts);

    // ── Monthly company rank ─────────────────────────────────────────────────
    // Most submissions this month first. Equal counts never share a rank: whoever reached the count
    // first (earlier latest submission) is ahead; people with none yet are ordered by name.
    const reached = new Map(monthSubsByRecruiter.map((g) => [g.recruiterId, { count: g._count._all, at: g._max.createdAt?.getTime() ?? 0 }]));
    const names = new Map(recruiters.map((r) => [r.id, `${r.firstName} ${r.lastName}`.trim().toLowerCase()]));
    const standings = [...new Set([...reached.keys(), ...names.keys(), session.userId])]
      .map((id) => ({ id, count: reached.get(id)?.count ?? 0, at: reached.get(id)?.at ?? Infinity, name: names.get(id) ?? "" }))
      .sort((a, b) => b.count - a.count || a.at - b.at || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    const myMonthSubs = reached.get(session.userId)?.count ?? 0;
    const rank = standings.findIndex((r) => r.id === session.userId) + 1;
    const totalRecruiters = standings.length;
    const tiedWith = standings.filter((r) => r.count === myMonthSubs && r.id !== session.userId).length;
    const rankOrdinal = (n: number) => {
      const s = ["th", "st", "nd", "rd"], v = n % 100;
      return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
    };

    return (
      <>
        <Header title="Dashboard" />
        <div className="p-6 space-y-6">

          {/* ── Monthly company rank ── */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-5 shadow-lg">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/[0.06]" />
            <div className="absolute right-20 bottom-0 h-20 w-20 rounded-full bg-white/[0.05]" />
            <div className="relative flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                  <Trophy className="h-7 w-7 text-amber-300" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-200">Monthly Company Rank</p>
                  <div className="mt-0.5 flex items-baseline gap-2">
                    <span className="text-[34px] font-extrabold leading-none text-white">{rankOrdinal(rank)}</span>
                    <span className="text-[13px] font-medium text-indigo-200">of {totalRecruiters} recruiters</span>
                  </div>
                  <p className="mt-1 text-[12px] text-indigo-100/90">
                    By total submissions this month{myMonthSubs > 0 && tiedWith > 0 ? ` · tied with ${tiedWith} on ${myMonthSubs}, ranked by who reached it first` : ""}
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-center backdrop-blur-sm">
                <p className="text-[26px] font-bold leading-none text-white">{myMonthSubs}</p>
                <p className="mt-1 text-[11px] font-medium text-indigo-200">Your submissions<br />this month</p>
              </div>
            </div>
          </div>

          {emailActivity && (
            <EmailActivityCards
              counts={emailActivity.counts}
              connected={!!emailActivity.account}
              lastSyncAt={emailActivity.account?.lastSyncAt ?? null}
              compact
            />
          )}

          {/* Recruiters see only their consultant reports, side by side */}
          <div className="grid gap-6 xl:grid-cols-2">
            <ConsultantCountTable
              title="Submissions"
              subtitle="Your submissions per consultant"
              icon={FileText} iconBg="bg-sky-50" iconColor="text-sky-600"
              rows={submissionRows}
              weeklyTarget={WEEKLY_SUB_TARGET}
            />
            <ConsultantCountTable
              title="Interviews"
              subtitle="Your interviews per consultant"
              icon={Calendar} iconBg="bg-violet-50" iconColor="text-violet-600"
              rows={interviewRows}
            />
          </div>
        </div>
      </>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════════
     ADMIN DASHBOARD
  ══════════════════════════════════════════════════════════════════════════ */
  const recruiterRole = await prisma.role.findUnique({ where: { name: "Recruiter" } });
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    userCount, recruiterCount, roleCount, activeCount,
    studentCount, submissionCount, interviewCount, techSupportCount,
    inMarketCount, onProjectCount, preMarketingCount, projectCompletedCount,
    pendingExpenses, recentSubs, recentIntvs, attendanceToday,
  ] = await Promise.all([
    prisma.user.count(),
    recruiterRole ? prisma.user.count({ where: { roleId: recruiterRole.id } }) : Promise.resolve(0),
    prisma.role.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.student.count(),
    prisma.submission.count(),
    prisma.interview.count(),
    prisma.techSupport.count(),
    prisma.student.count({ where: { projectStatus: "In-Market" } }),
    prisma.student.count({ where: { projectStatus: "In-Project" } }),
    prisma.student.count({ where: { projectStatus: "Pre-Marketing" } }),
    prisma.student.count({ where: { projectStatus: "Project Completed- InMarket" } }),
    prisma.expense.count({ where: { status: "Pending" } }),
    prisma.submission.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.interview.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    getTodayAttendance(),
  ]);

  const primaryStats: StatCardProps[] = [
    { label: "Consultants", value: studentCount, sub: `${preMarketingCount} Pre-Marketing · ${inMarketCount} In-Market`, href: "/admin/students", icon: GraduationCap, iconBg: "bg-violet-50", iconColor: "text-violet-600", valueColor: "text-violet-700", accent: "bg-violet-500" },
    { label: "Submissions", value: submissionCount, sub: `+${recentSubs} this week`, href: "/admin/submissions/list", icon: FileText, iconBg: "bg-sky-50", iconColor: "text-sky-600", valueColor: "text-sky-700", accent: "bg-sky-500" },
    { label: "Interviews", value: interviewCount, sub: `+${recentIntvs} this week`, href: "/admin/interviews/list", icon: Calendar, iconBg: "bg-orange-50", iconColor: "text-orange-600", valueColor: "text-orange-700", accent: "bg-orange-500" },
    { label: "Pending Expenses", value: pendingExpenses, sub: "Awaiting approval", href: "/admin/expenses", icon: DollarSign, iconBg: "bg-teal-50", iconColor: "text-teal-600", valueColor: "text-teal-700", accent: "bg-teal-500" },
  ];

  const secondaryStats: StatCardProps[] = [
    { label: "Total Users", value: userCount, sub: `${activeCount} active`, href: "/admin/users", icon: Users, iconBg: "bg-indigo-50", iconColor: "text-indigo-600", valueColor: "text-indigo-700", accent: "bg-indigo-500" },
    { label: "Recruiters", value: recruiterCount, sub: "Active team", href: "/admin/recruiters", icon: UserPlus, iconBg: "bg-emerald-50", iconColor: "text-emerald-600", valueColor: "text-emerald-700", accent: "bg-emerald-500" },
    { label: "Tech Support", value: techSupportCount, sub: "Available SMEs", href: "/admin/tech-support", icon: Briefcase, iconBg: "bg-amber-50", iconColor: "text-amber-600", valueColor: "text-amber-700", accent: "bg-amber-500" },
    { label: "Roles Configured", value: roleCount, sub: "Access control", href: "/admin/userrole", icon: Shield, iconBg: "bg-slate-100", iconColor: "text-slate-600", valueColor: "text-slate-700", accent: "bg-slate-500" },
  ];

  const pipelineTotal = preMarketingCount + inMarketCount + onProjectCount + projectCompletedCount;

  return (
    <div className="flex h-full flex-col p-4">
      {/* Welcome banner */}
      <div className="relative z-20 shrink-0 rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 px-4 py-3 shadow-sm">
        <div className="relative flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="text-[12px] font-medium text-slate-400">{greeting()},</p>
              <h2 className="text-[16px] font-extrabold text-white">{firstName}!</h2>
              <p className="text-[11px] text-slate-500">{todayStr()}</p>
            </div>
            <p className="mt-1 truncate text-[11px] text-slate-300">
              {studentCount} consultants · {submissionCount} submissions · {interviewCount} interviews
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <AttendanceTodayTile {...attendanceToday} />
            {[
              { label: "Pre-Marketing", value: preMarketingCount, color: "text-amber-300" },
              { label: "In-Market", value: inMarketCount, color: "text-indigo-300" },
              { label: "In-Project", value: onProjectCount, color: "text-emerald-300" },
              { label: "Active Users", value: activeCount, color: "text-violet-300" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg border border-white/[0.08] bg-white/[0.05] px-2.5 py-1.5 text-center backdrop-blur-sm">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p className={cn("text-[16px] font-bold tabular-nums leading-none", color)}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="mt-3 shrink-0">
        <div className="mb-2 flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-slate-400" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Operations Overview</p>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[...primaryStats, ...secondaryStats].map((s) => <StatCard key={s.label} {...s} />)}
        </div>
      </div>

      {/* Bottom row */}
      <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50">
              <BarChart3 className="h-3.5 w-3.5 text-violet-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-slate-900">Consultant Pipeline</p>
              <p className="text-[10px] text-slate-400">{studentCount} total consultants</p>
            </div>
            <Link href="/admin/students" className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-700">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            <PipelineBar label="Pre-Marketing" count={preMarketingCount} total={pipelineTotal || 1} barColor="bg-amber-400" dotColor="bg-amber-400" />
            <PipelineBar label="In-Market" count={inMarketCount} total={pipelineTotal || 1} barColor="bg-indigo-500" dotColor="bg-indigo-500" />
            <PipelineBar label="In-Project" count={onProjectCount} total={pipelineTotal || 1} barColor="bg-emerald-500" dotColor="bg-emerald-500" />
            <PipelineBar label="Project Completed" count={projectCompletedCount} total={pipelineTotal || 1} barColor="bg-sky-500" dotColor="bg-sky-500" />
          </div>
          {pipelineTotal === 0 && <p className="mt-2 text-center text-[11px] text-slate-400">No consultants with status yet</p>}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div>
              <p className="text-[12px] font-bold text-slate-900">Quick Actions</p>
              <p className="text-[10px] text-slate-400">Frequently used workflows</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <QuickAction label="New Consultant" href="/admin/students" icon={GraduationCap} color="bg-violet-500" />
            <QuickAction label="New Recruiter" href="/admin/recruiters" icon={UserPlus} color="bg-emerald-500" />
            <QuickAction label="New Submission" href="/admin/submissions" icon={FileText} color="bg-sky-500" />
            <QuickAction label="New Interview" href="/admin/interviews" icon={Calendar} color="bg-orange-500" />
            <QuickAction label="New Expense" href="/admin/expenses" icon={DollarSign} color="bg-teal-500" />
            <QuickAction label="Pre-Marketing" href="/admin/premarketing" icon={MapPin} color="bg-pink-500" />
          </div>
        </div>
      </div>
    </div>
  );
}
