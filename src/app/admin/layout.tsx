import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TopNav } from "@/components/layout/topnav";

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

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <TopNav
        allowedPaths={allowedPaths}
        userEmail={session.email}
        userName={userName}
        roleName={session.roleName}
      />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
