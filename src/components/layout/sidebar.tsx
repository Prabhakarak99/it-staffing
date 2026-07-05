"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Users, Shield, UserPlus, LayoutDashboard, LogOut,
  Briefcase, FileText, Calendar, DollarSign, GraduationCap, Send,
  ChevronLeft, ChevronRight, ChevronDown,
} from "lucide-react";
import { GFTMark } from "@/components/ui/logo";

interface ChildItem {
  label: string;
  href: string;
  exact?: boolean;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  children?: ChildItem[];
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    label: null,
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "User Roles", href: "/admin/userrole", icon: Shield },
      { label: "Users", href: "/admin/users", icon: Users },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Onboard Recruiter", href: "/admin/recruiters", icon: UserPlus },
      { label: "Onboard Consultant", href: "/admin/students", icon: GraduationCap },
      { label: "Tech Support", href: "/admin/tech-support", icon: Briefcase },
      { label: "Leads", href: "/admin/leads", icon: Users },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Pre-Marketing", href: "/admin/premarketing", icon: Send },
      {
        label: "Submissions",
        href: "/admin/submissions/list",
        icon: FileText,
        children: [
          { label: "New Submission", href: "/admin/submissions", exact: true },
          { label: "All Submissions", href: "/admin/submissions/list" },
        ],
      },
      {
        label: "Interviews",
        href: "/admin/interviews/list",
        icon: Calendar,
        children: [
          { label: "New Interview", href: "/admin/interviews", exact: true },
          { label: "All Interviews", href: "/admin/interviews/list" },
        ],
      },
      { label: "Expenses", href: "/admin/expenses", icon: DollarSign },
    ],
  },
];

interface SidebarProps {
  allowedPaths: string[] | null;
  userEmail: string;
  userName: string | null;
  roleName: string | null;
}

