import type { SessionPayload } from "@/lib/auth";
import { isManager } from "@/lib/roles";

export const ATTENDANCE_SCREEN = { name: "Attendance", path: "/admin/attendance" };

/** Everyone with a role marks attendance (approvers too). The Super Admin account does not. */
export const marksAttendance = (session: SessionPayload) => !!session.roleId;

/** POC / Manager / Admin roles and Super Admin approve attendance and leave */
export const canApprove = (session: SessionPayload) => isManager(session);

/** Approvers can't approve their own requests; Super Admin (no role) never has any */
export const canReview = (session: SessionPayload, ownerId: string) => canApprove(session) && ownerId !== session.userId;
