import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { MARKETING_STATUSES } from "@/lib/easy/data";

export interface ReportRow {
  recruiterId: string;
  recruiterName: string;
  consultantId: string;
  consultantName: string;
  technology: string;
  count: number;
}

/** In-Market consultant, so the reports can list the ones with zero submissions */
export interface MarketConsultant {
  id: string;
  name: string;
  technology: string;
  recruiterId: string | null;
  recruiterName: string;
  lastSubmittedAt: string | null;
}

export interface ReportRecruiter {
  id: string;
  name: string;
}

/** Consultant statuses that mean they have left */
const EXIT_STATUSES = ["Exit", "ProjectCompleted-Exit"];

/** Employees who have left: deactivated, or their end date has passed */
/**
 * Employees still with us: active, and no end date or one in the future. Written as positive
 * conditions on purpose: SQL's NOT(...) over an empty end date is "unknown", which drops the row.
 */
const activeUser = (now: Date) => ({ isActive: true, OR: [{ endDate: null }, { endDate: { gt: now } }] });
/** Consultants who have left */
/** Consultants still with us: no status yet, or any status other than an exit */
const activeConsultant = { OR: [{ projectStatus: null }, { projectStatus: { notIn: EXIT_STATUSES } }] };

const fullName = (p: { firstName: string; lastName: string }) =>
  `${p.firstName} ${p.lastName}`.replace(/\s+/g, " ").trim();

/**
 * GET /api/reports?type=submissions|interviews&from=ISO&to=ISO
 * Counts per (recruiter, consultant, technology) in [from, to).
 * The client sends from/to as Central-time day boundaries.
 * Interviews only count once their start time has passed ("done").
 * Submission reports also return every In-Market consultant and every recruiter, for the zero rows.
 * Exited employees and exited consultants are left out everywhere.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.allowedScreens && !session.allowedScreens.includes("/admin/reports")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type");
  const from = new Date(searchParams.get("from") ?? "");
  const to = new Date(searchParams.get("to") ?? "");

  if (type !== "submissions" && type !== "interviews") {
    return NextResponse.json({ error: "type must be submissions or interviews" }, { status: 400 });
  }
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    return NextResponse.json({ error: "Valid from/to dates are required" }, { status: 400 });
  }

  const person = { select: { id: true, firstName: true, lastName: true } };
  const now = new Date();
  const active = { recruiter: activeUser(now), consultant: activeConsultant };
  const entries: { recruiter: { id: string; firstName: string; lastName: string };
    consultant: { id: string; firstName: string; lastName: string }; technology: string }[] = [];

  if (type === "submissions") {
    const submissions = await prisma.submission.findMany({
      where: { submissionDate: { gte: from, lt: to }, ...active },
      select: { technology: true, recruiter: person, consultant: person },
    });
    entries.push(...submissions);
  } else {
    const interviews = await prisma.interview.findMany({
      where: {
        AND: [
          { interviewStartDate: { gte: from, lt: to } },
          { interviewStartDate: { lte: now } },
          { recruiter: active.recruiter },
          { submission: { consultant: active.consultant } },
        ],
      },
      select: {
        recruiter: person,
        submission: { select: { technology: true, consultant: person } },
      },
    });
    entries.push(
      ...interviews.map((iv) => ({
        recruiter: iv.recruiter,
        consultant: iv.submission.consultant,
        technology: iv.submission.technology,
      }))
    );
  }

  const rows = new Map<string, ReportRow>();
  for (const e of entries) {
    const technology = e.technology?.trim() || "—";
    const key = `${e.recruiter.id}|${e.consultant.id}|${technology.toLowerCase()}`;
    const row = rows.get(key);
    if (row) {
      row.count += 1;
    } else {
      rows.set(key, {
        recruiterId: e.recruiter.id,
        recruiterName: fullName(e.recruiter),
        consultantId: e.consultant.id,
        consultantName: fullName(e.consultant),
        technology,
        count: 1,
      });
    }
  }

  if (type === "interviews") return NextResponse.json({ type, from, to, rows: [...rows.values()] });

  const [students, recruiters] = await Promise.all([
    prisma.student.findMany({
      where: { projectStatus: { in: MARKETING_STATUSES.filter((st) => !EXIT_STATUSES.includes(st)) } },
      select: {
        id: true, firstName: true, lastName: true, technology: true,
        // Only an active recruiter counts as assigned
        preMarketings: { where: { recruiter: activeUser(now) }, select: { recruiter: person }, take: 1 },
        submissions: { select: { technology: true, submissionDate: true }, orderBy: { submissionDate: "desc" }, take: 1 },
      },
    }),
    prisma.user.findMany({ where: { role: { name: "Recruiter" }, ...activeUser(now) }, select: { id: true, firstName: true, lastName: true } }),
  ]);

  const consultants: MarketConsultant[] = students.map((s) => {
    const recruiter = s.preMarketings[0]?.recruiter;
    const last = s.submissions[0];
    return {
      id: s.id,
      name: fullName(s),
      technology: s.technology?.trim() || last?.technology?.trim() || "—",
      recruiterId: recruiter?.id ?? null,
      recruiterName: recruiter ? fullName(recruiter) : "—",
      lastSubmittedAt: last?.submissionDate.toISOString() ?? null,
    };
  });

  return NextResponse.json({
    type, from, to,
    rows: [...rows.values()],
    consultants,
    recruiters: recruiters.map((r): ReportRecruiter => ({ id: r.id, name: fullName(r) })),
  });
}
