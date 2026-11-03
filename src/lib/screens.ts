import { prisma } from "@/lib/prisma";
import { VENDOR_SCREEN } from "@/lib/vendors/access";

/**
 * Screens added after the initial seed. Created once at startup; on creation every role that can
 * already open `grantLike` gets access too, so admins only need User Roles to adjust it afterwards.
 */
const LATE_SCREENS = [{ ...VENDOR_SCREEN, grantLike: "/admin/submissions" }];

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
