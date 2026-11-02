import { prisma } from "@/lib/prisma";
import { isAiConfigured, pendingAiWhere } from "./ai";
import { getJobIngestConfig, isJobFeedRunning } from "./worker";

/** Everything the Sources page shows; dates serialised for the client. */
export async function getJobFeedOverview() {
  const [config, companies, bySourceType, pendingAi, aiClassified, aiErrors] = await Promise.all([
    getJobIngestConfig(),
    prisma.atsCompany.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
    prisma.jobSearchResult.groupBy({
      by: ["sourceType"],
      where: { isActive: true, isContract: true },
      _count: { _all: true },
    }),
    prisma.jobSearchResult.count({ where: pendingAiWhere() }),
    prisma.jobSearchResult.count({ where: { classifiedBy: "ai" } }),
    prisma.jobSearchResult.count({ where: { classifiedBy: "ai_error" } }),
  ]);

  const contractJobs: Record<string, number> = {};
  for (const g of bySourceType) contractJobs[g.sourceType] = g._count._all;

  return {
    config: {
      ...config,
      lastBoardScrapeAt: config.lastBoardScrapeAt?.toISOString() ?? null,
      aiBatchSubmittedAt: config.aiBatchSubmittedAt?.toISOString() ?? null,
      updatedAt: config.updatedAt.toISOString(),
    },
    companies: companies.map((c) => ({
      ...c,
      lastCrawledAt: c.lastCrawledAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    })),
    stats: { contractJobs, pendingAi, aiClassified, aiErrors },
    env: { aiConfigured: isAiConfigured(), apifyConfigured: !!process.env.APIFY_TOKEN },
    running: isJobFeedRunning(),
  };
}

export type JobFeedOverview = Awaited<ReturnType<typeof getJobFeedOverview>>;
