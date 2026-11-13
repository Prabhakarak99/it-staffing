import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";
import { canApprove, reviewableBy } from "./access";
import { dateToKey } from "./dates";

export interface NotificationItem {
  id: string;
  kind: "attendance" | "leave";
  /** "pending" = waiting for this approver; otherwise the decision on the user's own request */
  state: "pending" | "approved" | "rejected";
  title: string;
  detail: string;
  at: string;
}

const name = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim();
const RECENT_MS = 3 * 86_400_000;

/** Bell contents: requests waiting for this approver, plus decisions on the user's own requests (last 3 days) */
export async function getNotifications(session: SessionPayload): Promise<{ items: NotificationItem[]; pendingCount: number }> {
  const since = new Date(Date.now() - RECENT_MS);
  const approver = canApprove(session);
  const others = reviewableBy(session);

  const [pendingAtt, pendingLeave, pendingAttCount, pendingLeaveCount, myAtt, myLeave] = await Promise.all([
    approver
      ? prisma.attendance.findMany({ where: { status: "pending", ...others }, include: { user: { select: { firstName: true, lastName: true } } }, orderBy: { markedAt: "desc" }, take: 8 })
      : [],
    approver
      ? prisma.leaveRequest.findMany({ where: { status: "pending", ...others }, include: { user: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" }, take: 8 })
      : [],
    approver ? prisma.attendance.count({ where: { status: "pending", ...others } }) : 0,
    approver ? prisma.leaveRequest.count({ where: { status: "pending", ...others } }) : 0,
    prisma.attendance.findMany({ where: { userId: session.userId, status: { in: ["approved", "rejected"] }, reviewedAt: { gte: since } }, orderBy: { reviewedAt: "desc" }, take: 5 }),
    prisma.leaveRequest.findMany({ where: { userId: session.userId, status: { in: ["approved", "rejected"] }, reviewedAt: { gte: since } }, orderBy: { reviewedAt: "desc" }, take: 5 }),
  ]);

  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const items: NotificationItem[] = [
    ...pendingAtt.map((a) => ({ id: a.id, kind: "attendance" as const, state: "pending" as const, title: `${name(a.user)} marked attendance`, detail: `For ${fmt(a.day)}`, at: a.markedAt.toISOString() })),
    ...pendingLeave.map((l) => ({
      id: l.id, kind: "leave" as const, state: "pending" as const, title: `${name(l.user)} requested leave`,
      detail: `${fmt(l.startDate)}${dateToKey(l.startDate) !== dateToKey(l.endDate) ? ` – ${fmt(l.endDate)}` : ""} · ${l.totalDays} day${l.totalDays === 1 ? "" : "s"}`,
      at: l.createdAt.toISOString(),
    })),
    ...myAtt.map((a) => ({ id: a.id, kind: "attendance" as const, state: a.status as "approved" | "rejected", title: `Attendance ${a.status}`, detail: `For ${fmt(a.day)}${a.reviewNote ? ` · ${a.reviewNote}` : ""}`, at: a.reviewedAt!.toISOString() })),
    ...myLeave.map((l) => ({ id: l.id, kind: "leave" as const, state: l.status as "approved" | "rejected", title: `Leave ${l.status}`, detail: `${fmt(l.startDate)} · ${l.totalDays} day${l.totalDays === 1 ? "" : "s"}${l.reviewNote ? ` · ${l.reviewNote}` : ""}`, at: l.reviewedAt!.toISOString() })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return { items, pendingCount: pendingAttCount + pendingLeaveCount };
}
