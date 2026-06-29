import { prisma } from "@/lib/prisma";
import { scrapeLinkedIn } from "./linkedinScraper";
import { scrapeIndeed } from "./indeedScraper";
import { scrapeGoogle } from "./googleScraper";
import type { ScrapedJob } from "./types";

export interface ScrapeResult {
  total: number;
  saved: number;
  skipped: number;
  errors: string[];
  sources: Record<string, number>;
}

async function runScraper(name: string, fn: () => Promise<ScrapedJob[]>): Promise<{ jobs: ScrapedJob[]; error?: string }> {
  try {
    const jobs = await fn();
    console.log(`[Scraper] ${name}: ${jobs.length} jobs`);
    return { jobs };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Scraper] ${name} failed:`, msg);
    return { jobs: [], error: `${name}: ${msg}` };
  }
}

function deduplicateJobs(jobs: ScrapedJob[]): ScrapedJob[] {
  const seen = new Map<string, ScrapedJob>();
  for (const job of jobs) {
    if (!seen.has(job.jobId)) seen.set(job.jobId, job);
  }
  return [...seen.values()];
}

export async function runAllScrapers(sources?: ("LinkedIn" | "Indeed" | "Google")[]): Promise<ScrapeResult> {
  const errors: string[] = [];
  const allJobs: ScrapedJob[] = [];
  const sourceResults: Record<string, number> = {};

  const toRun = sources ?? ["LinkedIn", "Indeed", "Google"];

  const scrapers: [string, () => Promise<ScrapedJob[]>][] = [
    ["LinkedIn", scrapeLinkedIn],
    ["Indeed",   scrapeIndeed],
    ["Google",   scrapeGoogle],
  ].filter(([name]) => toRun.includes(name as "LinkedIn" | "Indeed" | "Google")) as [string, () => Promise<ScrapedJob[]>][];

  const results = await Promise.allSettled(
    scrapers.map(([name, fn]) => runScraper(name, fn))
  );

  results.forEach((r, i) => {
    const name = scrapers[i][0];
    if (r.status === "fulfilled") {
      if (r.value.error) errors.push(r.value.error);
      sourceResults[name] = r.value.jobs.length;
      allJobs.push(...r.value.jobs);
    } else {
      errors.push(`${name}: ${r.reason}`);
      sourceResults[name] = 0;
    }
  });

  const unique = deduplicateJobs(allJobs);
  let saved = 0;
  let skipped = 0;

  for (const job of unique) {
    try {
      await prisma.jobSearchResult.upsert({
        where: { jobId: job.jobId },
        create: {
          jobId:            job.jobId,
          source:           job.source,
          title:            job.title,
          vendorName:       job.vendorName,
          vendorEmail:      job.vendorEmail,
          vendorPhone:      job.vendorPhone,
          location:         job.location,
          isRemote:         job.isRemote,
          jobDescription:   job.jobDescription,
          technology:       job.technology,
          technologies:     job.technologies,
          jobType:          job.jobType,
          visaRequirements: job.visaRequirements,
          clientName:       job.clientName,
          rateMin:          job.rateMin,
          rateMax:          job.rateMax,
          applyLink:        job.applyLink,
          datePosted:       job.datePosted,
          dateScraped:      new Date(),
          rawData:          job.rawData,
          isActive:         true,
        },
        update: {
          // Keep most fields fresh; don't overwrite dateScraped on old records
          vendorEmail:      job.vendorEmail,
          vendorPhone:      job.vendorPhone,
          jobDescription:   job.jobDescription,
          technologies:     job.technologies,
          visaRequirements: job.visaRequirements,
          rateMin:          job.rateMin,
          rateMax:          job.rateMax,
          isActive:         true,
        },
      });
      saved++;
    } catch {
      skipped++;
    }
  }

  return { total: unique.length, saved, skipped, errors, sources: sourceResults };
}
