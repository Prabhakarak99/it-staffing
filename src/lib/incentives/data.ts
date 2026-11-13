import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewScreen } from "@/lib/screen-access";
import { canManageUsers } from "@/lib/user-safe";
import { dateToKey } from "@/lib/attendance/dates";
import { isPocRole } from "@/lib/attendance/access";
import type { ConfirmationRow } from "@/lib/profit-sharing/data";
import { incentiveFor, type Incentive } from "./calc";

export const INCENTIVES_SCREEN = { name: "Incentives", path: "/admin/incentives" };

/** Recruiters' incentives are never shown to POC roles, whatever User Roles says */
export async function canOpenIncentives(session: SessionPayload) {
  return !isPocRole(session.roleName) && (await canViewScreen(session, INCENTIVES_SCREEN.path));
}

/** Super Admin, user admins and CEO / Admin / Manager roles see every recruiter's; recruiters only their own */
export const seesAllIncentives = (session: SessionPayload) =>
  !session.roleId || canManageUsers(session) || /ceo|admin|manager/i.test(session.roleName ?? "");

export async function incentiveSession() {
  const session = await getSession();
  if (!session) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!(await canOpenIncentives(session))) return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { session, all: seesAllIncentives(session) };
}

export const placementFor = async (submissionRefId: string) =>
  (await prisma.incentivePlacement.findUnique({ where: { submissionRefId }, select: { id: true } }))?.id ?? null;

const fullName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`.replace(/\s+/g, " ").trim();

async function placements(session: SessionPayload) {
  const rows = await prisma.incentivePlacement.findMany({
    where: seesAllIncentives(session) ? {} : { recruiterId: session.userId },
    orderBy: [{ confirmationDate: "desc" }, { createdAt: "desc" }],
  });
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(rows.flatMap((r) => [r.recruiterId, r.createdById]))] } },
    select: { id: true, firstName: true, lastName: true },
  });
  return { rows, nameOf: new Map(users.map((u) => [u.id, fullName(u)])) };
}

/** Placements this user may see, newest first */
export async function listPlacements(session: SessionPayload): Promise<ConfirmationRow[]> {
  const { rows, nameOf } = await placements(session);
  return rows.map((r) => ({
    id: r.id,
    submissionCode: r.submissionCode,
    interviewCode: r.interviewCode,
    consultantName: r.consultantName,
    clientName: r.clientName,
    implementationName: r.implementationName,
    vendorCompany: r.vendorCompany,
    rate: r.rate,
    billRate: r.billRate,
    recruiterName: nameOf.get(r.recruiterId) ?? "",
    confirmationDate: dateToKey(r.confirmationDate),
    startDate: r.startDate ? dateToKey(r.startDate) : null,
    endDate: r.endDate ? dateToKey(r.endDate) : null,
    createdBy: nameOf.get(r.createdById) ?? "",
  }));
}

export interface IncentiveRow extends Incentive {
  id: string;
  submissionCode: string;
  consultantName: string;
  clientName: string | null;
  recruiterName: string;
  billRate: number | null;
  startDate: string | null;
  endDate: string | null;
}

/** The Calculations board as of `today` (Central date) */
export async function incentiveBoard(session: SessionPayload, today: string): Promise<IncentiveRow[]> {
  const { rows, nameOf } = await placements(session);
  return rows
    .map((r) => {
      const startDate = r.startDate ? dateToKey(r.startDate) : null;
      const endDate = r.endDate ? dateToKey(r.endDate) : null;
      return {
        id: r.id,
        submissionCode: r.submissionCode,
        consultantName: r.consultantName,
        clientName: r.clientName,
        recruiterName: nameOf.get(r.recruiterId) ?? "",
        billRate: r.billRate,
        startDate,
        endDate,
        ...incentiveFor({ billRate: r.billRate, startDate, endDate }, today),
      };
    })
    .sort((a, b) => a.recruiterName.localeCompare(b.recruiterName) || a.consultantName.localeCompare(b.consultantName));
}

/** Bill rate in $/hr from the form: a positive number, or null when left empty */
export function parseBillRate(v: unknown): { billRate: number | null } | { error: string } {
  if (v === null || v === undefined || v === "") return { billRate: null };
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 1000) return { error: "Bill rate must be a number in $ per hour, e.g. 70" };
  return { billRate: Math.round(n * 100) / 100 };
}
