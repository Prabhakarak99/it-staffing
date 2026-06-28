export const dynamic = "force-dynamic";

import Link from "next/link";
import { Header } from "@/components/layout/header";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Users, UserPlus, Shield, Briefcase,
  GraduationCap, FileText, Calendar, CheckCircle2,
  TrendingUp, MapPin, DollarSign, Plus, ArrowRight,
  BarChart3, Activity, Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function todayStr() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
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
    <Link href={href} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      <div className={cn("absolute left-0 top-0 h-full w-[3px] rounded-l-2xl", accent)} />
      <div className={cn("absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-40", iconBg)} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className={cn("mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl", iconBg)}>
            <Icon className={cn("h-5 w-5", iconColor)} />
          </div>
          <p className={cn("text-[28px] font-bold tabular-nums leading-none", valueColor)}>{value.toLocaleString()}</p>
          <p className="mt-1 text-[13px] font-medium text-slate-600">{label}</p>
          {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-slate-500 mt-1" />
      </div>
    </Link>
  );
}

function PipelineBar({ label, count, total, barColor, dotColor }: {
  label: string; count: number; total: number; barColor: string; dotColor: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 w-[130px] shrink-0">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", dotColor)} />
        <span className="text-[12px] font-medium text-slate-600 truncate">{label}</span>
      </div>
      <div className="flex-1 flex items-center gap-2.5">
        <div className="flex-1 h-1.5 rounded-full bg-slate-100">
          <div className={cn("h-full rounded-full transition-all duration-500", barColor)} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[12px] font-bold tabular-nums text-slate-700 w-8 text-right">{count}</span>
        <span className="text-[10px] text-slate-400 w-8">{pct}%</span>
      </div>
    </div>
  );
}

function QuickAction({ label, href, icon: Icon, color }: {
  label: string; href: string; icon: React.ComponentType<{ className?: string }>; color: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-semibold text-slate-700 shadow-sm transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md">
      <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", color)}>
        <Icon className="h-3.5 w-3.5 text-white" />
      </div>
      {label}
    </Link>
  );
}

