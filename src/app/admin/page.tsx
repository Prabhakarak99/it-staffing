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
  BarChart3, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function todayStr() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ── Stat card ────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: number;
  sub?: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  valueColor: string;
  accent: string;
}

function StatCard({ label, value, sub, href, icon: Icon, iconBg, iconColor, valueColor, accent }: StatCardProps) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
    >
      {/* Accent bar */}
      <div className={cn("absolute left-0 top-0 h-full w-[3px] rounded-l-2xl", accent)} />
      {/* Subtle glow top-right */}
      <div className={cn("absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-40", iconBg)} />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className={cn("mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl", iconBg)}>
            <Icon className={cn("h-5 w-5", iconColor)} />
          </div>
          <p className={cn("text-[28px] font-bold tabular-nums leading-none", valueColor)}>
            {value.toLocaleString()}
          </p>
          <p className="mt-1 text-[13px] font-medium text-slate-600">{label}</p>
          {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-slate-500 mt-1" />
      </div>
    </Link>
  );
}

// ── Pipeline bar ─────────────────────────────────────────────────────────────
function PipelineBar({
  label, count, total, barColor, dotColor,
}: { label: string; count: number; total: number; barColor: string; dotColor: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 w-[130px] shrink-0">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", dotColor)} />
        <span className="text-[12px] font-medium text-slate-600 truncate">{label}</span>
      </div>
      <div className="flex-1 flex items-center gap-2.5">
        <div className="flex-1 h-1.5 rounded-full bg-slate-100">
          <div
            className={cn("h-full rounded-full transition-all duration-500", barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[12px] font-bold tabular-nums text-slate-700 w-8 text-right">{count}</span>
        <span className="text-[10px] text-slate-400 w-8">{pct}%</span>
      </div>
    </div>
  );
}

