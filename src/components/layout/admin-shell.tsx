"use client";

import { useState } from "react";
import { TopNav } from "./topnav";
import { Sidebar } from "./sidebar";

import { SIDEBAR_COOKIE } from "./sidebar-cookie";
import { AttendancePrompt } from "./attendance-prompt";
import { RequirementNotifier } from "./requirement-notifier";
import { ActivityTracker } from "./activity-tracker";
import { VENDOR_REQ_SCREEN } from "@/lib/requirements/constants";
import type { AttendancePromptData } from "@/lib/attendance/prompt";
import type { NotificationItem } from "@/lib/attendance/notifications";

interface AdminShellProps {
  allowedPaths: string[] | null;
  userEmail: string;
  userName: string | null;
  roleName: string | null;
  companyName: string;
  isPlatformAdmin: boolean;
  /** Super Admin's All companies view */
  allCompanies: boolean;
  initialCollapsed: boolean;
  attendancePrompt: AttendancePromptData | null;
  notifications: { items: NotificationItem[]; pendingCount: number };
  children: React.ReactNode;
}

export function AdminShell({ allowedPaths, userEmail, userName, roleName, companyName, isPlatformAdmin, allCompanies, initialCollapsed, attendancePrompt, notifications, children }: AdminShellProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Until today's attendance is marked, the app behind the popup can't be used
  const [promptOpen, setPromptOpen] = useState(!!attendancePrompt);
  const blocked = promptOpen && !!attendancePrompt;

  const toggle = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      const next = !collapsed;
      setCollapsed(next);
      document.cookie = `${SIDEBAR_COOKIE}=${next ? 1 : 0}; path=/; max-age=31536000; samesite=lax`;
    } else {
      setMobileOpen((o) => !o);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <div inert={blocked} aria-hidden={blocked || undefined} className="flex min-h-0 flex-1 flex-col">
      <TopNav userEmail={userEmail} userName={userName} roleName={roleName} companyName={companyName} isPlatformAdmin={isPlatformAdmin} onToggleSidebar={toggle} notifications={notifications} />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          allowedPaths={allowedPaths}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onNavigate={() => setMobileOpen(false)}
          isPlatformAdmin={isPlatformAdmin}
        />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          {allCompanies && (
            <div className="border-b border-emerald-200 bg-emerald-50 px-6 py-2 text-[12.5px] text-emerald-800">
              <b>All companies view:</b> lists and reports include every company. To add a record, pick one company in the switcher at the top.
            </div>
          )}
          {children}
        </main>
      </div>
      </div>
      <ActivityTracker />
      {blocked && <AttendancePrompt data={attendancePrompt} onDone={() => setPromptOpen(false)} />}
      {/* New vendor requirement popups, for everyone who can open Vendor Requirements */}
      {!blocked && (allowedPaths === null || allowedPaths.includes(VENDOR_REQ_SCREEN.path)) && <RequirementNotifier />}
    </div>
  );
}
