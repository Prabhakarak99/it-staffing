import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "@/lib/auth";
import { unscopedPrisma } from "@/lib/prisma";
import { PLATFORM_COMPANY_ID } from "./context";

/** The Super Admin console's own check: Company Admins also see every screen, so the flag decides */
export async function requirePlatform(): Promise<{ session: SessionPayload; response?: never } | { session?: never; response: NextResponse }> {
  const session = await getSession();
  if (!session) return { response: NextResponse.json({ error: "Your login has expired. Please sign in again." }, { status: 401 }) };
  if (!session.isPlatformAdmin) return { response: NextResponse.json({ error: "Only the Super Admin can do this" }, { status: 403 }) };
  return { session };
}

export interface CompanyRow {
  id: string;
  slug: string;
  code: string;
  name: string;
  kind: string;
  status: string;
  timezone: string;
  attendanceTimezone: string;
  disabledModules: string[];
  maxUsers: number | null;
  createdAt: string;
  users: number;
  activeUsers: number;
  consultants: number;
  submissionsThisMonth: number;
  aiResumesThisMonth: number;
  lastLogin: string | null;
  admins: { id: string; name: string; email: string; isActive: boolean }[];
}

const countBy = (rows: { companyId: string; _count: { _all: number } }[]) => new Map(rows.map((r) => [r.companyId, r._count._all]));

/** Every company with its usage, for the Super Admin console (platform company last) */
export async function listCompanies(): Promise<CompanyRow[]> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const db = unscopedPrisma;
  const [companies, users, activeUsers, consultants, subs, resumes, logins, admins] = await Promise.all([
    db.company.findMany({ orderBy: [{ kind: "asc" }, { name: "asc" }] }),
    db.user.groupBy({ by: ["companyId"], _count: { _all: true } }),
    db.user.groupBy({ by: ["companyId"], where: { isActive: true }, _count: { _all: true } }),
    db.student.groupBy({ by: ["companyId"], _count: { _all: true } }),
    db.submission.groupBy({ by: ["companyId"], where: { createdAt: { gte: monthStart } }, _count: { _all: true } }),
    db.tailoredResume.groupBy({ by: ["companyId"], where: { createdAt: { gte: monthStart } }, _count: { _all: true } }),
    db.activityLog.groupBy({ by: ["companyId"], where: { kind: "login" }, _max: { createdAt: true } }),
    db.user.findMany({ where: { roleId: null }, select: { id: true, companyId: true, firstName: true, lastName: true, email: true, isActive: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const [u, au, c, s, r] = [users, activeUsers, consultants, subs, resumes].map(countBy);
  const last = new Map(logins.map((l) => [l.companyId, l._max.createdAt]));
  return companies.map((co) => ({
    id: co.id,
    slug: co.slug,
    code: co.code,
    name: co.name,
    kind: co.kind,
    status: co.status,
    timezone: co.timezone,
    attendanceTimezone: co.attendanceTimezone,
    disabledModules: co.disabledModules,
    maxUsers: co.maxUsers,
    createdAt: co.createdAt.toISOString(),
    users: u.get(co.id) ?? 0,
    activeUsers: au.get(co.id) ?? 0,
    consultants: c.get(co.id) ?? 0,
    submissionsThisMonth: s.get(co.id) ?? 0,
    aiResumesThisMonth: r.get(co.id) ?? 0,
    lastLogin: last.get(co.id)?.toISOString() ?? null,
    admins: admins
      .filter((a) => a.companyId === co.id)
      .map((a) => ({ id: a.id, name: `${a.firstName} ${a.lastName}`.trim(), email: a.email, isActive: a.isActive })),
  })).sort((a, b) => Number(a.id === PLATFORM_COMPANY_ID) - Number(b.id === PLATFORM_COMPANY_ID));
}
