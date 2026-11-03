import { getSession, type SessionPayload } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/user-safe";

export const VENDOR_SCREEN = { name: "Vendor Management", path: "/admin/vendor-management" };

export type VendorAccess =
  | { ok: false; status: 401 | 403; error: string }
  | { ok: true; session: SessionPayload; isAdmin: boolean };

/** Anyone with the Vendor Management screen; admins also see and edit every recruiter's contacts. */
export async function getVendorAccess(): Promise<VendorAccess> {
  const session = await getSession();
  if (!session) return { ok: false, status: 401, error: "Unauthorized" };
  // Checked against the role's current screens, not the list frozen into the session at sign-in
  if (session.roleId) {
    const grant = await prisma.roleScreen.findFirst({
      where: { roleId: session.roleId, canView: true, screen: { path: VENDOR_SCREEN.path } },
      select: { id: true },
    });
    if (!grant) return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true, session, isAdmin: canManageUsers(session) };
}

/** Prisma `where` limiting rows to what this user may see */
export const ownedWhere = (access: Extract<VendorAccess, { ok: true }>) =>
  access.isAdmin ? {} : { ownerId: access.session.userId };
