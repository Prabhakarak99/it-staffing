import { prisma } from "@/lib/prisma";
import { runAllScrapers } from "@/lib/apify/scraperService";
import { crawlCompany } from "./ats";
import { runAiStep } from "./ai";

// ATS jobs not seen for this long are closed; non-contract markers are deleted after the longer window
const STALE_DAYS = 3;
const PURGE_FULLTIME_DAYS = 14;

export async function getJobIngestConfig() {
  return prisma.jobIngestConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
}

type Config = Awaited<ReturnType<typeof getJobIngestConfig>>;

async function crawlDueCompanies(config: Config, force: boolean) {
  const cutoff = new Date(Date.now() - config.crawlIntervalMin * 60_000);
  const companies = await prisma.atsCompany.findMany({
    where: {
      isActive: true,
      ...(force ? {} : { OR: [{ lastCrawledAt: null }, { lastCrawledAt: { lt: cutoff } }] }),
    },
    orderBy: { lastCrawledAt: { sort: "asc", nulls: "first" } },
    take: config.maxCompaniesPerCycle,
  });

  // One company at a time keeps the request rate polite for every career site
  for (const company of companies) {
    try {
      const res = await crawlCompany(company);
      await prisma.atsCompany.update({
        where: { id: company.id },
        data: { lastCrawledAt: new Date(), lastJobCount: res.inScope, lastNewCount: res.created, lastError: null },
      });
    } catch (err) {
      await prisma.atsCompany.update({
        where: { id: company.id },
        data: { lastCrawledAt: new Date(), lastError: (err instanceof Error ? err.message : String(err)).slice(0, 500) },
      });
    }
  }
}

async function scrapeBoardsIfDue(config: Config, force: boolean) {
  if (!config.boardScrapeEnabled || !process.env.APIFY_TOKEN) return;
  const due = !config.lastBoardScrapeAt || Date.now() - config.lastBoardScrapeAt.getTime() >= config.boardScrapeHours * 3_600_000;
  if (!due && !force) return;
  // Stamp first so a failing actor isn't retried (and billed) every tick
  await prisma.jobIngestConfig.update({ where: { id: "singleton" }, data: { lastBoardScrapeAt: new Date() } });
  const res = await runAllScrapers();
  console.log(`[jobfeed] boards: ${res.saved} saved, ${res.skipped} skipped${res.errors.length ? `, errors: ${res.errors.join("; ")}` : ""}`);
}

async function expireStaleJobs() {
  const now = Date.now();
  await prisma.jobSearchResult.updateMany({
    where: { sourceType: "ats", isActive: true, lastSeenAt: { lt: new Date(now - STALE_DAYS * 86_400_000) } },
    data: { isActive: false },
  });
  await prisma.jobSearchResult.deleteMany({
    where: { sourceType: "ats", isContract: false, lastSeenAt: { lt: new Date(now - PURGE_FULLTIME_DAYS * 86_400_000) } },
  });
}

let running = false;

export function isJobFeedRunning() {
  return running;
}

/**
 * One worker cycle (every 5 min from instrumentation; `force` = the "Run now" button):
 * crawl due company boards → Apify boards if due → AI batch step → expire stale jobs.
 */
export async function processJobFeed(opts: { force?: boolean } = {}) {
  if (running) return;
  running = true;
  const force = !!opts.force;
  try {
    const config = await getJobIngestConfig();
    if (config.paused && !force) return;

    await crawlDueCompanies(config, force);
    await scrapeBoardsIfDue(config, force);
    if (config.aiEnabled) {
      // Re-read: the crawl may take minutes and the batch id is written by runAiStep itself
      await runAiStep(await getJobIngestConfig());
    }
    await expireStaleJobs();
  } catch (err) {
    console.error("[jobfeed] worker cycle failed:", err);
  } finally {
    running = false;
  }
}
