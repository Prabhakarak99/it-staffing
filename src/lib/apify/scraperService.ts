import { saveJobs } from "@/lib/jobfeed/upsert";
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

// Board searches are already contract-only; explicit C2C/W2/1099 needs no AI, plain "Contract" does
const EXPLICIT_TYPES = ["C2C", "C2C/W2", "W2", "1099"];
function classifyBoardJob(job: ScrapedJob): ScrapedJob {
  return {
    ...job,
    sourceType: "board",
    employmentType: job.jobType,
    isContract: true,
    classifiedBy: EXPLICIT_TYPES.includes(job.jobType) ? "regex" : null,
  };
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

  const unique = deduplicateJobs(allJobs).map(classifyBoardJob);
  const res = await saveJobs(unique, { refreshExisting: true });
  const saved = res.created + res.updated;
  const skipped = res.duplicates + res.failed;

  return { total: unique.length, saved, skipped, errors, sources: sourceResults };
}
