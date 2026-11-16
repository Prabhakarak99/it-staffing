import { apiJson, perKeyword, pick, rowsOf, stripHtml, toDate, type ApiJob, type JobApiConnector } from "./types";

const ACTOR = "aspen-technology-labs-inc~it-jobs-api";

// Aspen Tech Labs JobsIndex, IT jobs — https://apify.com/aspen-technology-labs-inc/it-jobs-api
// Runs their Apify actor and reads its results (billed to the Apify account, per job record).
export const aspen: JobApiConnector = async (cfg) => {
  const posted = cfg.sinceHours <= 24 ? "1d" : cfg.sinceHours <= 168 ? "1w" : "1m";
  const jobs: ApiJob[] = [];
  for (const keyword of cfg.keywords) {
    if (jobs.length >= cfg.maxJobs) break;
    const input = {
      title: keyword,
      country: "United States",
      posted,
      size: Math.min(perKeyword(cfg), cfg.maxJobs - jobs.length, 100),
      ...(cfg.contractOnly ? { employment_type: "Contract" } : {}),
      ...cfg.extra,
    };
    const reply = await apiJson<unknown>(`https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?format=json&clean=true`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(input),
      timeoutMs: 120_000,
    });
    for (const r of rowsOf(reply)) {
      const id = pick(r, "id", "url_apply");
      if (!id) continue;
      const na = (v: string | null) => (v && v.toLowerCase() !== "n/a" ? v : null);
      const place = [na(pick(r, "city")), na(pick(r, "region")), na(pick(r, "country"))].filter(Boolean).join(", ");
      jobs.push({
        externalId: id,
        title: pick(r, "title"),
        company: na(pick(r, "company_name")),
        location: place || null,
        description: stripHtml(pick(r, "description", "job_description", "description_text")),
        applyUrl: pick(r, "url_apply", "url"),
        postedAt: toDate(pick(r, "posted")),
        employmentHint: na(pick(r, "employment_type")),
        isRemote: /remote/i.test(pick(r, "remote") ?? "") || undefined,
      });
    }
  }
  return jobs;
};
