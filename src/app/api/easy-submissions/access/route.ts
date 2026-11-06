import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/user-safe";
import { EASY_SCREEN } from "@/lib/easy/data";

/** Admin only: Super Admin or anyone who can manage users */
async function admin() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session)) return NextResponse.json({ error: "Only administrators can change access" }, { status: 403 });
  return null;
}

/** Every user with a role, whether their role includes Easy Submissions, and their on/off switch */
async function listAccess() {
  const users = await prisma.user.findMany({
    where: { roleId: { not: null } },
    select: {
      id: true, firstName: true, lastName: true, email: true, isActive: true, easySubmissionsEnabled: true,
      role: { select: { name: true, roleScreens: { where: { canView: true, screen: { path: EASY_SCREEN.path } }, select: { id: true } } } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  return users.map((u) => ({
    id: u.id,
    name: `${u.firstName} ${u.lastName}`.trim(),
    email: u.email,
    roleName: u.role?.name ?? null,
    roleHasScreen: (u.role?.roleScreens.length ?? 0) > 0,
    isActive: u.isActive,
    enabled: u.easySubmissionsEnabled,
  }));
}

export type EasyAccessRow = Awaited<ReturnType<typeof listAccess>>[number];

export async function GET() {
  const denied = await admin();
  if (denied) return denied;
  return NextResponse.json(await listAccess());
}

/** PATCH { userIds: string[], enabled: boolean } */
export async function PATCH(req: NextRequest) {
  const denied = await admin();
  if (denied) return denied;

  const { userIds, enabled } = (await req.json()) as { userIds?: unknown; enabled?: unknown };
  if (!Array.isArray(userIds) || userIds.length === 0 || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "Choose users and on / off" }, { status: 400 });
  }
  await prisma.user.updateMany({ where: { id: { in: userIds.map(String) } }, data: { easySubmissionsEnabled: enabled } });
  return NextResponse.json(await listAccess());
}