export function Sidebar({ allowedPaths, userEmail, userName, roleName }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Submissions: true,
    Interviews: true,
  });

  useEffect(() => {
    setMounted(true);
    if (localStorage.getItem("gft-sidebar") === "collapsed") setCollapsed(true);
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("gft-sidebar", next ? "collapsed" : "expanded");
  };

  const allowed = (href: string) => {
    if (allowedPaths === null) return true;
    if (href === "/admin") return true;
    return allowedPaths.some(
      (p) => p !== "/admin" && (href === p || href.startsWith(p + "/"))
    );
  };

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  const initials = (userName ?? userEmail)
    .split(/[\s@]/)
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const displayName = userName || userEmail;

  return (
    <aside
      className={cn(
        "relative flex h-screen shrink-0 flex-col overflow-hidden",
        "border-r border-white/[0.05] bg-[#0C1020]",
        "transition-[width] duration-300 ease-in-out",
        mounted ? (collapsed ? "w-[66px]" : "w-[242px]") : "w-[242px]"
      )}
    >
      {/* ── Logo + collapse toggle ── */}
      <div className="flex h-[60px] shrink-0 items-center gap-2.5 border-b border-white/[0.05] px-3.5">
        <div className="shrink-0">
          <GFTMark size={30} />
        </div>

        <div
          className={cn(
            "flex-1 overflow-hidden transition-[opacity] duration-200",
            collapsed ? "opacity-0 pointer-events-none w-0" : "opacity-100"
          )}
        >
          <p className="whitespace-nowrap text-[14px] font-extrabold tracking-tight text-white">
            GFT<span className="text-indigo-400"> Vision</span>
          </p>
          <p className="whitespace-nowrap text-[9px] font-semibold tracking-[0.18em] uppercase text-slate-600">
            Staffing Platform
          </p>
        </div>

        <button
          onClick={toggleCollapse}
          className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-600 transition-all hover:bg-white/[0.08] hover:text-slate-300"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav className="sidebar-scroll flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
        {NAV.map((group, gi) => {
          const visible = group.items.filter((item) => allowed(item.href));
          if (!visible.length) return null;

          return (
            <div key={gi} className={gi > 0 ? "mt-1" : ""}>
              {/* Section label */}
              {group.label && !collapsed && (
                <div className="mb-1.5 mt-5 flex items-center gap-2 px-1.5">
                  <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">
                    {group.label}
                  </span>
                  <div className="h-px flex-1 bg-white/[0.05]" />
                </div>
              )}
              {group.label && collapsed && (
                <div className="my-3 mx-1 h-px bg-white/[0.05]" />
              )}

              <div className="space-y-px">
                {visible.map((item) => {
                  const { label, href, icon: Icon, exact, children } = item;
                  const hasChildren = !!children?.length;
                  const childActive = hasChildren
                    ? (children?.some((c) => isActive(c.href, c.exact)) ?? false)
                    : false;
                  const selfActive = !hasChildren && isActive(href, exact);
                  const anyActive = selfActive || childActive;
                  const isOpen = openGroups[label] !== false;

                  const rowBase = cn(
                    "group relative flex w-full items-center rounded-lg text-[13px] font-medium",
                    "transition-all duration-100 select-none",
                    collapsed
                      ? cn(
                          "justify-center p-2.5",
                          anyActive
                            ? "bg-indigo-500/15 text-white"
                            : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
                        )
                      : cn(
                          "gap-2.5 border-l-[3px] py-[7px] pl-[8px] pr-2.5",
                          anyActive
                            ? "border-indigo-500 bg-white/[0.07] text-slate-100"
                            : "border-transparent text-slate-400 hover:border-slate-700/60 hover:bg-white/[0.04] hover:text-slate-200"
                        )
                  );

                  const iconClass = cn(
                    "shrink-0 transition-colors duration-100",
                    collapsed ? "h-[18px] w-[18px]" : "h-[15px] w-[15px]",
                    anyActive
                      ? "text-indigo-400"
                      : "text-slate-500 group-hover:text-slate-400"
                  );

                  return (
                    <div key={href}>
                      {/* Parent row */}
                      {hasChildren && !collapsed ? (
                        <button
                          type="button"
                          onClick={() =>
                            setOpenGroups((p) => ({ ...p, [label]: !p[label] }))
                          }
                          className={rowBase}
                        >
                          <Icon className={iconClass} />
                          <span className="flex-1 truncate text-left">{label}</span>
                          <ChevronDown
                            className={cn(
                              "h-3 w-3 shrink-0 text-slate-600 transition-transform duration-200",
                              isOpen && "rotate-180"
                            )}
                          />
                        </button>
                      ) : (
                        <Link
                          href={href}
                          title={collapsed ? label : undefined}
                          className={rowBase}
                        >
                          <Icon className={iconClass} />
                          {!collapsed && (
                            <>
                              <span className="flex-1 truncate">{label}</span>
                              {anyActive && !hasChildren && (
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                              )}
                            </>
                          )}
                        </Link>
                      )}

                      {/* Child rows */}
                      {hasChildren && !collapsed && isOpen && (
                        <div className="mb-0.5 ml-[22px] mt-0.5 border-l border-white/[0.06] pl-3 space-y-px">
                          {children!
                            .filter((c) => allowed(c.href))
                            .map((child) => {
                              const cActive = isActive(child.href, child.exact);
                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  className={cn(
                                    "flex items-center gap-2 rounded-md px-2 py-[6px] text-[12px] transition-all duration-100",
                                    cActive
                                      ? "bg-indigo-500/10 font-semibold text-indigo-300"
                                      : "font-medium text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "h-[5px] w-[5px] shrink-0 rounded-full",
                                      cActive ? "bg-indigo-400" : "bg-slate-700"
                                    )}
                                  />
                                  {child.label}
                                </Link>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── User footer ── */}
      <div className="shrink-0 border-t border-white/[0.05] p-2">
        <div
          className={cn(
            "flex items-center rounded-xl bg-white/[0.03] p-2.5 ring-1 ring-inset ring-white/[0.04]",
            collapsed ? "justify-center" : "gap-2.5"
          )}
        >
          {/* Avatar */}
          <div className="relative shrink-0">
            <div
              className={cn(
                "flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 font-bold text-white shadow-lg shadow-indigo-950/60",
                collapsed ? "h-9 w-9 text-[12px]" : "h-8 w-8 text-[11px]"
              )}
            >
              {initials}
            </div>
            <span className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full bg-emerald-400 ring-[2.5px] ring-[#0C1020]" />
          </div>

          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold leading-tight text-slate-200">
                  {displayName}
                </p>
                <p className="mt-0.5 truncate text-[10px] leading-tight text-slate-500">
                  {roleName ?? "Super Admin"}
                </p>
              </div>
              <form action="/api/auth/logout" method="POST">
                <button
                  type="submit"
                  title="Sign out"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-rose-500/15 hover:text-rose-400"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </form>
            </>
          )}
        </div>

        {collapsed && (
          <form action="/api/auth/logout" method="POST" className="mt-1.5">
            <button
              type="submit"
              title="Sign out"
              className="flex w-full items-center justify-center rounded-lg py-1.5 text-slate-600 transition-colors hover:bg-rose-500/15 hover:text-rose-400"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </form>
        )}
      </div>
    </aside>
  );
}
