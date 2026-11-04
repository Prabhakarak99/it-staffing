import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";

/**
 * Whether this session's role can open a screen. Checked against the role's current grants, not the
 * list frozen into the session at sign-in, so a newly granted screen works without signing out.
 */
export async function canViewScreen(session: SessionPayload, path: string) {
  if (!session.roleId) return true; // Super Admin
  const grant = await prisma.roleScreen.findFirst({
    where: { roleId: session.roleId, canView: true, screen: { path } },
    select: { id: true },
  });
  return !!grant;
}
