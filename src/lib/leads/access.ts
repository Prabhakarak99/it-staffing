import type { SessionPayload } from "@/lib/auth";
import { isManager } from "@/lib/roles";

export const LEADS_SCREEN = { name: "Leads", path: "/admin/leads" };

/** Super Admin, anyone who can manage users, or an Admin / Manager / POC role */
export const canSeeAllLeads = (session: SessionPayload) => isManager(session);

/** Prisma `where` limiting leads to the ones this user may see */
export function leadScope(session: SessionPayload) {
  return canSeeAllLeads(session) ? {} : { createdById: session.userId };
}
