import { findExistingJobIds, saveJobs, type SaveResult } from "../upsert";
import { crawlAshby } from "./ashby";
import { fetchJson, type AtsAdapter, type AtsCompanyRef, type AtsProvider } from "./common";
import { crawlGreenhouse } from "./greenhouse";
import { crawlLever } from "./lever";
import { crawlSmartRecruiters } from "./smartrecruiters";
import { crawlWorkday } from "./workday";

export { PROVIDER_LABEL, type AtsProvider, type AtsCompanyRef } from "./common";

const ADAPTERS: Record<AtsProvider, AtsAdapter> = {
  greenhouse: crawlGreenhouse,
  lever: crawlLever,
  ashby: crawlAshby,
  smartrecruiters: crawlSmartRecruiters,
  workday: crawlWorkday,
};

export const PROVIDERS = Object.keys(ADAPTERS) as AtsProvider[];

export interface CompanyCrawlResult extends SaveResult {
  totalOnBoard: number;
  inScope: number;
}

/** Crawl one company board and save what's in scope (US + IT roles). */
export async function crawlCompany(company: AtsCompanyRef): Promise<CompanyCrawlResult> {
  const adapter = ADAPTERS[company.provider as AtsProvider];
  if (!adapter) throw new Error(`Unknown ATS provider "${company.provider}"`);
  const { jobs, totalOnBoard } = await adapter(company, { existing: findExistingJobIds });
  const saved = await saveJobs(jobs);
  return { ...saved, totalOnBoard, inScope: jobs.length };
}

/** One cheap request to confirm a board exists; returns how many postings it lists. */
export async function probeBoard(b: Pick<ParsedBoard, "provider" | "boardToken" | "workdayHost" | "workdaySite">): Promise<number> {
  const token = encodeURIComponent(b.boardToken);
  switch (b.provider) {
    case "greenhouse":
      return (await fetchJson<{ jobs: unknown[] }>(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs`)).jobs.length;
    case "lever":
      return (await fetchJson<unknown[]>(`https://api.lever.co/v0/postings/${token}?mode=json`)).length;
    case "ashby":
      return (await fetchJson<{ jobs: unknown[] }>(`https://api.ashbyhq.com/posting-api/job-board/${token}`)).jobs.length;
    case "smartrecruiters":
      return (await fetchJson<{ totalFound: number }>(`https://api.smartrecruiters.com/v1/companies/${token}/postings?limit=1`)).totalFound;
    case "workday": {
      if (!b.workdayHost || !b.workdaySite) throw new Error("Workday board needs a host and site");
      const data = await fetchJson<{ total?: number }>(`https://${b.workdayHost}/wday/cxs/${b.boardToken}/${b.workdaySite}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appliedFacets: {}, limit: 1, offset: 0, searchText: "" }),
      });
      return data.total ?? 0;
    }
  }
}

// ── Careers URL → board record ───────────────────────────────────────────────

export interface ParsedBoard {
  provider: AtsProvider;
  boardToken: string;
  workdayHost: string | null;
  workdaySite: string;
  suggestedName: string;
}

const titleCase = (s: string) =>
  s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();

/**
 * Accepts the public careers-page URL people actually have, e.g.
 *   boards.greenhouse.io/acme · job-boards.greenhouse.io/acme · jobs.lever.co/acme
 *   jobs.ashbyhq.com/acme · careers.smartrecruiters.com/Acme · jobs.smartrecruiters.com/Acme
 *   acme.wd5.myworkdayjobs.com/en-US/External · wd3.myworkdaysite.com/recruiting/acme/External
 */
export function parseCareersUrl(input: string): ParsedBoard | null {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);
  const board = (provider: AtsProvider, token: string | undefined): ParsedBoard | null =>
    token ? { provider, boardToken: token, workdayHost: null, workdaySite: "", suggestedName: titleCase(token) } : null;

  if (host.endsWith("greenhouse.io")) {
    // boards-api.greenhouse.io/v1/boards/{token}/jobs
    if (parts[0] === "v1" && parts[1] === "boards") return board("greenhouse", parts[2]);
    // embed URLs carry the token as ?for=
    return board("greenhouse", url.searchParams.get("for") ?? parts[0]);
  }
  if (host === "jobs.lever.co" || host === "api.lever.co") {
    return board("lever", host === "api.lever.co" ? parts[2] : parts[0]);
  }
  if (host === "jobs.ashbyhq.com") return board("ashby", parts[0]);
  if (host.endsWith("smartrecruiters.com")) return board("smartrecruiters", parts[0]);

  // acme.wd5.myworkdayjobs.com/[en-US/]{site}
  const wdJobs = host.match(/^([a-z0-9-]+)\.wd\d+\.myworkdayjobs\.com$/);
  if (wdJobs) {
    const site = parts.find((p) => !/^[a-z]{2}-[A-Z]{2}$/.test(p) && p !== "job" && p !== "details");
    if (!site) return null;
    return { provider: "workday", boardToken: wdJobs[1], workdayHost: host, workdaySite: site, suggestedName: titleCase(wdJobs[1]) };
  }
  // wd3.myworkdaysite.com/[en-US/]recruiting/{tenant}/{site}
  if (/^wd\d+\.myworkdaysite\.com$/.test(host)) {
    const i = parts.indexOf("recruiting");
    if (i === -1 || !parts[i + 1] || !parts[i + 2]) return null;
    return { provider: "workday", boardToken: parts[i + 1], workdayHost: host, workdaySite: parts[i + 2], suggestedName: titleCase(parts[i + 1]) };
  }
  return null;
}
