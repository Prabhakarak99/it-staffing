import type { SessionPayload } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { canManageUsers } from "@/lib/user-safe";

export const ATTENDANCE_SCREEN = { name: "Attendance", path: "/admin/attendance" };

/** Everyone with a role marks attendance (approvers too). The Super Admin account does not. */
export const marksAttendance = (session: SessionPayload) => !!session.roleId;

/** POC / Manager / Admin roles and Super Admin approve attendance and leave */
export const canApprove = (session: SessionPayload) => isManager(session);

/** Super Admin: the account(s) with no role */
export const isSuperAdmin = (session: SessionPayload) => !session.roleId;

/** A POC's own attendance and leave are approved by Super Admins only */
export const isPocRole = (roleName: string | null | undefined) => !!roleName && /poc/i.test(roleName);

/**
 * Whose pending attendance / leave this approver may review (a Prisma filter for rows with a `user`):
 * never their own, and a POC's only when the approver is a Super Admin.
 */
export const reviewableBy = (session: SessionPayload) => ({
  userId: { not: session.userId },
  ...(isSuperAdmin(session)
    ? {}
    : { user: { OR: [{ roleId: null }, { role: { NOT: { name: { contains: "poc", mode: "insensitive" as const } } } }] } }),
});

/** Super Admin and anyone who can manage users can switch any day between present and absent */
export const canEditAttendance = (session: SessionPayload) => canManageUsers(session);
