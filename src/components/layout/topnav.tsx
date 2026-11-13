"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronDown, Search, Bell, LogOut, Menu,
} from "lucide-react";
import { GFTMark } from "@/components/ui/logo";
import type { NotificationItem } from "@/lib/attendance/notifications";

interface TopNavProps {
  userEmail: string;
  userName: string | null;
  roleName: string | null;
  onToggleSidebar: () => void;
  notifications: { items: NotificationItem[]; pendingCount: number };
}

const STATE_STYLE = {
  pending: "bg-amber-400",
  approved: "bg-emerald-400",
  rejected: "bg-rose-400",
} as const;

export function TopNav({ userEmail, userName, roleName, onToggleSidebar, notifications }: TopNavProps) {
  const [userOpen, setUserOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setUserOpen(false);
        setBellOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setUserOpen(false);
        setBellOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const initials = (userName ?? userEmail)
    .split(/[\s@]/).filter(Boolean).map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const displayName = userName || userEmail;

  return (
    <nav
      ref={navRef}
      className="relative z-50 flex h-[64px] shrink-0 items-center gap-1 border-b border-white/[0.06] bg-[#0A0F1E] px-4"
    >
      <button
        onClick={onToggleSidebar}
        aria-label="Toggle menu"
        className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-slate-100"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* ── Logo ── */}
      <Link href="/admin" className="mr-2 flex shrink-0 items-center gap-2">
        <GFTMark size={32} />
        <div className="hidden leading-none md:block">
          <p className="text-[17px] font-extrabold tracking-tight text-white">
            GFT<span className="text-indigo-400"> Vision</span>
          </p>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-slate-600">
            Staffing
          </p>
        </div>
      </Link>

      <div className="flex-1" />

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
        <div className="relative">
          <button
            onClick={() => { setBellOpen((o) => !o); setUserOpen(false); }}
            aria-label="Notifications"
            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/[0.08] hover:text-slate-300"
          >
            <Bell className="h-4 w-4" />
            {notifications.pendingCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9.5px] font-bold text-white">
                {notifications.pendingCount > 99 ? "99+" : notifications.pendingCount}
              </span>
            )}
          </button>
          {bellOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                <p className="text-[13px] font-bold text-slate-900">Notifications</p>
                {notifications.pendingCount > 0 && (
                  <span className="text-[11px] font-semibold text-amber-600">{notifications.pendingCount} waiting for approval</span>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.items.length === 0 ? (
                  <p className="px-4 py-6 text-center text-[12px] text-slate-400">You&apos;re all caught up</p>
                ) : (
                  notifications.items.map((n) => (
                    <Link
                      key={`${n.kind}-${n.id}-${n.state}`}
                      href={n.kind === "placement" ? "/admin/incentives" : n.state === "pending" ? "/admin/attendance?tab=approvals" : "/admin/attendance"}
                      onClick={() => setBellOpen(false)}
                      className="flex gap-2.5 border-b border-slate-50 px-4 py-2.5 hover:bg-slate-50"
                    >
                      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", STATE_STYLE[n.state])} />
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-semibold text-slate-800">{n.title}</span>
                        <span className="block truncate text-[11.5px] text-slate-500">{n.detail}</span>
                      </span>
                    </Link>
                  ))
                )}
              </div>
              <Link href="/admin/attendance" onClick={() => setBellOpen(false)} className="block border-t border-slate-100 px-4 py-2 text-center text-[12px] font-semibold text-indigo-600 hover:bg-indigo-50">
                Open Attendance
              </Link>
            </div>
          )}
        </div>

        <div className="h-5 w-px bg-white/[0.07]" />

        {/* User */}
        <div className="relative">
          <button
            onClick={() => setUserOpen(!userOpen)}
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
