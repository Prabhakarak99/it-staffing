import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewScreen } from "@/lib/screen-access";
import { dateToKey, isDayKey, keyToDate } from "@/lib/attendance/dates";

export const PROFIT_SCREEN = { name: "Profit Sharing", path: "/admin/profit-sharing" };

/** API guard: signed in and allowed to open Profit Sharing (POC / CEO roles and Super Admin to start with) */
export async function profitSession() {
  const session = await getSession();
  if (!session) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!(await canViewScreen(session, PROFIT_SCREEN.path))) return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { session };
}

const fullName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`.replace(/\s+/g, " ").trim();

export interface SubmissionLookup {
  submissionRefId: string;
  submissionCode: string;
  consultantName: string;
  technology: string;
  clientName: string | null;
  implementationName: string | null;
  vendorCompany: string | null;
  rate: string | null;
  recruiterId: string;
  recruiterName: string;
  /** First number in the submission's rate text, as a starting bill rate */
  rateNumber: number | null;
  /** Newest first */
  interviews: { id: string; code: string; level: string; status: string; date: string }[];
  /** Set when this submission already has a record on this page */
  existingId: string | null;
}

const confirmationFor = async (submissionRefId: string) =>
  (await prisma.confirmation.findUnique({ where: { submissionRefId }, select: { id: true } }))?.id ?? null;

/** A submission by its "Sub-NNN" id (capitals and a missing "Sub-" don't matter), with its interviews */
export async function lookupSubmission(
  input: string,
  existingFor: (submissionRefId: string) => Promise<string | null> = confirmationFor,
): Promise<SubmissionLookup | null> {
  const typed = input.trim();
  if (!typed) return null;
  const codes = /^\d+$/.test(typed) ? [`Sub-${typed.padStart(3, "0")}`, `Sub-${typed}`] : [typed];
  const s = await prisma.submission.findFirst({
    where: { OR: codes.map((c) => ({ submissionId: { equals: c, mode: "insensitive" as const } })) },
    include: {
      consultant: { select: { firstName: true, lastName: true } },
      recruiter: { select: { firstName: true, lastName: true } },
      interviews: { orderBy: { interviewStartDate: "desc" }, select: { id: true, interviewId: true, interviewLevel: true, interviewStatus: true, interviewStartDate: true } },
    },
  });
  if (!s) return null;
  const rateNumber = Number(s.payRate?.match(/\d+(?:\.\d+)?/)?.[0]);
  return {
    submissionRefId: s.id,
    submissionCode: s.submissionId,
    consultantName: fullName(s.consultant),
    technology: s.technology,
    clientName: s.clientName,
    implementationName: s.implementationName,
    vendorCompany: s.vendorCompany,
    rate: s.payRate,
    recruiterId: s.recruiterId,
    recruiterName: fullName(s.recruiter),
    rateNumber: Number.isFinite(rateNumber) && rateNumber > 0 ? rateNumber : null,
    interviews: s.interviews.map((i) => ({ id: i.id, code: i.interviewId, level: i.interviewLevel, status: i.interviewStatus, date: i.interviewStartDate.toISOString() })),
    existingId: await existingFor(s.id),
  };
}

export interface ConfirmationRow {
  id: string;
  submissionCode: string;
  interviewCode: string | null;
  consultantName: string;
  clientName: string | null;
  implementationName: string | null;
  vendorCompany: string | null;
  rate: string | null;
  confirmationDate: string;
  startDate: string | null;
  endDate: string | null;
  createdBy: string;
  /** Incentive placements only */
  billRate?: number | null;
  recruiterName?: string | null;
}

export async function listConfirmations(): Promise<ConfirmationRow[]> {
  const rows = await prisma.confirmation.findMany({ orderBy: [{ confirmationDate: "desc" }, { createdAt: "desc" }] });
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.createdById))] } },
    select: { id: true, firstName: true, lastName: true },
  });
  const nameOf = new Map(users.map((u) => [u.id, fullName(u)]));
  return rows.map((r) => ({
    id: r.id,
    submissionCode: r.submissionCode,
    interviewCode: r.interviewCode,
    consultantName: r.consultantName,
    clientName: r.clientName,
    implementationName: r.implementationName,
    vendorCompany: r.vendorCompany,
    rate: r.rate,
    confirmationDate: dateToKey(r.confirmationDate),
    startDate: r.startDate ? dateToKey(r.startDate) : null,
    endDate: r.endDate ? dateToKey(r.endDate) : null,
    createdBy: nameOf.get(r.createdById) ?? "",
  }));
}

const text = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** The fields a person types: dates, rate and (optionally) corrected names */
export function parseConfirmation(body: Record<string, unknown>) {
  if (!isDayKey(body.confirmationDate)) return { error: "Confirmation date is required" } as const;
  const start = body.startDate ? body.startDate : null;
  const end = body.endDate ? body.endDate : null;
  if (start !== null && !isDayKey(start)) return { error: "Start date is not a valid date" } as const;
  if (end !== null && !isDayKey(end)) return { error: "End date is not a valid date" } as const;
  if (start && end && end < start) return { error: "End date can't be before the start date" } as const;
  return {
    data: {
      confirmationDate: keyToDate(body.confirmationDate),
      startDate: start ? keyToDate(start) : null,
      endDate: end ? keyToDate(end) : null,
      rate: text(body.rate, 100),
      clientName: text(body.clientName),
      implementationName: text(body.implementationName),
      vendorCompany: text(body.vendorCompany),
    },
  } as const;
}
