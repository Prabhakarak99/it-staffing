import { createHash } from "crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { ScrapedJob } from "@/lib/apify/types";

export interface SaveResult {
  created: number;
  updated: number;
  duplicates: number;
  failed: number;
}

const norm = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Same role posted on several sites (LinkedIn + the company's ATS, ...) collapses to one hash. */
export function dedupeHash(job: Pick<ScrapedJob, "title" | "companyName" | "vendorName" | "location">) {
  const key = `${norm(job.title)}|${norm(job.companyName ?? job.vendorName)}|${norm(job.location)}`;
  return createHash("sha1").update(key).digest("hex");
}

export async function findExistingJobIds(jobIds: string[]): Promise<Set<string>> {
  if (jobIds.length === 0) return new Set();
  const rows = await prisma.jobSearchResult.findMany({
    where: { jobId: { in: jobIds } },
    select: { jobId: true },
  });
  return new Set(rows.map((r) => r.jobId));
}

function createData(job: ScrapedJob, hash: string): Prisma.JobSearchResultCreateManyInput {
  return {
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
    rawData:          job.rawData as Prisma.InputJsonValue,
    isActive:         true,
    sourceType:       job.sourceType ?? "board",
    atsProvider:      job.atsProvider ?? null,
    atsCompanyId:     job.atsCompanyId ?? null,
    companyName:      job.companyName ?? null,
    employmentType:   job.employmentType ?? job.jobType,
    isContract:       job.isContract ?? true,
    classifiedBy:     job.classifiedBy ?? null,
    dedupeHash:       hash,
    lastSeenAt:       new Date(),
  };
}

/**
 * Save scraped jobs.
 * - New jobId whose title+company+location already exists under another source → counted as a
 *   duplicate; the existing row is just marked as seen.
 * - Existing jobId → marked seen. With `refreshExisting` (board scrapers) contact details,
 *   description, skills and rates are refreshed too, as the old Apify upsert did.
 */
export async function saveJobs(jobs: ScrapedJob[], opts: { refreshExisting?: boolean } = {}): Promise<SaveResult> {
  const result: SaveResult = { created: 0, updated: 0, duplicates: 0, failed: 0 };
  if (jobs.length === 0) return result;

  const now = new Date();
  const unique = [...new Map(jobs.map((j) => [j.jobId, j])).values()];
  const existing = await findExistingJobIds(unique.map((j) => j.jobId));

  // ── Existing rows ──
  const seen = unique.filter((j) => existing.has(j.jobId));
  if (opts.refreshExisting) {
    for (const job of seen) {
      try {
        await prisma.jobSearchResult.update({
          where: { jobId: job.jobId },
          data: {
            vendorEmail:      job.vendorEmail,
            vendorPhone:      job.vendorPhone,
            jobDescription:   job.jobDescription,
            technologies:     job.technologies,
            visaRequirements: job.visaRequirements,
            rateMin:          job.rateMin,
            rateMax:          job.rateMax,
            isActive:         true,
            lastSeenAt:       now,
          },
        });
        result.updated++;
      } catch {
        result.failed++;
      }
    }
  } else if (seen.length > 0) {
    const { count } = await prisma.jobSearchResult.updateMany({
      where: { jobId: { in: seen.map((j) => j.jobId) } },
      data: { isActive: true, lastSeenAt: now },
    });
    result.updated += count;
  }

  // ── New rows (minus cross-source duplicates) ──
  const fresh = unique.filter((j) => !existing.has(j.jobId)).map((j) => ({ job: j, hash: dedupeHash(j) }));
  if (fresh.length === 0) return result;

  const dupRows = await prisma.jobSearchResult.findMany({
    where: { dedupeHash: { in: fresh.map((f) => f.hash) }, isActive: true },
    select: { dedupeHash: true },
  });
  const dupHashes = new Set(dupRows.map((r) => r.dedupeHash));
  if (dupHashes.size > 0) {
    await prisma.jobSearchResult.updateMany({
      where: { dedupeHash: { in: [...dupHashes] as string[] }, isActive: true },
      data: { lastSeenAt: now },
    });
  }

  const toCreate: Prisma.JobSearchResultCreateManyInput[] = [];
  const batchHashes = new Set<string>();
  for (const { job, hash } of fresh) {
    if (dupHashes.has(hash) || batchHashes.has(hash)) {
      result.duplicates++;
      continue;
    }
    batchHashes.add(hash);
    toCreate.push(createData(job, hash));
  }

  const CHUNK = 200;
  for (let i = 0; i < toCreate.length; i += CHUNK) {
    const chunk = toCreate.slice(i, i + CHUNK);
    try {
      const { count } = await prisma.jobSearchResult.createMany({ data: chunk, skipDuplicates: true });
      result.created += count;
      result.failed += chunk.length - count;
    } catch (err) {
      console.error("[jobfeed] createMany failed:", err);
      result.failed += chunk.length;
    }
  }

  return result;
}
