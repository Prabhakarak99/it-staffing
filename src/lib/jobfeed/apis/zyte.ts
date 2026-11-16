import { createHash } from "crypto";
import { apiJson, pick, stripHtml, toDate, type ApiJob, type JobApiConnector } from "./types";

const ENDPOINT = "https://api.zyte.com/v1/extract";

// Zyte API — https://docs.zyte.com/zyte-api/usage/extract/index.html
// Reads each listed page for job links (jobPostingNavigation), then extracts each new posting
// (jobPosting). Every page read is billed, so postings already stored are skipped.
export const zyte: JobApiConnector = async (cfg) => {
  if (cfg.startUrls.length === 0) throw new Error("List at least one page to read (a career site or job search page)");
  const headers = { Authorization: `Basic ${Buffer.from(`${cfg.apiKey}:`).toString("base64")}`, "Content-Type": "application/json" };
  const extract = (body: Record<string, unknown>) => apiJson<Record<string, unknown>>(ENDPOINT, { method: "POST", headers, body: JSON.stringify(body), timeoutMs: 90_000 });
  const idOf = (url: string) => createHash("sha1").update(url).digest("hex").slice(0, 20);

  const links: string[] = [];
  for (const url of cfg.startUrls) {
    const nav = (await extract({ url, jobPostingNavigation: true })).jobPostingNavigation as { items?: { url?: string }[] } | undefined;
    for (const item of nav?.items ?? []) if (item.url && !links.includes(item.url)) links.push(item.url);
  }
  const known = await cfg.isKnown(links.map(idOf));

  const jobs: ApiJob[] = [];
  for (const url of links.filter((u) => !known.has(idOf(u))).slice(0, cfg.maxJobs)) {
    const r = ((await extract({ url, jobPosting: true })).jobPosting ?? {}) as Record<string, unknown>;
    jobs.push({
      externalId: idOf(url),
      title: pick(r, "jobTitle", "headline"),
      company: pick(r, "hiringOrganization.name", "hiringOrganization.nameRaw"),
      location: pick(r, "jobLocation.raw", "jobLocation.address.addressLocality"),
      description: pick(r, "description") ?? stripHtml(pick(r, "descriptionHtml")),
      applyUrl: pick(r, "url") ?? url,
      postedAt: toDate(pick(r, "datePublished")),
      employmentHint: pick(r, "employmentType"),
      isRemote: /remote/i.test(pick(r, "remoteStatus") ?? "") || undefined,
      raw: { salary: (r.baseSalary as Record<string, unknown> | undefined)?.raw ?? null },
    });
  }
  return jobs;
};
