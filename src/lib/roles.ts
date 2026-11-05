import type { SessionPayload } from "@/lib/auth";
import { canManageUsers } from "@/lib/user-safe";

/** Roles whose name contains one of these act as managers, e.g. "Admin", "Manager", "POC" */
const MANAGER_ROLE = /admin|manager|poc/i;

/** Super Admin, anyone who can manage users, or an Admin / Manager / POC role */
export function isManager(session: Pick<SessionPayload, "allowedScreens" | "roleName">) {
  return canManageUsers(session) || (!!session.roleName && MANAGER_ROLE.test(session.roleName));
}
