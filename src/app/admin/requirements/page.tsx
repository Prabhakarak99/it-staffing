export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { RequirementsView } from "./requirements-view";

export default async function RequirementsPage() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [initialJobs, total, stats] = await Promise.all([
    prisma.jobSearchResult.findMany({
      where: { isActive: true },
      orderBy: { dateScraped: "desc" },
      take: 20,
      select: {
        id: true, jobId: true, title: true, technology: true, technologies: true,
        source: true, vendorName: true, vendorEmail: true, vendorPhone: true,
        location: true, isRemote: true, jobType: true, rateMin: true, rateMax: true,
        clientName: true, datePosted: true, dateScraped: true, applyLink: true,
        visaRequirements: true, jobDescription: true,
      },
    }),
    prisma.jobSearchResult.count({ where: { isActive: true } }),
    Promise.all([
      prisma.jobSearchResult.count({ where: { isActive: true, dateScraped: { gte: todayStart } } }),
      prisma.jobSearchResult.count({ where: { isActive: true, isRemote: true } }),
      prisma.jobSearchResult.count({ where: { isActive: true, jobType: { contains: "C2C" } } }),
      prisma.jobSearchResult.aggregate({ where: { isActive: true, rateMin: { not: null } }, _avg: { rateMin: true } }),
      prisma.jobSearchResult.findFirst({ where: { isActive: true }, orderBy: { dateScraped: "desc" }, select: { dateScraped: true } }),
    ]),
  ]);

  const [todayCount, remoteCount, c2cCount, avgRateAgg, lastJob] = stats;

  const serializedJobs = initialJobs.map((j) => ({
    ...j,
    datePosted: j.datePosted?.toISOString() ?? null,
    dateScraped: j.dateScraped.toISOString(),
  }));

  return (
    <RequirementsView
      initialJobs={serializedJobs}
      initialTotal={total}
      isApifyConfigured={!!process.env.APIFY_TOKEN}
      todayCount={todayCount}
      remoteCount={remoteCount}
      c2cCount={c2cCount}
      avgRate={avgRateAgg._avg.rateMin ? Math.round(avgRateAgg._avg.rateMin) : null}
      lastScraped={lastJob?.dateScraped?.toISOString() ?? null}
    />
  );
}
