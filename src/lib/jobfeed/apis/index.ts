import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/gmail/crypto";
import type { ScrapedJob } from "@/lib/apify/types";
import {
  extractClientName, extractEmail, extractPhone, extractPrimaryTechnology,
  extractRate, extractTechnologies, extractVisaRequirements, detectRemote,
} from "@/lib/apify/parserService";
import { classifyByRules, isUsLocation } from "../rules";
import { findExistingJobIds, saveJobs } from "../upsert";
import { DEFAULT_KEYWORDS, JOB_APIS, JOB_API_IDS, type JobApiId, type JobApiRow } from "./catalog";
import type { ApiJob, JobApiConnector } from "./types";
import { fantastic } from "./fantastic";
import { coresignal } from "./coresignal";
import { sourcestack } from "./sourcestack";
import { aspen } from "./aspen";
import { jobfront } from "./jobfront";
import { zyte } from "./zyte";

const CONNECTORS: Record<JobApiId, JobApiConnector> = { fantastic, coresignal, sourcestack, aspen, jobfront, zyte };

const mask = (key: string) => (key.length <= 8 ? "••••" : `${key.slice(0, 4)}••••${key.slice(-4)}`);
const list = (s: string) => s.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean);
const jobIdOf = (id: JobApiId, externalId: string) => `${id}_${externalId}`;

/** Settings and status for all six providers (a provider nobody configured yet gets its defaults) */
export async function listJobApis(): Promise<JobApiRow[]> {
  const rows = new Map((await prisma.jobApiSource.findMany()).map((r) => [r.id, r]));
  return JOB_API_IDS.map((id) => {
    const r = rows.get(id);
    let keyPreview: string | null = null;
    try {
      if (r?.apiKeyEnc) keyPreview = mask(decrypt(r.apiKeyEnc));
    } catch {}
    return {
      id,
      hasKey: !!r?.apiKeyEnc,
      keyPreview,
      isEnabled: r?.isEnabled ?? false,
      intervalMin: r?.intervalMin ?? JOB_APIS[id].defaultIntervalMin,
      maxPerRun: r?.maxPerRun ?? 100,
      keywords: r ? list(r.keywords) : DEFAULT_KEYWORDS,
      contractOnly: r?.contractOnly ?? true,
      extraParams: r?.extraParams ?? "",
      startUrls: r ? list(r.startUrls) : [],
      lastRunAt: r?.lastRunAt?.toISOString() ?? null,
      lastError: r?.lastError ?? null,
      lastFetched: r?.lastFetched ?? 0,
      lastNew: r?.lastNew ?? 0,
      totalNew: r?.totalNew ?? 0,
      lastTestedAt: r?.lastTestedAt?.toISOString() ?? null,
      lastTestError: r?.lastTestError ?? null,
    };
  });
}

/** Our stored job from a provider's job, classified by the same rules as company-site jobs */
function toScrapedJob(id: JobApiId, job: ApiJob): ScrapedJob {
  const title = job.title?.trim() ?? "";
  const text = `${title}\n${job.description}`;
  const usable = !!title && isUsLocation(job.location);
  const rules = usable
    ? classifyByRules(title, job.description, job.employmentHint)
    : { jobType: "Full-time", employmentType: "Out of scope", isContract: false, classifiedBy: "regex" as const };
  const rate = extractRate(text);
  // Full-time and out-of-scope jobs stay only as bare markers, so pay-per-job providers aren't asked for them again
  const keep = rules.jobType !== "Full-time";
  return {
    jobId: jobIdOf(id, job.externalId),
    source: JOB_APIS[id].name,
    title: title || null,
    vendorName: job.company,
    vendorEmail: keep ? extractEmail(job.description) : null,
    vendorPhone: keep ? extractPhone(job.description) : null,
    location: job.location,
    isRemote: job.isRemote ?? detectRemote(text, job.location),
    jobDescription: keep ? job.description || null : null,
    technology: extractPrimaryTechnology(text),
    technologies: extractTechnologies(text),
    jobType: rules.jobType,
    visaRequirements: extractVisaRequirements(text),
    clientName: keep ? extractClientName(job.description) : null,
    rateMin: rate.min,
    rateMax: rate.max,
    applyLink: job.applyUrl,
    datePosted: job.postedAt,
    rawData: keep ? { employmentHint: job.employmentHint, ...(job.raw ?? {}) } : {},
    sourceType: "api",
    atsProvider: id,
    companyName: job.company,
    employmentType: rules.employmentType,
    isContract: rules.isContract,
    classifiedBy: rules.classifiedBy,
  };
}

