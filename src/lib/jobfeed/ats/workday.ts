import { htmlToText, isUsLocation } from "../rules";
import {
  atsJobId, buildAtsJob, DETAIL_DELAY_MS, fetchJson, inScope, MAX_DETAIL_FETCHES,
  seenStub, sleep, toDate, type AtsAdapter,
} from "./common";
import type { ScrapedJob } from "@/lib/apify/types";

interface WdListItem {
  title: string;
  externalPath: string;
  locationsText?: string;
  postedOn?: string;
}

interface WdDetail {
  jobPostingInfo?: {
    title?: string;
    jobDescription?: string;
    location?: string;
    startDate?: string;
    timeType?: string; // "Full time" | "Part time"
    jobReqId?: string;
    externalUrl?: string;
    remoteType?: string;
  };
}

const PAGE = 20; // Workday caps a page at 20
// Newest postings come first; 25 pages (500 jobs) covers what's new between hourly crawls
const MAX_PAGES = 25;

/**
 * Workday has no documented public API. Every Workday career site's own search box calls this
 * JSON endpoint (no login needed); we call it the same way, slowly, one company at a time.
 */
export const crawlWorkday: AtsAdapter = async (company, ctx) => {
  if (!company.workdayHost || !company.workdaySite) throw new Error("Workday board needs a host and site");
  const base = `https://${company.workdayHost}/wday/cxs/${company.boardToken}/${company.workdaySite}`;

  const listings: WdListItem[] = [];
  let totalOnBoard = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await fetchJson<{ total?: number; jobPostings?: WdListItem[] }>(`${base}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appliedFacets: {}, limit: PAGE, offset: page * PAGE, searchText: "" }),
    });
    // Workday only reports the total on the first page
    if (page === 0) totalOnBoard = data.total ?? 0;
    const items = data.jobPostings ?? [];
    listings.push(...items);
    if (items.length < PAGE || (page + 1) * PAGE >= totalOnBoard) break;
    await sleep(DETAIL_DELAY_MS);
  }

  const candidates = listings.filter((l) => inScope(l.title, l.locationsText));
  const ids = candidates.map((l) => atsJobId(company, l.externalPath.split("/").pop() ?? l.externalPath));
  const known = await ctx.existing(ids);

  const jobs: ScrapedJob[] = [];
  let detailFetches = 0;
  for (let i = 0; i < candidates.length; i++) {
    const l = candidates[i];
    if (known.has(ids[i])) {
      jobs.push(seenStub(company, ids[i]));
      continue;
    }
    // Remaining new jobs are picked up next cycle
    if (detailFetches >= MAX_DETAIL_FETCHES) continue;
    detailFetches++;
    let info: WdDetail["jobPostingInfo"] = {};
    try {
      info = (await fetchJson<WdDetail>(`${base}${l.externalPath}`)).jobPostingInfo ?? {};
    } catch {
      /* keep the listing without a description */
    }
    await sleep(DETAIL_DELAY_MS);
    const location = info.location ?? l.locationsText ?? null;
    jobs.push(buildAtsJob(company, {
      jobId: ids[i],
      title: info.title ?? l.title,
      location,
      // The list often says only "3 Locations"; the detail page has the real one
      outOfScope: !isUsLocation(location),
      description: htmlToText(info.jobDescription),
      applyLink: info.externalUrl ?? `https://${company.workdayHost}/${company.workdaySite}${l.externalPath}`,
      datePosted: toDate(info.startDate),
      isRemote: /remote/i.test(info.remoteType ?? "") || undefined,
      employmentHint: info.timeType ?? null,
      raw: { workdayReqId: info.jobReqId ?? null },
    }));
  }

  return { jobs, totalOnBoard };
};
