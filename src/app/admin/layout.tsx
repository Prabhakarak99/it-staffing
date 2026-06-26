import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/layout/sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Super Admin (no roleId) sees all screens — pass null to show everything
  let allowedPaths: string[] | null = null;

  if (session.roleId) {
    const roleScreens = await prisma.roleScreen.findMany({
      where: { roleId: session.roleId, canView: true },
      include: { screen: true },
    });
    allowedPaths = roleScreens.map((rs) => rs.screen.path);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar
        allowedPaths={allowedPaths}
        userEmail={session.email}
        roleName={session.roleName}
      />
      <main className="flex flex-1 flex-col overflow-y-auto">{children}</main>
    </div>
  );
}
