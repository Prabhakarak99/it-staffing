import { htmlToText } from "../rules";
import {
  atsJobId, buildAtsJob, DETAIL_DELAY_MS, fetchJson, inScope, MAX_DETAIL_FETCHES,
  seenStub, sleep, toDate, type AtsAdapter,
} from "./common";
import type { ScrapedJob } from "@/lib/apify/types";

interface SrPosting {
  id: string;
  name: string;
  releasedDate?: string;
  ref?: string;
  location?: { city?: string; region?: string; country?: string; remote?: boolean; fullLocation?: string };
  typeOfEmployment?: { label?: string };
}

interface SrDetail {
  postingUrl?: string;
  applyUrl?: string;
  jobAd?: { sections?: Record<string, { title?: string; text?: string } | undefined> };
}

const PAGE = 100;
const MAX_PAGES = 10;

// Public Posting API — no auth: https://developers.smartrecruiters.com/docs/posting-api
export const crawlSmartRecruiters: AtsAdapter = async (company, ctx) => {
  const base = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company.boardToken)}/postings`;
  const postings: SrPosting[] = [];
  let totalOnBoard = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await fetchJson<{ totalFound: number; content: SrPosting[] }>(`${base}?limit=${PAGE}&offset=${page * PAGE}`);
    totalOnBoard = data.totalFound ?? 0;
    postings.push(...(data.content ?? []));
    if ((page + 1) * PAGE >= totalOnBoard || !data.content?.length) break;
  }

  const where = (p: SrPosting) =>
    p.location?.fullLocation ?? [p.location?.city, p.location?.region, p.location?.country].filter(Boolean).join(", ");
  // SmartRecruiters gives an ISO country code — more reliable than matching place names
  const candidates = postings.filter((p) =>
    p.location?.country ? p.location.country.toLowerCase() === "us" && inScope(p.name, null) : inScope(p.name, where(p)),
  );
  const ids = candidates.map((p) => atsJobId(company, p.id));
  const known = await ctx.existing(ids);

  const jobs: ScrapedJob[] = [];
  let detailFetches = 0;
  for (let i = 0; i < candidates.length; i++) {
    const p = candidates[i];
    if (known.has(ids[i])) {
      jobs.push(seenStub(company, ids[i]));
      continue;
    }
    // Remaining new jobs are picked up next cycle
    if (detailFetches >= MAX_DETAIL_FETCHES) continue;
    detailFetches++;
    let description = "";
    let link = `https://jobs.smartrecruiters.com/${company.boardToken}/${p.id}`;
    try {
      const d = await fetchJson<SrDetail>(p.ref ?? `${base}/${p.id}`);
      description = Object.values(d.jobAd?.sections ?? {})
        .filter((s) => s?.text)
        .map((s) => `${s!.title ? `${s!.title}\n` : ""}${htmlToText(s!.text)}`)
        .join("\n\n");
      link = d.applyUrl ?? d.postingUrl ?? link;
    } catch {
      /* keep the listing without a description */
    }
    await sleep(DETAIL_DELAY_MS);
    jobs.push(buildAtsJob(company, {
      jobId: ids[i],
      title: p.name,
      location: where(p) || null,
      description,
      applyLink: link,
      datePosted: toDate(p.releasedDate),
      isRemote: p.location?.remote || undefined,
      employmentHint: p.typeOfEmployment?.label ?? null,
      raw: { smartRecruitersId: p.id },
    }));
  }

  return { jobs, totalOnBoard };
};
