import type { SessionPayload } from "@/lib/auth";
import { canManageUsers } from "@/lib/user-safe";

export const LEADS_SCREEN = { name: "Leads", path: "/admin/leads" };

/** Roles whose name contains one of these see every lead, e.g. "Admin", "Manager", "POC" */
const SEE_ALL_ROLE = /admin|manager|poc/i;

/** Super Admin, anyone who can manage users, or an Admin / Manager / POC role */
export function canSeeAllLeads(session: SessionPayload) {
  return canManageUsers(session) || (!!session.roleName && SEE_ALL_ROLE.test(session.roleName));
}

/** Prisma `where` limiting leads to the ones this user may see */
export function leadScope(session: SessionPayload) {
  return canSeeAllLeads(session) ? {} : { createdById: session.userId };
}