// ── Quick action button ───────────────────────────────────────────────────────
function QuickAction({ label, href, icon: Icon, color }: {
  label: string; href: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-semibold text-slate-700 shadow-sm transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md"
    >
      <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", color)}>
        <Icon className="h-3.5 w-3.5 text-white" />
      </div>
      {label}
    </Link>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default async function AdminDashboard() {
  const session = await getSession();
  if (!session) redirect("/login");

  const isRecruiter = session.roleName === "Recruiter";

  // Fetch display name for both roles
  const me = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { firstName: true, lastName: true },
  });
  const firstName = me?.firstName ?? session.email.split("@")[0];

  /* ── Recruiter dashboard ─────────────────────────────────────────────────── */
  if (isRecruiter) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [submissionCount, interviewCount, recentSubs, recentIntvs] = await Promise.all([
      prisma.submission.count({ where: { recruiterId: session.userId } }),
      prisma.interview.count({ where: { recruiterId: session.userId } }),
      prisma.submission.count({ where: { recruiterId: session.userId, createdAt: { gte: sevenDaysAgo } } }),
      prisma.interview.count({ where: { recruiterId: session.userId, createdAt: { gte: sevenDaysAgo } } }),
    ]);

    return (
      <>
        <Header title="Dashboard" />
        <div className="p-6 space-y-6">
          {/* Welcome banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-6 shadow-lg">
            <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/[0.06]" />
            <div className="absolute left-1/2 bottom-0 h-24 w-24 rounded-full bg-white/[0.04]" />
            <div className="absolute right-16 bottom-2 h-14 w-14 rounded-full bg-white/[0.06]" />
            <div className="relative">
              <p className="text-[13px] font-medium text-indigo-200">{greeting()},</p>
              <h2 className="mt-0.5 text-[22px] font-extrabold text-white">{firstName}!</h2>
              <p className="mt-1 text-[12px] text-indigo-300/80">{todayStr()}</p>
              <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-indigo-100/90">
                Track your submissions through the vendor pipeline and manage your interview schedule.
              </p>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 max-w-xl">
            <StatCard
              label="My Submissions"
              value={submissionCount}
              sub={`+${recentSubs} this week`}
              href="/admin/submissions/list"
              icon={FileText}
              iconBg="bg-sky-50"
              iconColor="text-sky-600"
              valueColor="text-sky-700"
              accent="bg-sky-500"
            />
            <StatCard
              label="My Interviews"
              value={interviewCount}
              sub={`+${recentIntvs} this week`}
              href="/admin/interviews/list"
              icon={Calendar}
              iconBg="bg-violet-50"
              iconColor="text-violet-600"
              valueColor="text-violet-700"
              accent="bg-violet-500"
            />
          </div>

          {/* Quick actions */}
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">Quick Actions</p>
            <div className="flex flex-wrap gap-2.5">
              <QuickAction label="New Submission" href="/admin/submissions" icon={Plus} color="bg-sky-500" />
              <QuickAction label="New Interview" href="/admin/interviews" icon={Plus} color="bg-violet-500" />
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ── Admin dashboard ─────────────────────────────────────────────────────── */
  const recruiterRole = await prisma.role.findUnique({ where: { name: "Recruiter" } });
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    userCount, recruiterCount, roleCount, activeCount,
    studentCount, submissionCount, interviewCount, techSupportCount,
    inMarketCount, onProjectCount, placedCount, benchCount,
    pendingExpenses, recentSubs, recentIntvs,
  ] = await Promise.all([
    prisma.user.count(),
    recruiterRole
      ? prisma.user.count({ where: { roleId: recruiterRole.id } })
      : Promise.resolve(0),
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
    {
      label: "Consultants",
      value: studentCount,
      sub: `${inMarketCount} In Market · ${onProjectCount} On Project`,
      href: "/admin/students",
      icon: GraduationCap,
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
      valueColor: "text-violet-700",
      accent: "bg-violet-500",
    },
    {
      label: "Submissions",
      value: submissionCount,
      sub: `+${recentSubs} this week`,
      href: "/admin/submissions/list",
      icon: FileText,
      iconBg: "bg-sky-50",
      iconColor: "text-sky-600",
      valueColor: "text-sky-700",
      accent: "bg-sky-500",
    },
    {
      label: "Interviews",
      value: interviewCount,
      sub: `+${recentIntvs} this week`,
      href: "/admin/interviews/list",
      icon: Calendar,
      iconBg: "bg-orange-50",
      iconColor: "text-orange-600",
      valueColor: "text-orange-700",
      accent: "bg-orange-500",
    },
    {
      label: "Pending Expenses",
      value: pendingExpenses,
      sub: "Awaiting approval",
      href: "/admin/expenses",
      icon: DollarSign,
      iconBg: "bg-teal-50",
      iconColor: "text-teal-600",
      valueColor: "text-teal-700",
      accent: "bg-teal-500",
    },
  ];

  const secondaryStats: StatCardProps[] = [
    {
      label: "Total Users",
      value: userCount,
      sub: `${activeCount} active`,
      href: "/admin/users",
      icon: Users,
      iconBg: "bg-indigo-50",
      iconColor: "text-indigo-600",
      valueColor: "text-indigo-700",
      accent: "bg-indigo-500",
    },
    {
      label: "Recruiters",
      value: recruiterCount,
      sub: "Active team",
      href: "/admin/recruiters",
      icon: UserPlus,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      valueColor: "text-emerald-700",
      accent: "bg-emerald-500",
    },
    {
      label: "Tech Support",
      value: techSupportCount,
      sub: "Available SMEs",
      href: "/admin/tech-support",
      icon: Briefcase,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
      valueColor: "text-amber-700",
      accent: "bg-amber-500",
    },
    {
      label: "Roles Configured",
      value: roleCount,
      sub: "Access control",
      href: "/admin/userrole",
      icon: Shield,
      iconBg: "bg-slate-100",
      iconColor: "text-slate-600",
      valueColor: "text-slate-700",
      accent: "bg-slate-500",
    },
  ];

  const pipelineTotal = inMarketCount + onProjectCount + placedCount + benchCount;

  return (
    <>
      <Header title="Dashboard" />
      <div className="p-6 space-y-6">

        {/* ── Welcome banner ── */}
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

        {/* ── Primary KPI cards ── */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-slate-400" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Operations Overview</p>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {primaryStats.map((s) => (
              <StatCard key={s.label} {...s} />
            ))}
          </div>
        </div>

        {/* ── Secondary KPI cards ── */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {secondaryStats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>

        {/* ── Bottom row: Pipeline + Quick Actions ── */}
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
              <Link
                href="/admin/students"
                className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-3">
              <PipelineBar label="In Market" count={inMarketCount} total={pipelineTotal || 1} barColor="bg-indigo-500" dotColor="bg-indigo-500" />
              <PipelineBar label="On Project" count={onProjectCount} total={pipelineTotal || 1} barColor="bg-emerald-500" dotColor="bg-emerald-500" />
              <PipelineBar label="Placed" count={placedCount} total={pipelineTotal || 1} barColor="bg-sky-500" dotColor="bg-sky-500" />
              <PipelineBar label="Bench" count={benchCount} total={pipelineTotal || 1} barColor="bg-amber-400" dotColor="bg-amber-400" />
            </div>
            {pipelineTotal === 0 && (
              <p className="mt-4 text-center text-[12px] text-slate-400">No consultants with status yet</p>
            )}
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
