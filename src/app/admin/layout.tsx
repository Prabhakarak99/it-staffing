import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma, unscopedPrisma } from "@/lib/prisma";
import { allowedScreensFor } from "@/lib/tenant/session";
import { AdminShell } from "@/components/layout/admin-shell";
import { SIDEBAR_COOKIE } from "@/components/layout/sidebar-cookie";
import { getAttendancePrompt } from "@/lib/attendance/prompt";
import { getNotifications } from "@/lib/attendance/notifications";
import { easyDisabledFor } from "@/lib/easy/access";
import { EASY_SCREEN } from "@/lib/easy/data";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Company Admin / Super Admin (no roleId) sees all screens, except the ones the Super Admin switched
  // off for this company (the Super Admin always sees everything)
  const company = await unscopedPrisma.company.findUnique({ where: { id: session.companyId }, select: { disabledModules: true } });
  const disabled = session.isPlatformAdmin ? [] : (company?.disabledModules ?? []);
  let allowedPaths: string[] | null = await allowedScreensFor(null, disabled);

  if (session.roleId) {
    const roleScreens = await prisma.roleScreen.findMany({
      where: { roleId: session.roleId, canView: true },
      include: { screen: true },
    });
    allowedPaths = roleScreens.map((rs) => rs.screen.path).filter((p) => !disabled.includes(p));
    // Admins can switch Easy Submissions off for individual users
    if (await easyDisabledFor(session)) allowedPaths = allowedPaths.filter((p) => p !== EASY_SCREEN.path);
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
      companyName={session.companyName}
      isPlatformAdmin={!!session.isPlatformAdmin}
      allCompanies={!!session.allCompanies}
      initialCollapsed={sidebarCollapsed}
      attendancePrompt={attendancePrompt}
      notifications={notifications}
    >
      {children}
    </AdminShell>
  );
}
