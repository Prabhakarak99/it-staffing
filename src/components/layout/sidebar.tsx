"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Users, Shield, UserPlus, LayoutDashboard, LogOut,
  Briefcase, FileText, Calendar, DollarSign, GraduationCap, Send,
} from "lucide-react";
import { GFTLogo } from "@/components/ui/logo";

const ALL_NAV_ITEMS = [
  { label: "Dashboard",           href: "/admin",                  icon: LayoutDashboard, group: "main",   exact: true },
  { label: "User Roles",          href: "/admin/userrole",         icon: Shield,          group: "admin",  exact: false },
  { label: "Users",               href: "/admin/users",            icon: Users,           group: "admin",  exact: false },
  { label: "Onboard Recruiter",   href: "/admin/recruiters",       icon: UserPlus,        group: "people", exact: false },
  { label: "Onboard Consultant",  href: "/admin/students",         icon: GraduationCap,   group: "people", exact: false },
  { label: "Premarketing",        href: "/admin/premarketing",     icon: Send,            group: "work",   exact: false },
  { label: "Create Submission",   href: "/admin/submissions",      icon: FileText,        group: "work",   exact: true },
  { label: "Total Submissions",   href: "/admin/submissions/list", icon: FileText,        group: "work",   exact: true },
  { label: "Create Interview",    href: "/admin/interviews",       icon: Calendar,        group: "work",   exact: true },
  { label: "Total Interviews",    href: "/admin/interviews/list",  icon: Calendar,        group: "work",   exact: true },
  { label: "Onboard TechSupport", href: "/admin/tech-support",    icon: Briefcase,       group: "work",   exact: false },
  { label: "Expenses",            href: "/admin/expenses",         icon: DollarSign,      group: "work",   exact: false },
];

interface SidebarProps {
  allowedPaths: string[] | null;
  userEmail: string;
  roleName: string | null;
}

export function Sidebar({ allowedPaths, userEmail, roleName }: SidebarProps) {
  const pathname = usePathname();

  const navItems =
    allowedPaths === null
      ? ALL_NAV_ITEMS
      : ALL_NAV_ITEMS.filter((item) => {
          if (item.href === "/admin") return true; // dashboard always visible
          return allowedPaths!.some(
            (p) => p !== "/admin" && (item.href === p || item.href.startsWith(p + "/"))
          );
        });

  const initials = userEmail.slice(0, 2).toUpperCase();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-slate-900">
      {/* Logo */}
      <div className="flex h-16 items-center px-4 border-b border-slate-800">
        <GFTLogo theme="dark" />
      </div>

      {/* Navigation */}
      <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map(({ label, href, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/40"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-slate-500")} />
              <span>{label}</span>
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-300" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-800 p-3">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2 mb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-xs font-bold text-indigo-300 shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">{userEmail}</p>
            <p className="text-xs text-slate-500">{roleName ?? "Super Admin"}</p>
          </div>
        </div>
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-all duration-150"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  );
}
