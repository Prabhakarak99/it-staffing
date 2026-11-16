import { apiJson, perKeyword, pick, rowsOf, toDate, type ApiJob, type JobApiConnector } from "./types";

// Fantastic.jobs — https://developer.fantastic.jobs (GET /v1/active-ats, Bearer key, 1 credit per job returned)
export const fantastic: JobApiConnector = async (cfg) => {
  // time_frame only has fixed sizes, so date_created_gte narrows it to what is new since the last pull:
  // every job returned costs a credit, and this keeps the same job from being paid for twice
  const timeFrame = cfg.sinceHours <= 1 ? "1h" : cfg.sinceHours <= 24 ? "24h" : "7d";
  const jobs: ApiJob[] = [];
  for (const keyword of cfg.keywords) {
    if (jobs.length >= cfg.maxJobs) break;
    const params = new URLSearchParams({
      time_frame: timeFrame,
      date_created_gte: cfg.since.toISOString(),
      title: keyword,
      location: "United States",
      description_format: "text",
      limit: String(Math.min(perKeyword(cfg), cfg.maxJobs - jobs.length, 1000)),
      ...(cfg.contractOnly ? { ai_employment_type: "CONTRACTOR" } : {}),
      ...cfg.extra,
    });
    const reply = await apiJson<unknown>(`https://data.fantastic.jobs/v1/active-ats?${params}`, { headers: { Authorization: `Bearer ${cfg.apiKey}` } });
    for (const r of rowsOf(reply)) {
      const id = pick(r, "id");
      if (!id) continue;
      jobs.push({
        externalId: id,
        title: pick(r, "title"),
        company: pick(r, "organization"),
        location: pick(r, "locations_derived", "locations_alt", "cities_derived", "regions_derived", "countries_derived"),
        description: pick(r, "description_text") ?? "",
        applyUrl: pick(r, "url"),
        postedAt: toDate(pick(r, "date_posted", "date_created")),
        employmentHint: pick(r, "ai_employment_type", "employment_type"),
        isRemote: pick(r, "location_type") === "TELECOMMUTE" || /remote/i.test(pick(r, "ai_work_arrangement") ?? "") || undefined,
        raw: { source: r.source, salary: r.ai_salary_value ?? null, salaryUnit: r.ai_salary_unit_text ?? null, visa: r.ai_visa_sponsorship ?? null },
      });
    }
  }
  return jobs;
};
