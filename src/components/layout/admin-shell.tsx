"use client";

import { useState } from "react";
import { TopNav } from "./topnav";
import { Sidebar } from "./sidebar";

import { SIDEBAR_COOKIE } from "./sidebar-cookie";
import { AttendancePrompt } from "./attendance-prompt";
import type { AttendancePromptData } from "@/lib/attendance/prompt";
import type { NotificationItem } from "@/lib/attendance/notifications";

interface AdminShellProps {
  allowedPaths: string[] | null;
  userEmail: string;
  userName: string | null;
  roleName: string | null;
  initialCollapsed: boolean;
  attendancePrompt: AttendancePromptData | null;
  notifications: { items: NotificationItem[]; pendingCount: number };
  children: React.ReactNode;
}

export function AdminShell({ allowedPaths, userEmail, userName, roleName, initialCollapsed, attendancePrompt, notifications, children }: AdminShellProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

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
      <TopNav userEmail={userEmail} userName={userName} roleName={roleName} onToggleSidebar={toggle} notifications={notifications} />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          allowedPaths={allowedPaths}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onNavigate={() => setMobileOpen(false)}
        />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
      {attendancePrompt && <AttendancePrompt data={attendancePrompt} />}
    </div>
  );
}