type Row = NonNullable<Awaited<ReturnType<typeof prisma.jobApiSource.findUnique>>>;

function fetchFrom(id: JobApiId, row: Row, opts: { maxJobs: number; since: Date }) {
  if (!row.apiKeyEnc) throw new Error("Add the API key first");
  return CONNECTORS[id]({
    apiKey: decrypt(row.apiKeyEnc),
    keywords: list(row.keywords).length ? list(row.keywords) : DEFAULT_KEYWORDS,
    contractOnly: row.contractOnly,
    maxJobs: opts.maxJobs,
    sinceHours: Math.max(1, Math.ceil((Date.now() - opts.since.getTime()) / 3_600_000)),
    since: opts.since,
    extra: Object.fromEntries(new URLSearchParams(row.extraParams.trim().replace(/^\?/, "").replace(/\n+/g, "&"))),
    startUrls: list(row.startUrls).filter((u) => /^https:\/\//i.test(u)),
    isKnown: async (externalIds) => {
      const have = await findExistingJobIds(externalIds.map((x) => jobIdOf(id, x)));
      return new Set(externalIds.filter((x) => have.has(jobIdOf(id, x))));
    },
  });
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 400);

/** "Test": a tiny real request (up to 3 jobs, nothing saved) to prove the key and the format work */
export async function testJobApi(id: JobApiId) {
  const row = await prisma.jobApiSource.findUnique({ where: { id } });
  if (!row) return { ok: false, error: "Add the API key first", sample: [] as string[] };
  let error: string | null = null;
  let sample: string[] = [];
  try {
    const jobs = await fetchFrom(id, row, { maxJobs: 3, since: new Date(Date.now() - 7 * 86_400_000) });
    sample = jobs.slice(0, 3).map((j) => [j.title ?? "(no title)", j.company, j.location].filter(Boolean).join(" · "));
    if (jobs.length > 0 && jobs.every((j) => !j.title)) error = "The key works, but the jobs came back in a format this connector does not understand yet.";
  } catch (err) {
    error = message(err);
  }
  await prisma.jobApiSource.update({ where: { id }, data: { lastTestedAt: new Date(), lastTestError: error } });
  return { ok: !error, error, sample };
}

const busy = new Set<JobApiId>();

/** One pull: fetch, classify, save into the Requirements table. Existing jobs are never deleted. */
export async function runJobApi(id: JobApiId) {
  if (busy.has(id)) return { ok: false, error: "Already running", fetched: 0, created: 0 };
  busy.add(id);
  try {
    const row = await prisma.jobApiSource.findUnique({ where: { id } });
    if (!row) return { ok: false, error: "Add the API key first", fetched: 0, created: 0 };
    // First run looks back a day; later runs cover the gap since the last one (5 minutes of overlap, at most a week)
    const since = new Date(Math.max(Date.now() - 7 * 86_400_000, row.lastRunAt ? row.lastRunAt.getTime() - 5 * 60_000 : Date.now() - 86_400_000));
    // Stamp first so a failing (or billing) provider is not retried on every worker tick
    await prisma.jobApiSource.update({ where: { id }, data: { lastRunAt: new Date() } });
    try {
      const jobs = await fetchFrom(id, row, { maxJobs: row.maxPerRun, since });
      const saved = await saveJobs(jobs.map((j) => toScrapedJob(id, j)));
      await prisma.jobApiSource.update({ where: { id }, data: { lastError: null, lastFetched: jobs.length, lastNew: saved.created, totalNew: { increment: saved.created } } });
      console.log(`[job-apis] ${id}: ${jobs.length} fetched, ${saved.created} new, ${saved.duplicates} duplicates`);
      return { ok: true, error: null, fetched: jobs.length, created: saved.created };
    } catch (err) {
      const error = message(err);
      console.error(`[job-apis] ${id} failed:`, error);
      await prisma.jobApiSource.update({ where: { id }, data: { lastError: error } });
      return { ok: false, error, fetched: 0, created: 0 };
    }
  } finally {
    busy.delete(id);
  }
}

/** Worker step: run every enabled provider whose interval has passed */
export async function processJobApis() {
  const rows = await prisma.jobApiSource.findMany({ where: { isEnabled: true, apiKeyEnc: { not: null } } });
  for (const row of rows) {
    if (!(JOB_API_IDS as readonly string[]).includes(row.id)) continue;
    if (row.lastRunAt && Date.now() - row.lastRunAt.getTime() < row.intervalMin * 60_000) continue;
    await runJobApi(row.id as JobApiId);
  }
}
