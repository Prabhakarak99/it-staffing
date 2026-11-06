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

const fullName = (p: { firstName: string; lastName: string }) =>
  `${p.firstName} ${p.lastName}`.replace(/\s+/g, " ").trim();

/**
 * GET /api/reports?type=submissions|interviews&from=ISO&to=ISO
 * Counts per (recruiter, consultant, technology) in [from, to).
 * The client computes from/to in the viewer's local timezone.
 * Interviews only count once their start time has passed ("done").
 * Submission reports also return every In-Market consultant and every recruiter, for the zero rows.
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
  const entries: { recruiter: { id: string; firstName: string; lastName: string };
    consultant: { id: string; firstName: string; lastName: string }; technology: string }[] = [];

  if (type === "submissions") {
    const submissions = await prisma.submission.findMany({
      where: { submissionDate: { gte: from, lt: to } },
      select: { technology: true, recruiter: person, consultant: person },
    });
    entries.push(...submissions);
  } else {
    const interviews = await prisma.interview.findMany({
      where: {
        AND: [
          { interviewStartDate: { gte: from, lt: to } },
          { interviewStartDate: { lte: new Date() } },
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
      where: { projectStatus: { in: MARKETING_STATUSES } },
      select: {
        id: true, firstName: true, lastName: true, technology: true,
        preMarketings: { select: { recruiter: person }, take: 1 },
        submissions: { select: { technology: true, submissionDate: true }, orderBy: { submissionDate: "desc" }, take: 1 },
      },
    }),
    prisma.user.findMany({ where: { role: { name: "Recruiter" } }, select: { id: true, firstName: true, lastName: true } }),
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
