import { Header } from "@/components/layout/header";
import { prisma } from "@/lib/prisma";
import {
  Users, UserPlus, Shield, Briefcase,
  GraduationCap, FileText, Calendar, CheckCircle2,
} from "lucide-react";

export default async function AdminDashboard() {
  const recruiterRole = await prisma.role.findUnique({ where: { name: "Recruiter" } });

  const [
    userCount, recruiterCount, roleCount, activeCount,
    studentCount, submissionCount, interviewCount, techSupportCount,
  ] = await Promise.all([
    prisma.user.count(),
    recruiterRole ? prisma.user.count({ where: { roleId: recruiterRole.id } }) : Promise.resolve(0),
    prisma.role.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.student.count(),
    prisma.submission.count(),
    prisma.interview.count(),
    prisma.techSupport.count(),
  ]);

  const stats = [
    {
      label: "Total Users",
      value: userCount,
      icon: Users,
      bg: "bg-indigo-600",
      light: "bg-indigo-50",
      text: "text-indigo-600",
      border: "border-indigo-100",
    },
    {
      label: "Recruiters",
      value: recruiterCount,
      icon: UserPlus,
      bg: "bg-emerald-600",
      light: "bg-emerald-50",
      text: "text-emerald-600",
      border: "border-emerald-100",
    },
    {
      label: "Consultants",
      value: studentCount,
      icon: GraduationCap,
      bg: "bg-violet-600",
      light: "bg-violet-50",
      text: "text-violet-600",
      border: "border-violet-100",
    },
    {
      label: "Submissions",
      value: submissionCount,
      icon: FileText,
      bg: "bg-sky-600",
      light: "bg-sky-50",
      text: "text-sky-600",
      border: "border-sky-100",
    },
    {
      label: "Interviews",
      value: interviewCount,
      icon: Calendar,
      bg: "bg-orange-500",
      light: "bg-orange-50",
      text: "text-orange-600",
      border: "border-orange-100",
    },
    {
      label: "Tech Support",
      value: techSupportCount,
      icon: Briefcase,
      bg: "bg-pink-600",
      light: "bg-pink-50",
      text: "text-pink-600",
      border: "border-pink-100",
    },
    {
      label: "Active Accounts",
      value: activeCount,
      icon: CheckCircle2,
      bg: "bg-teal-600",
      light: "bg-teal-50",
      text: "text-teal-600",
      border: "border-teal-100",
    },
    {
      label: "Roles",
      value: roleCount,
      icon: Shield,
      bg: "bg-slate-700",
      light: "bg-slate-100",
      text: "text-slate-700",
      border: "border-slate-200",
    },
  ];

  return (
    <>
      <Header title="Dashboard" />
      <div className="p-6 space-y-6">

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-4">
          {stats.map(({ label, value, icon: Icon, bg, light, text, border }) => (
            <div
              key={label}
              className={`relative overflow-hidden rounded-2xl border ${border} bg-white p-5 shadow-sm`}
            >
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${light} mb-4`}>
                <Icon className={`h-5 w-5 ${text}`} />
              </div>
              <p className="text-3xl font-bold text-slate-900 tabular-nums">{value}</p>
              <p className="text-sm text-slate-500 mt-0.5">{label}</p>
              {/* Decorative bar */}
              <div className={`absolute top-0 left-0 h-1 w-full ${bg} rounded-t-2xl`} />
            </div>
          ))}
        </div>

        {/* Welcome / quick-actions */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 shadow-md shadow-indigo-200 shrink-0">
                <Briefcase className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Welcome to IT Staffing Solutions</h2>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  Manage your entire staffing operation — onboard recruiters and consultants, track
                  submissions through the vendor pipeline, schedule interviews, and monitor placements.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-600 to-violet-600 p-6 shadow-sm text-white">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-200 mb-3">Quick summary</p>
            <div className="space-y-2.5">
              {[
                { label: "Open submissions", value: submissionCount },
                { label: "Interviews logged", value: interviewCount },
                { label: "Active consultants", value: studentCount },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-sm text-indigo-100">{label}</span>
                  <span className="text-lg font-bold tabular-nums">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
