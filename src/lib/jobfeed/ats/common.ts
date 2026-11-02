import type { ScrapedJob } from "@/lib/apify/types";
import {
  extractClientName, extractEmail, extractPhone, extractPrimaryTechnology,
  extractRate, extractTechnologies, extractVisaRequirements, detectRemote,
} from "@/lib/apify/parserService";
import { classifyByRules, isItTitle, isUsLocation } from "../rules";

export type AtsProvider = "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "workday";

export const PROVIDER_LABEL: Record<AtsProvider, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
  workday: "Workday",
};

export interface AtsCompanyRef {
  id: string;
  name: string;
  provider: string;
  boardToken: string;
  workdayHost: string | null;
  workdaySite: string;
}

export interface CrawlContext {
  /** Which of these jobIds are already stored (so details are fetched only for new jobs) */
  existing: (jobIds: string[]) => Promise<Set<string>>;
}

export interface CrawlOutput {
  /** Every in-scope job seen (new ones fully built, known ones as id-only stubs) */
  jobs: ScrapedJob[];
  /** Total postings on the board before the IT / US filter */
  totalOnBoard: number;
}

export type AtsAdapter = (company: AtsCompanyRef, ctx: CrawlContext) => Promise<CrawlOutput>;

// ── HTTP ─────────────────────────────────────────────────────────────────────

const USER_AGENT = `GFTVisionJobFeed/1.0 (+${process.env.NEXT_PUBLIC_APP_URL ?? "https://gftvision.fly.dev"})`;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return (await res.json()) as T;
}

/** Workday / SmartRecruiters need one request per job description; cap it per cycle */
export const MAX_DETAIL_FETCHES = 60;
export const DETAIL_DELAY_MS = 600;

// ── Filters + job building ───────────────────────────────────────────────────

export function inScope(title: string | null | undefined, location: string | null | undefined) {
  return isItTitle(title) && isUsLocation(location);
}

export function atsJobId(company: AtsCompanyRef, externalId: string | number) {
  const site = company.workdaySite ? `_${company.workdaySite}` : "";
  return `${company.provider}_${company.boardToken}${site}_${externalId}`;
}

/** Id-only record for a job we already have — saveJobs just marks it as seen */
export function seenStub(company: AtsCompanyRef, jobId: string): ScrapedJob {
  return buildAtsJob(company, { jobId, title: null, location: null, description: "", applyLink: null, datePosted: null });
}

export function buildAtsJob(
  company: AtsCompanyRef,
  p: {
    jobId: string;
    title: string | null;
    location: string | null;
    description: string;
    applyLink: string | null;
    datePosted: Date | null;
    isRemote?: boolean;
    employmentHint?: string | null;
    raw?: Record<string, unknown>;
    /** Turned out to be out of scope (e.g. non-US once the detail page was read): store a bare marker */
    outOfScope?: boolean;
  },
): ScrapedJob {
  const provider = company.provider as AtsProvider;
  const title = p.title?.trim() ?? "";
  const text = `${title}\n${p.description}`;
  const rules = p.outOfScope
    ? { jobType: "Full-time", employmentType: "Out of scope", isContract: false, classifiedBy: "regex" as const }
    : classifyByRules(title, p.description, p.employmentHint);
  const rate = extractRate(text);
  // Full-time jobs are kept only as lightweight markers (so they aren't re-fetched every hour)
  const keepDetail = rules.jobType !== "Full-time";

  return {
    jobId: p.jobId,
    source: PROVIDER_LABEL[provider] ?? company.provider,
    title: title || null,
    vendorName: company.name,
    vendorEmail: keepDetail ? extractEmail(p.description) : null,
    vendorPhone: keepDetail ? extractPhone(p.description) : null,
    location: p.location,
    isRemote: p.isRemote ?? detectRemote(text, p.location),
    jobDescription: keepDetail ? p.description || null : null,
    technology: extractPrimaryTechnology(text),
    technologies: extractTechnologies(text),
    jobType: rules.jobType,
    visaRequirements: extractVisaRequirements(text),
    clientName: keepDetail ? extractClientName(p.description) : null,
    rateMin: rate.min,
    rateMax: rate.max,
    applyLink: p.applyLink,
    datePosted: p.datePosted,
    rawData: keepDetail ? { employmentHint: p.employmentHint ?? null, ...(p.raw ?? {}) } : {},
    sourceType: "ats",
    atsProvider: company.provider,
    atsCompanyId: company.id,
    companyName: company.name,
    employmentType: rules.employmentType,
    isContract: rules.isContract,
    classifiedBy: rules.classifiedBy,
  };
}

export function toDate(v: string | number | null | undefined): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
