import { apiJson, perKeyword, pick, rowsOf, stripHtml, toDate, type ApiJob, type JobApiConnector } from "./types";

// JobFront v4 — https://docs.jobfront.com/get-started (GET /v4/jobs, Bearer token, newest first, cursor paging).
// The full field list is behind a customer access code, so job fields are read tolerantly.
export const jobfront: JobApiConnector = async (cfg) => {
  const since = Date.now() - cfg.sinceHours * 3_600_000;
  const headers = { Authorization: `Bearer ${cfg.apiKey}` };
  const jobs: ApiJob[] = [];
  for (const keyword of cfg.keywords) {
    const want = Math.min(perKeyword(cfg), cfg.maxJobs - jobs.length);
    if (want <= 0) break;
    let cursor: string | null = null;
    let got = 0;
    // 25 per page is the API's maximum; newest first, so stop at the first job older than the window
    paging: for (let page = 0; page < 8 && got < want; page++) {
      const params: URLSearchParams = new URLSearchParams({ search: keyword, limit: "25", ...(cfg.contractOnly ? { commitments: "contract" } : {}), ...cfg.extra, ...(cursor ? { cursor } : {}) });
      const reply: { cursor?: string } = await apiJson<{ cursor?: string }>(`https://api.jobfront.com/v4/jobs?${params}`, { headers });
      for (const r of rowsOf(reply)) {
        const id = pick(r, "id", "job_id", "uuid", "url");
        const postedAt = toDate(pick(r, "created_at", "posted_at", "published_at"));
        if (postedAt && postedAt.getTime() < since) break paging;
        if (!id) continue;
        jobs.push({
          externalId: id,
          title: pick(r, "title"),
          company: pick(r, "company.name", "company_name", "organization.name", "company", "source.name"),
          location: pick(r, "location.name", "location", "locations", "city", "cbsa"),
          description: stripHtml(pick(r, "description", "description_text")),
          applyUrl: pick(r, "apply_url", "url", "job_url", "source.url"),
          postedAt,
          employmentHint: pick(r, "commitment", "commitments"),
          isRemote: r.is_remote === true || undefined,
        });
        if (++got >= want) break paging;
      }
      cursor = typeof reply.cursor === "string" ? reply.cursor : null;
      if (!cursor) break;
    }
  }
  return jobs;
};