// ── Target progress bar ───────────────────────────────────────────────────────
function TargetBar({ label, icon: Icon, iconColor, current, target, barFull, barMid, barLow, unit = "" }: {
  label: string; icon: React.ComponentType<{ className?: string }>; iconColor: string;
  current: number; target: number; barFull: string; barMid: string; barLow: string; unit?: string;
}) {
  const pct = Math.min(100, target > 0 ? Math.round((current / target) * 100) : 0);
  const barColor = pct >= 100 ? barFull : pct >= 50 ? barMid : barLow;
  const badgeColor = pct >= 100 ? "bg-emerald-100 text-emerald-700" : pct >= 50 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-600";
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-3.5 w-3.5", iconColor)} />
          <span className="text-[12px] font-semibold text-slate-700">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-bold text-slate-800">{current}{unit}</span>
          <span className="text-[11px] text-slate-400">/ {target} target</span>
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", badgeColor)}>{pct}%</span>
        </div>
      </div>
      <div className="h-2.5 w-full rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full transition-all duration-700", barColor)} style={{ width: `${pct}%` }} />
      </div>
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
    // ── Date boundaries (Mon-based week) ─────────────────────────────────────
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dow = now.getDay(); // 0=Sun
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (dow === 0 ? 6 : dow - 1));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // ── Targets ──────────────────────────────────────────────────────────────
    const DAILY_TARGET = 2;
    const WEEKLY_SUB_TARGET = 10;
    const WEEKLY_INTV_TARGET = 1;

    // ── Queries ──────────────────────────────────────────────────────────────
    const [
      todaySubsCount, weekSubsCount, monthSubsCount,
      todayIntvCount, weekIntvCount, monthIntvCount,
      todaySubsByC, weekSubsByC,
    ] = await Promise.all([
      prisma.submission.count({ where: { recruiterId: session.userId, createdAt: { gte: todayStart } } }),
      prisma.submission.count({ where: { recruiterId: session.userId, createdAt: { gte: weekStart } } }),
      prisma.submission.count({ where: { recruiterId: session.userId, createdAt: { gte: monthStart } } }),
      prisma.interview.count({ where: { recruiterId: session.userId, createdAt: { gte: todayStart } } }),
      prisma.interview.count({ where: { recruiterId: session.userId, createdAt: { gte: weekStart } } }),
      prisma.interview.count({ where: { recruiterId: session.userId, createdAt: { gte: monthStart } } }),
      // Consultant-wise breakdowns
      prisma.submission.groupBy({
        by: ["consultantId"],
        where: { recruiterId: session.userId, createdAt: { gte: todayStart } },
        _count: { _all: true },
      }),
      prisma.submission.groupBy({
        by: ["consultantId"],
        where: { recruiterId: session.userId, createdAt: { gte: weekStart } },
        _count: { _all: true },
      }),
    ]);

    // Merge consultant IDs and fetch names
    const cIds = [...new Set([...todaySubsByC.map((s) => s.consultantId), ...weekSubsByC.map((s) => s.consultantId)])];
    const consultants = cIds.length > 0
      ? await prisma.student.findMany({ where: { id: { in: cIds } }, select: { id: true, firstName: true, lastName: true, technology: true } })
      : [];

    const consultantRows = consultants
      .map((c) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        technology: c.technology,
        todayCount: todaySubsByC.find((s) => s.consultantId === c.id)?._count._all ?? 0,
        weekCount: weekSubsByC.find((s) => s.consultantId === c.id)?._count._all ?? 0,
      }))
      .sort((a, b) => b.weekCount - a.weekCount || b.todayCount - a.todayCount);

    const weekGoalsMet = weekSubsCount >= WEEKLY_SUB_TARGET && weekIntvCount >= WEEKLY_INTV_TARGET;

    return (
      <>
        <Header title="Dashboard" />
        <div className="p-6 space-y-6">

          {/* ── Welcome banner ── */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-6 shadow-lg">
            <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/[0.06]" />
            <div className="absolute left-1/2 bottom-0 h-24 w-24 rounded-full bg-white/[0.04]" />
            <div className="absolute right-16 bottom-2 h-14 w-14 rounded-full bg-white/[0.06]" />
            <div className="relative flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[13px] font-medium text-indigo-200">{greeting()},</p>
                <h2 className="mt-0.5 text-[22px] font-extrabold text-white">{firstName}!</h2>
                <p className="mt-1 text-[12px] text-indigo-300/80">{todayStr()}</p>
                <p className="mt-3 text-[13px] leading-relaxed text-indigo-100/90">
                  {monthSubsCount} submissions · {monthIntvCount} interviews this month
                </p>
              </div>
              {weekGoalsMet && (
                <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                  <div>
                    <p className="text-[12px] font-bold text-white">Weekly goals met!</p>
                    <p className="text-[10px] text-indigo-200">Keep up the great work</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Period stats ── */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50">
                <BarChart3 className="h-4 w-4 text-sky-600" />
              </div>
              <p className="text-[13px] font-bold text-slate-900">My Activity</p>
            </div>

            {/* Submissions row */}
            <div className="grid grid-cols-3 divide-x divide-slate-100">
              {[
                { label: "Today", value: todaySubsCount, target: DAILY_TARGET },
                { label: "This Week", value: weekSubsCount, target: WEEKLY_SUB_TARGET },
                { label: "This Month", value: monthSubsCount, target: null },
              ].map(({ label, value, target }) => (
                <div key={label} className="p-5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
                  <div className="mt-2 flex items-end justify-center gap-1">
                    <p className="text-[30px] font-bold tabular-nums text-sky-700">{value}</p>
                    {target !== null && <p className="mb-1 text-[11px] text-slate-400">/ {target}</p>}
                  </div>
                  <p className="text-[11px] font-semibold text-sky-600">Submissions</p>
                </div>
              ))}
            </div>

            {/* Interviews row */}
            <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 bg-slate-50/50">
              {[
                { label: "Today", value: todayIntvCount, target: null },
                { label: "This Week", value: weekIntvCount, target: WEEKLY_INTV_TARGET },
                { label: "This Month", value: monthIntvCount, target: null },
              ].map(({ label, value, target }) => (
                <div key={label} className="p-5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
                  <div className="mt-2 flex items-end justify-center gap-1">
                    <p className="text-[30px] font-bold tabular-nums text-violet-700">{value}</p>
                    {target !== null && <p className="mb-1 text-[11px] text-slate-400">/ {target}</p>}
                  </div>
                  <p className="text-[11px] font-semibold text-violet-600">Interviews</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Weekly targets ── */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                <Target className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-slate-900">Weekly Targets</p>
                <p className="text-[11px] text-slate-400">Monday – Sunday progress</p>
              </div>
              {weekGoalsMet && (
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> All targets met!
                </span>
              )}
            </div>
            <div className="space-y-4">
              <TargetBar
                label="Submissions this week"
                icon={FileText} iconColor="text-sky-500"
                current={weekSubsCount} target={WEEKLY_SUB_TARGET}
                barFull="bg-emerald-500" barMid="bg-amber-400" barLow="bg-sky-400"
              />
              <TargetBar
                label="Interviews this week"
                icon={Calendar} iconColor="text-violet-500"
                current={weekIntvCount} target={WEEKLY_INTV_TARGET}
                barFull="bg-emerald-500" barMid="bg-violet-400" barLow="bg-rose-400"
              />
            </div>
          </div>

          {/* ── Consultant submission activity ── */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
                <GraduationCap className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-slate-900">Consultant Submissions</p>
                <p className="text-[11px] text-slate-400">
                  Daily target: {DAILY_TARGET} submissions per consultant · Weekly target: {WEEKLY_SUB_TARGET} total
                </p>
              </div>
            </div>

            {consultantRows.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <GraduationCap className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                <p className="text-[13px] font-semibold text-slate-500">No submissions yet this week</p>
                <p className="mt-1 text-[11px] text-slate-400">Submissions will appear here once you start adding them</p>
                <Link href="/admin/submissions" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-[12px] font-bold text-white hover:bg-sky-600 transition-colors">
                  <Plus className="h-3.5 w-3.5" /> New Submission
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-800">
                      <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-300">Consultant</th>
                      <th className="px-5 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap">Today</th>
                      <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap">Daily Progress (Target: {DAILY_TARGET})</th>
                      <th className="px-5 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap">This Week</th>
                      <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap">Week Progress (Target: {WEEKLY_SUB_TARGET})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {consultantRows.map((c) => {
                      const todayPct = Math.min(100, Math.round((c.todayCount / DAILY_TARGET) * 100));
                      const weekPct = Math.min(100, Math.round((c.weekCount / WEEKLY_SUB_TARGET) * 100));
                      const todayBar = todayPct >= 100 ? "bg-emerald-500" : todayPct >= 50 ? "bg-amber-400" : "bg-sky-400";
                      const weekBar = weekPct >= 100 ? "bg-emerald-500" : weekPct >= 50 ? "bg-amber-400" : "bg-sky-400";
                      const avatarBg = todayPct >= 100 ? "bg-emerald-100 text-emerald-700" : todayPct > 0 ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-700";
                      return (
                        <tr key={c.id} className="hover:bg-indigo-50/20 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold", avatarBg)}>
                                {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-[12px] font-semibold text-slate-800 whitespace-nowrap">{c.name}</p>
                                {c.technology && <p className="text-[10px] text-slate-400">{c.technology}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold", avatarBg)}>
                              {c.todayCount}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 min-w-[160px]">
                            <div className="h-2 w-full rounded-full bg-slate-100">
                              <div className={cn("h-full rounded-full transition-all", todayBar)} style={{ width: `${todayPct}%` }} />
                            </div>
                            <p className="mt-0.5 text-[10px] text-slate-400">{todayPct}% of daily target</p>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={cn(
                              "text-[13px] font-bold",
                              weekPct >= 100 ? "text-emerald-600" : "text-slate-700"
                            )}>{c.weekCount}</span>
                          </td>
                          <td className="px-5 py-3.5 min-w-[160px]">
                            <div className="h-2 w-full rounded-full bg-slate-100">
                              <div className={cn("h-full rounded-full transition-all", weekBar)} style={{ width: `${weekPct}%` }} />
                            </div>
                            <p className="mt-0.5 text-[10px] text-slate-400">{weekPct}% of week target</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Quick actions ── */}
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">Quick Actions</p>
            <div className="flex flex-wrap gap-2.5">
              <QuickAction label="New Submission" href="/admin/submissions" icon={Plus} color="bg-sky-500" />
              <QuickAction label="New Interview" href="/admin/interviews" icon={Plus} color="bg-violet-500" />
              <QuickAction label="My Submissions" href="/admin/submissions/list" icon={FileText} color="bg-slate-500" />
              <QuickAction label="My Interviews" href="/admin/interviews/list" icon={Calendar} color="bg-slate-500" />
            </div>
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
    inMarketCount, onProjectCount, placedCount, benchCount,
    pendingExpenses, recentSubs, recentIntvs,
  ] = await Promise.all([
    prisma.user.count(),
    recruiterRole ? prisma.user.count({ where: { roleId: recruiterRole.id } }) : Promise.resolve(0),
    prisma.role.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.student.count(),
    prisma.submission.count(),
    prisma.interview.count(),
    prisma.techSupport.count(),
    prisma.student.count({ where: { projectStatus: "In Market" } }),
    prisma.student.count({ where: { projectStatus: "On Project" } }),
    prisma.student.count({ where: { projectStatus: "Placed" } }),
    prisma.student.count({ where: { projectStatus: "Bench" } }),
    prisma.expense.count({ where: { status: "Pending" } }),
    prisma.submission.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.interview.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
  ]);

  const primaryStats: StatCardProps[] = [
    { label: "Consultants", value: studentCount, sub: `${inMarketCount} In Market · ${onProjectCount} On Project`, href: "/admin/students", icon: GraduationCap, iconBg: "bg-violet-50", iconColor: "text-violet-600", valueColor: "text-violet-700", accent: "bg-violet-500" },
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

  const pipelineTotal = inMarketCount + onProjectCount + placedCount + benchCount;

  return (
    <>
      <Header title="Dashboard" />
      <div className="p-6 space-y-6">

        {/* Welcome banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 shadow-lg">
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-indigo-600/10" />
          <div className="absolute right-32 bottom-0 h-24 w-24 rounded-full bg-indigo-400/5" />
          <div className="absolute left-1/3 -bottom-4 h-20 w-20 rounded-full bg-violet-500/10" />
          <div className="relative flex items-center justify-between gap-6">
            <div>
              <p className="text-[13px] font-medium text-slate-400">{greeting()},</p>
              <h2 className="mt-0.5 text-[22px] font-extrabold text-white">{firstName}!</h2>
              <p className="mt-1 text-[12px] text-slate-500">{todayStr()}</p>
              <p className="mt-3 max-w-md text-[13px] leading-relaxed text-slate-300">
                {studentCount} consultants in the pipeline · {submissionCount} total submissions · {interviewCount} interviews logged
              </p>
            </div>
            <div className="hidden lg:flex items-center gap-3">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-3 text-center backdrop-blur-sm">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">In Market</p>
                <p className="mt-1 text-[24px] font-bold tabular-nums text-indigo-300">{inMarketCount}</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-3 text-center backdrop-blur-sm">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">On Project</p>
                <p className="mt-1 text-[24px] font-bold tabular-nums text-emerald-300">{onProjectCount}</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-3 text-center backdrop-blur-sm">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Active Users</p>
                <p className="mt-1 text-[24px] font-bold tabular-nums text-violet-300">{activeCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Primary KPI cards */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-slate-400" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Operations Overview</p>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {primaryStats.map((s) => <StatCard key={s.label} {...s} />)}
          </div>
        </div>

        {/* Secondary KPI cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {secondaryStats.map((s) => <StatCard key={s.label} {...s} />)}
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Consultant pipeline */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
                <BarChart3 className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-slate-900">Consultant Pipeline</p>
                <p className="text-[11px] text-slate-400">{studentCount} total consultants</p>
              </div>
              <Link href="/admin/students" className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-3">
              <PipelineBar label="In Market" count={inMarketCount} total={pipelineTotal || 1} barColor="bg-indigo-500" dotColor="bg-indigo-500" />
              <PipelineBar label="On Project" count={onProjectCount} total={pipelineTotal || 1} barColor="bg-emerald-500" dotColor="bg-emerald-500" />
              <PipelineBar label="Placed" count={placedCount} total={pipelineTotal || 1} barColor="bg-sky-500" dotColor="bg-sky-500" />
              <PipelineBar label="Bench" count={benchCount} total={pipelineTotal || 1} barColor="bg-amber-400" dotColor="bg-amber-400" />
            </div>
            {pipelineTotal === 0 && <p className="mt-4 text-center text-[12px] text-slate-400">No consultants with status yet</p>}
          </div>

          {/* Quick actions */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-slate-900">Quick Actions</p>
                <p className="text-[11px] text-slate-400">Frequently used workflows</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
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
    </>
  );
}
