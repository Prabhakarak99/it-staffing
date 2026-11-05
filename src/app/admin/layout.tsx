import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/layout/admin-shell";
import { SIDEBAR_COOKIE } from "@/components/layout/sidebar-cookie";
import { getAttendancePrompt } from "@/lib/attendance/prompt";
import { getNotifications } from "@/lib/attendance/notifications";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Super Admin (no roleId) sees all screens
  let allowedPaths: string[] | null = null;

  if (session.roleId) {
    const roleScreens = await prisma.roleScreen.findMany({
      where: { roleId: session.roleId, canView: true },
      include: { screen: true },
    });
    allowedPaths = roleScreens.map((rs) => rs.screen.path);
  }

  // Display name for nav
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { firstName: true, lastName: true },
  });
  const userName = user ? `${user.firstName} ${user.lastName}`.trim() || null : null;

  const sidebarCollapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "1";
  const [attendancePrompt, notifications] = await Promise.all([
    getAttendancePrompt(session, user?.firstName ?? ""),
    getNotifications(session),
  ]);

  return (
    <AdminShell
      allowedPaths={allowedPaths}
      userEmail={session.email}
      userName={userName}
      roleName={session.roleName}
      initialCollapsed={sidebarCollapsed}
      attendancePrompt={attendancePrompt}
      notifications={notifications}
    >
      {children}
    </AdminShell>
  );
}
