import { getSession, type SessionPayload } from "@/lib/auth";
import { canViewScreen } from "@/lib/screen-access";
import { canManageUsers } from "@/lib/user-safe";

export const VENDOR_SCREEN = { name: "Vendor Management", path: "/admin/vendor-management" };

export type VendorAccess =
  | { ok: false; status: 401 | 403; error: string }
  | { ok: true; session: SessionPayload; isAdmin: boolean };

/** Anyone with the Vendor Management screen; admins also see and edit every recruiter's contacts. */
export async function getVendorAccess(): Promise<VendorAccess> {
  const session = await getSession();
  if (!session) return { ok: false, status: 401, error: "Unauthorized" };
  if (!(await canViewScreen(session, VENDOR_SCREEN.path))) return { ok: false, status: 403, error: "Forbidden" };
  return { ok: true, session, isAdmin: canManageUsers(session) };
}

/** Prisma `where` limiting rows to what this user may see */
export const ownedWhere = (access: Extract<VendorAccess, { ok: true }>) =>
  access.isAdmin ? {} : { ownerId: access.session.userId };
