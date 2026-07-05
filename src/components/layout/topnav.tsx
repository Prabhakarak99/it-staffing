"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Shield, Users, ChevronDown, Search, Bell, LogOut,
} from "lucide-react";
import { GFTMark } from "@/components/ui/logo";

/* ── Flat nav links (no dropdowns) ─────────────────────────────────────── */
const NAV_LINKS = [
  { label: "Dashboard",     href: "/admin",                    match: "/admin",               exact: true  },
  { label: "Consultants",   href: "/admin/students",           match: "/admin/students",      exact: false },
  { label: "Submissions",   href: "/admin/submissions/list",   match: "/admin/submissions",   exact: false },
  { label: "Interviews",    href: "/admin/interviews/list",    match: "/admin/interviews",    exact: false },
  { label: "Recruiters",    href: "/admin/recruiters",         match: "/admin/recruiters",    exact: false },
  { label: "Leads",         href: "/admin/leads",              match: "/admin/leads",         exact: false },
  { label: "Pre-Marketing", href: "/admin/premarketing",       match: "/admin/premarketing",  exact: false },
  { label: "Tech Support",   href: "/admin/tech-support",       match: "/admin/tech-support",    exact: false },
  { label: "Requirements",  href: "/admin/requirements",       match: "/admin/requirements",    exact: false },
  { label: "Expenses",      href: "/admin/expenses",           match: "/admin/expenses",        exact: false },
];

/* ── Administration dropdown (admin-only) ───────────────────────────────── */
interface AdminItem { label: string; href: string; icon: React.ComponentType<{ className?: string }>; desc: string; }
const ADMIN_ITEMS: AdminItem[] = [
  { label: "User Roles",   href: "/admin/userrole",     icon: Shield,   desc: "Role-based screen permissions" },
  { label: "Users",        href: "/admin/users",         icon: Users,    desc: "Create & manage system accounts" },
];

interface TopNavProps {
  allowedPaths: string[] | null;
  userEmail: string;
  userName: string | null;
  roleName: string | null;
}

export function TopNav({ allowedPaths, userEmail, userName, roleName }: TopNavProps) {
  const pathname = usePathname();
  const [adminOpen, setAdminOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setAdminOpen(false);
        setUserOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setAdminOpen(false); setUserOpen(false); }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const allowed = (match: string) => {
    if (allowedPaths === null) return true;
    if (match === "/admin") return true;
    return allowedPaths.some(
      (p) => p !== "/admin" && (match === p || match.startsWith(p + "/") || p.startsWith(match + "/"))
    );
  };

  const isActive = (match: string, exact?: boolean) =>
    exact ? pathname === match : pathname === match || pathname.startsWith(match + "/");

  const adminActive = ADMIN_ITEMS.some((i) => isActive(i.href, false));

  const initials = (userName ?? userEmail)
    .split(/[\s@]/).filter(Boolean).map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const displayName = userName || userEmail;

  return (
    <nav
      ref={navRef}
      className="relative z-50 flex h-[58px] shrink-0 items-center gap-1 border-b border-white/[0.06] bg-[#0A0F1E] px-4"
    >
      {/* ── Logo ── */}
      <Link href="/admin" className="mr-2 flex shrink-0 items-center gap-2">
        <GFTMark size={28} />
        <div className="hidden leading-none md:block">
          <p className="text-[13px] font-extrabold tracking-tight text-white">
            GFT<span className="text-indigo-400"> Vision</span>
          </p>
          <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-slate-600">
            Staffing
          </p>
        </div>
      </Link>

      <div className="mx-1 h-5 w-px shrink-0 bg-white/[0.07]" />

      {/* ── Flat nav links (scrollable strip, no visible scrollbar) ── */}
      <div className="no-scrollbar flex flex-1 items-center gap-0 overflow-x-auto px-1">
        {NAV_LINKS.filter((l) => allowed(l.match)).map((link) => {
          const active = isActive(link.match, link.exact);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-all duration-100",
                active
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-400 hover:bg-white/[0.08] hover:text-slate-100"
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      {/* ── Administration dropdown (outside overflow container so panel isn't clipped) ── */}
      {ADMIN_ITEMS.some((i) => allowed(i.href)) && (
        <div className="relative shrink-0">
          <button
            onClick={() => { setAdminOpen(!adminOpen); setUserOpen(false); }}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-all duration-100",
              adminActive || adminOpen
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-400 hover:bg-white/[0.08] hover:text-slate-100"
            )}
          >
            Administration
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-200",
                adminOpen ? "rotate-180 text-slate-500" : "text-slate-500"
              )}
            />
          </button>

          {adminOpen && (
            <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[240px] rounded-xl border border-white/[0.08] bg-[#111827] p-1.5 shadow-2xl shadow-black/50">
              {ADMIN_ITEMS.filter((i) => allowed(i.href)).map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setAdminOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg p-2.5 transition-all duration-100",
                      active
                        ? "bg-indigo-500/15 text-white"
                        : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                    )}
                  >
                    <div className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                      active ? "bg-indigo-500/25" : "bg-white/[0.06]"
                    )}>
                      <item.icon className={cn("h-3.5 w-3.5", active ? "text-indigo-300" : "text-slate-400")} />
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold leading-tight">{item.label}</p>
                      <p className="mt-0.5 text-[10px] leading-tight text-slate-500">{item.desc}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Right side ── */}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Search */}
        <button className="hidden items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[12px] text-slate-500 transition-colors hover:bg-white/[0.08] hover:text-slate-300 sm:flex">
          <Search className="h-3.5 w-3.5" />
          <span>Search…</span>
          <kbd className="hidden items-center rounded border border-white/[0.10] bg-white/[0.06] px-1.5 py-px text-[10px] text-slate-600 sm:inline-flex">
            ⌘K
          </kbd>
        </button>

        {/* Bell */}
        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/[0.08] hover:text-slate-300">
          <Bell className="h-4 w-4" />
        </button>

        <div className="h-5 w-px bg-white/[0.07]" />

        {/* User */}
        <div className="relative">
          <button
            onClick={() => { setUserOpen(!userOpen); setAdminOpen(false); }}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border px-2.5 py-1.5 transition-all",
              userOpen
                ? "border-white/[0.15] bg-white/[0.10]"
                : "border-white/[0.07] bg-white/[0.04] hover:bg-white/[0.08]"
            )}
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-[10px] font-bold text-white">
              {initials}
            </div>
            <div className="hidden text-left sm:block">
              <p className="max-w-[110px] truncate text-[11px] font-semibold leading-tight text-slate-200">
                {displayName}
              </p>
              <p className="text-[9px] leading-tight text-slate-500">{roleName ?? "Super Admin"}</p>
            </div>
            <ChevronDown className={cn(
              "h-3 w-3 text-slate-600 transition-transform duration-200",
              userOpen && "rotate-180"
            )} />
          </button>

          {userOpen && (
            <div className="absolute right-0 top-[calc(100%+6px)] w-[190px] rounded-xl border border-white/[0.08] bg-[#111827] p-1.5 shadow-2xl shadow-black/50">
              <div className="mb-1 border-b border-white/[0.06] px-2.5 pb-2.5 pt-2">
                <p className="truncate text-[12px] font-semibold text-slate-200">{displayName}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{roleName ?? "Super Admin"}</p>
              </div>
              <form action="/api/auth/logout" method="POST">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium text-slate-400 transition-colors hover:bg-rose-500/15 hover:text-rose-300"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
