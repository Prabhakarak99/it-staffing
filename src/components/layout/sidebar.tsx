"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, BarChart3, CalendarCheck, GraduationCap, Megaphone, Target, Send, Calendar,
  ClipboardList, BookUser, Inbox, Zap, Bot, MailCheck, Mails, FileText, Briefcase, Mic, Users, Shield, UserPlus, Wrench, DollarSign, ChevronDown,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  /** Path prefix used for role checks and the active highlight */
  match: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    label: null,
    items: [
      { label: "Dashboard", href: "/admin",         match: "/admin",         icon: LayoutDashboard, exact: true },
      { label: "Attendance", href: "/admin/attendance", match: "/admin/attendance", icon: CalendarCheck },
      { label: "Reports",   href: "/admin/reports", match: "/admin/reports", icon: BarChart3 },
    ],
  },
  {
    label: "Onboarding",
    items: [
      { label: "Consultants",   href: "/admin/students",     match: "/admin/students",     icon: GraduationCap },
      { label: "Pre-Marketing", href: "/admin/premarketing", match: "/admin/premarketing", icon: Megaphone },
      { label: "Leads",         href: "/admin/leads",        match: "/admin/leads",        icon: Target },
    ],
  },
  {
    label: "Bench Sales",
    items: [
      { label: "Submissions",         href: "/admin/submissions/list",   match: "/admin/submissions",         icon: Send },
      { label: "Easy Submissions",    href: "/admin/easy-submissions",   match: "/admin/easy-submissions",    icon: Zap },
      { label: "Resumes",             href: "/admin/resumes",            match: "/admin/resumes",             icon: FileText },
      { label: "Interviews",          href: "/admin/interviews/list",    match: "/admin/interviews",          icon: Calendar },
      { label: "Follow-ups",          href: "/admin/follow-ups",         match: "/admin/follow-ups",          icon: MailCheck },
      { label: "Email Templates",     href: "/admin/email-templates",    match: "/admin/email-templates",     icon: Mails },
      { label: "Vendor Requirements", href: "/admin/vendor-requirements", match: "/admin/vendor-requirements", icon: ClipboardList },
      { label: "Vendor Management",   href: "/admin/vendor-management",  match: "/admin/vendor-management",  icon: BookUser },
      { label: "Mailbox",             href: "/admin/mailbox",            match: "/admin/mailbox",            icon: Inbox },
      { label: "Requirements",        href: "/admin/requirements",       match: "/admin/requirements",        icon: Briefcase },
      { label: "Otter Status",        href: "/admin/otter-status",       match: "/admin/otter-status",        icon: Mic },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Users",      href: "/admin/users",      match: "/admin/users",      icon: Users },
      { label: "User Roles", href: "/admin/userrole",   match: "/admin/userrole",   icon: Shield },
      { label: "Recruiters", href: "/admin/recruiters", match: "/admin/recruiters", icon: UserPlus },
      { label: "AI Settings", href: "/admin/ai-settings", match: "/admin/ai-settings", icon: Bot },
    ],
  },
  {
    label: "Other",
    items: [
      { label: "Tech Support", href: "/admin/tech-support", match: "/admin/tech-support", icon: Wrench },
      { label: "Expenses",     href: "/admin/expenses",     match: "/admin/expenses",     icon: DollarSign },
    ],
  },
];

interface SidebarProps {
  allowedPaths: string[] | null;
  /** Icon-only rail on desktop */
  collapsed: boolean;
  /** Drawer state on small screens */
  mobileOpen: boolean;
  onNavigate: () => void;
}

export function Sidebar({ allowedPaths, collapsed, mobileOpen, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const [closedGroups, setClosedGroups] = useState<Set<string>>(new Set());

  const allowed = (match: string) => {
    if (allowedPaths === null) return true;
    if (match === "/admin") return true;
    return allowedPaths.some(
      (p) => p !== "/admin" && (match === p || match.startsWith(p + "/") || p.startsWith(match + "/"))
    );
  };

  const isActive = (match: string, exact?: boolean) =>
    exact ? pathname === match : pathname === match || pathname.startsWith(match + "/");

  const toggleGroup = (label: string) =>
    setClosedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  // Groups with no screens for this role are hidden entirely
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => allowed(i.match)) })).filter(
    (g) => g.items.length > 0
  );

  return (
    <>
      {/* Backdrop for the mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 top-[64px] z-30 bg-black/40 lg:hidden" onClick={onNavigate} />
      )}

      <aside
        className={cn(
          "no-scrollbar z-40 shrink-0 overflow-y-auto border-r border-white/[0.06] bg-[#0A0F1E] py-3 transition-all duration-200",
          // Mobile: slide-in drawer below the top bar
          "fixed bottom-0 left-0 top-[64px] w-[240px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: in-flow column, full width or icon rail
          "lg:static lg:translate-x-0",
          collapsed ? "lg:w-[68px]" : "lg:w-[240px]"
        )}
      >
        {groups.map((group) => {
          const open = !group.label || !closedGroups.has(group.label);
          return (
            <div key={group.label ?? "main"} className="mb-2 px-3">
              {group.label && collapsed && <div className="mx-2 my-2 hidden h-px bg-white/[0.07] lg:block" />}
              {group.label && (
                <button
                  onClick={() => toggleGroup(group.label!)}
                  className={cn(
                    "flex w-full items-center justify-between px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 hover:text-slate-300",
                    collapsed && "lg:hidden"
                  )}
                >
                  {group.label}
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")} />
                </button>
              )}

              {(open || collapsed) && (
                // In the icon rail every item stays visible; group folding only applies to the full menu
                <div className={cn("space-y-0.5", !open && "hidden lg:block")}>
                  {group.items.map((item) => {
                    const active = isActive(item.match, item.exact);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-2.5 py-2 text-[14px] font-medium transition-colors",
                          collapsed && "lg:justify-center lg:px-0",
                          active
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-400 hover:bg-white/[0.08] hover:text-slate-100"
                        )}
                      >
                        <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-indigo-600" : "text-slate-500")} />
                        <span className={cn("truncate", collapsed && "lg:hidden")}>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </aside>
    </>
  );
}
