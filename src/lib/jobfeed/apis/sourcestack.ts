import { apiJson, perKeyword, pick, rowsOf, stripHtml, toDate, type ApiJob, type JobApiConnector } from "./types";

// SourceStack — GET https://sourcestack-api.com/jobs with an X-API-KEY header.
// Their API reference could not be opened while this was written, so the request uses only the
// basic `name` + `limit` parameters and the reply is read tolerantly. Tune with "Extra settings".
export const sourcestack: JobApiConnector = async (cfg) => {
  const since = Date.now() - cfg.sinceHours * 3_600_000;
  const jobs: ApiJob[] = [];
  for (const keyword of cfg.keywords) {
    if (jobs.length >= cfg.maxJobs) break;
    const params = new URLSearchParams({ name: keyword, limit: String(Math.min(perKeyword(cfg), cfg.maxJobs - jobs.length)), ...cfg.extra });
    const reply = await apiJson<unknown>(`https://sourcestack-api.com/jobs?${params}`, { headers: { "X-API-KEY": cfg.apiKey } });
    for (const r of rowsOf(reply)) {
      const id = pick(r, "post_uuid", "id", "job_id", "post_url");
      const postedAt = toDate(pick(r, "first_indexed", "posted_at", "date_posted", "last_indexed"));
      if (!id || (postedAt && postedAt.getTime() < since)) continue;
      jobs.push({
        externalId: id,
        title: pick(r, "job_name", "title"),
        company: pick(r, "company_name", "company"),
        location: pick(r, "job_location", "location", "city", "country"),
        description: stripHtml(pick(r, "post_html", "description", "job_description")),
        applyUrl: pick(r, "post_apply_url", "post_url", "url"),
        postedAt,
        employmentHint: pick(r, "job_type", "contract_type", "hours", "employment_type"),
        isRemote: r.remote === true || undefined,
      });
    }
  }
  return jobs;
};
