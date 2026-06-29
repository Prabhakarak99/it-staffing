import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - 7);

  const [total, todayCount, remoteCount, c2cCount, lastJob, avgRateResult, sourceCounts] = await Promise.all([
    prisma.jobSearchResult.count({ where: { isActive: true } }),
    prisma.jobSearchResult.count({ where: { isActive: true, dateScraped: { gte: todayStart } } }),
    prisma.jobSearchResult.count({ where: { isActive: true, isRemote: true } }),
    prisma.jobSearchResult.count({ where: { isActive: true, jobType: { contains: "C2C" } } }),
    prisma.jobSearchResult.findFirst({ where: { isActive: true }, orderBy: { dateScraped: "desc" }, select: { dateScraped: true } }),
    prisma.jobSearchResult.aggregate({ where: { isActive: true, rateMin: { not: null } }, _avg: { rateMin: true } }),
    prisma.jobSearchResult.groupBy({ by: ["source"], where: { isActive: true }, _count: { _all: true } }),
  ]);

  const sources: Record<string, number> = {};
  for (const s of sourceCounts) sources[s.source] = s._count._all;

  return NextResponse.json({
    total,
    todayCount,
    remoteCount,
    c2cCount,
    avgRate: avgRateResult._avg.rateMin ? Math.round(avgRateResult._avg.rateMin) : null,
    lastScraped: lastJob?.dateScraped ?? null,
    sources,
  });
}
