import { apiJson, pick, stripHtml, toDate, type ApiJob, type JobApiConnector } from "./types";

const BASE = "https://api.coresignal.com/cdapi/v2/job_multi_source";

// Coresignal multi-source jobs — https://docs.coresignal.com/jobs-api/multi-source-jobs-api
// Search (Elasticsearch DSL) is free and returns job ids; each job collected costs 1 credit.
export const coresignal: JobApiConnector = async (cfg) => {
  const headers = { apikey: cfg.apiKey, "Content-Type": "application/json" };
  const since = new Date(Date.now() - cfg.sinceHours * 3_600_000).toISOString().slice(0, 19).replace("T", " ");
  const body = {
    query: {
      bool: {
        must: [
          { bool: { should: cfg.keywords.map((k) => ({ match_phrase: { title: k } })), minimum_should_match: 1 } },
          { match: { country: "United States" } },
          { range: { created_at: { gte: since } } },
          ...(cfg.contractOnly ? [{ match: { employment_type: "contract" } }] : []),
        ],
      },
    },
    sort: [{ created_at: "desc" }],
  };
  const found = await apiJson<unknown>(`${BASE}/search/es_dsl`, { method: "POST", headers, body: JSON.stringify(body) });
  const ids = (Array.isArray(found) ? found : []).map((x) => String(typeof x === "object" && x ? (x as { id?: unknown }).id : x)).filter((x) => /^\d+$/.test(x));

  // Don't pay to collect a job we already have
  const known = await cfg.isKnown(ids);
  const jobs: ApiJob[] = [];
  for (const id of ids.filter((x) => !known.has(x)).slice(0, cfg.maxJobs)) {
    const r = await apiJson<Record<string, unknown>>(`${BASE}/collect/${id}`, { headers });
    jobs.push({
      externalId: id,
      title: pick(r, "title"),
      company: pick(r, "company_name"),
      location: pick(r, "location", "city", "state", "country"),
      description: stripHtml(pick(r, "description")),
      applyUrl: pick(r, "external_url", "url", "job_sources.0.url"),
      postedAt: toDate(pick(r, "created_at", "date_posted")),
      employmentHint: pick(r, "employment_type"),
      isRemote: r.accepts_remote === true || undefined,
      raw: { salary: r.salary ?? null },
    });
  }
  return jobs;
};
