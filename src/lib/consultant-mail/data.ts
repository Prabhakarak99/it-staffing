import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewScreen } from "@/lib/screen-access";
import { consultantScope } from "@/lib/resumes/data";

export const CONSULTANT_MAIL_SCREEN = { name: "Consultant Email Configuration", path: "/admin/consultant-emails" };

type Access = { ok: false; response: NextResponse } | { ok: true; session: SessionPayload };

/** Signed in, can open the tab, and (with a consultant id) that consultant is assigned to them (managers: any) */
export async function consultantMailAccess(consultantId?: string): Promise<Access> {
  const session = await getSession();
  if (!session) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!(await canViewScreen(session, CONSULTANT_MAIL_SCREEN.path))) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (consultantId) {
    const found = await prisma.student.findFirst({ where: { id: consultantId, ...consultantScope(session) }, select: { id: true } });
    if (!found) return { ok: false, response: NextResponse.json({ error: "Consultant not found" }, { status: 404 }) };
  }
  return { ok: true, session };
}

const fullName = (u: { firstName: string; lastName: string } | null | undefined) => (u ? `${u.firstName} ${u.lastName}`.trim() : null);

/** The recruiter's consultants (managers: all) with their marketing email and connected mailbox */
export async function listConsultantMailboxes(session: SessionPayload) {
  const rows = await prisma.student.findMany({
    where: consultantScope(session),
    select: {
      id: true, firstName: true, lastName: true, email: true, technology: true, projectStatus: true,
      preMarketings: { select: { marketingEmail: true, recruiter: { select: { firstName: true, lastName: true } } }, take: 1 },
      mailbox: {
        select: { email: true, connectedAt: true, lastError: true, reqScanAt: true, connectedBy: { select: { firstName: true, lastName: true } } },
      },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  return rows.map((s) => ({
    id: s.id,
    name: `${s.firstName} ${s.lastName}`.trim(),
    technology: s.technology,
    status: s.projectStatus,
    recruiterName: fullName(s.preMarketings[0]?.recruiter),
    /** The address to sign in with: the marketing email, else their personal one */
    marketingEmail: s.preMarketings[0]?.marketingEmail?.trim() || null,
    personalEmail: s.email,
    mailbox: s.mailbox
      ? {
          email: s.mailbox.email,
          connectedAt: s.mailbox.connectedAt.toISOString(),
          connectedBy: fullName(s.mailbox.connectedBy),
          lastError: s.mailbox.lastError,
          scannedAt: s.mailbox.reqScanAt?.toISOString() ?? null,
        }
      : null,
  }));
}

export type ConsultantMailboxRow = Awaited<ReturnType<typeof listConsultantMailboxes>>[number];
