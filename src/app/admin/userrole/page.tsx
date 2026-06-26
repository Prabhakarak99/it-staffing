export const dynamic = "force-dynamic";

import { Header } from "@/components/layout/header";
import { prisma } from "@/lib/prisma";
import { RoleScreenMatrix } from "./role-screen-matrix";

export default async function UserRolePage() {
  const [roles, screens, roleScreens] = await Promise.all([
    prisma.role.findMany({ orderBy: { name: "asc" } }),
    prisma.screen.findMany({ orderBy: { name: "asc" } }),
    prisma.roleScreen.findMany(),
  ]);

  const matrix: Record<string, Record<string, boolean>> = {};
  for (const role of roles) {
    matrix[role.id] = {};
    for (const screen of screens) {
      matrix[role.id][screen.id] = false;
    }
  }
  for (const rs of roleScreens) {
    if (matrix[rs.roleId]) {
      matrix[rs.roleId][rs.screenId] = rs.canView;
    }
  }

  return (
    <>
      <Header title="User Roles & Screen Access" />
      <div className="p-6">
        <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4">
          <p className="text-sm font-medium text-blue-800">
            Check the boxes to grant screen access to each role. Changes are saved immediately.
          </p>
        </div>
        <RoleScreenMatrix roles={roles} screens={screens} initialMatrix={matrix} />
      </div>
    </>
  );
}
