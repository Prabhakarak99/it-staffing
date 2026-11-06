import { prisma } from "@/lib/prisma";
import { VENDOR_SCREEN } from "@/lib/vendors/access";
import { MAILBOX_SCREEN } from "@/lib/gmail/access";
import { LEADS_SCREEN } from "@/lib/leads/access";
import { ATTENDANCE_SCREEN } from "@/lib/attendance/access";
import { EASY_SCREEN } from "@/lib/easy/data";
import { AI_SETTINGS_SCREEN } from "@/lib/ai/admin";

/**
 * Screens added after the initial seed. Created once at startup; on creation every role that can
 * already open `grantLike` gets access too, so admins only need User Roles to adjust it afterwards.
 */
const LATE_SCREENS = [
  { ...VENDOR_SCREEN, grantLike: "/admin/submissions" },
  { ...MAILBOX_SCREEN, grantLike: "/admin/submissions" },
  { ...EASY_SCREEN, grantLike: "/admin/submissions" },
  { ...AI_SETTINGS_SCREEN, grantLike: "/admin/users" },
];

export async function ensureScreens() {
  for (const { name, path, grantLike } of LATE_SCREENS) {
    if (await prisma.screen.findUnique({ where: { path } })) continue;
    const screen = await prisma.screen.create({ data: { name, path } });
    const roles = await prisma.roleScreen.findMany({
      where: { canView: true, screen: { path: grantLike } },
      select: { roleId: true },
    });
    if (roles.length > 0) {
      await prisma.roleScreen.createMany({
        data: roles.map((r) => ({ roleId: r.roleId, screenId: screen.id, canView: true })),
        skipDuplicates: true,
      });
    }
    console.log(`[screens] added "${name}" for ${roles.length} role(s)`);
  }
}

/** One-time grants. Each runs once (recorded in AppMigration), so later changes in User Roles stick. */
const SCREEN_GRANTS = [
  // Every role can add leads; each person sees only their own (src/lib/leads/access.ts)
  { id: "leads-open-to-all-roles", ...LEADS_SCREEN },
  // Everyone marks attendance and requests leave; approvals are by role name (src/lib/roles.ts)
  { id: "attendance-open-to-all-roles", ...ATTENDANCE_SCREEN },
];

export async function grantScreensOnce() {
  for (const { id, name, path } of SCREEN_GRANTS) {
    if (await prisma.appMigration.findUnique({ where: { id } })) continue;
    const screen = await prisma.screen.upsert({ where: { path }, create: { name, path }, update: {} });
    const roles = await prisma.role.findMany({ select: { id: true } });
    await prisma.$transaction([
      ...roles.map((r) =>
        prisma.roleScreen.upsert({
          where: { roleId_screenId: { roleId: r.id, screenId: screen.id } },
          create: { roleId: r.id, screenId: screen.id, canView: true },
          update: { canView: true },
        }),
      ),
      prisma.appMigration.create({ data: { id } }),
    ]);
    console.log(`[screens] granted "${name}" to all ${roles.length} role(s)`);
  }
}
