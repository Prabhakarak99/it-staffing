import { apiJson, pick, rowsOf, toDate, type ApiJob, type JobApiConnector } from "./types";

// Fantastic.jobs — https://developer.fantastic.jobs (GET /v1/active-ats, Bearer key).
// Plans count both jobs returned and API requests, so a pull is ONE request: all titles joined with OR.
const feed = (path: "active-ats" | "active-jb"): JobApiConnector => async (cfg) => {
  // time_frame only has fixed sizes, so date_created_gte narrows it to what is new since the last pull:
  // every job returned costs a credit, and this keeps the same job from being paid for twice
  const timeFrame = cfg.sinceHours <= 1 ? "1h" : cfg.sinceHours <= 24 ? "24h" : "7d";
  // Google-style title search: phrases (and names with punctuation, like ".Net") in quotes
  const title = cfg.keywords.map((k) => (/^[A-Za-z0-9]+$/.test(k) ? k : `"${k.replace(/"/g, "")}"`)).join(" OR ");
  const params = new URLSearchParams({
    time_frame: timeFrame,
    date_created_gte: cfg.since.toISOString(),
    title,
    location: "United States",
    description_format: "text",
    limit: String(Math.min(cfg.maxJobs, 1000)),
    ...(cfg.contractOnly ? { ai_employment_type: "CONTRACTOR" } : {}),
    // Job boards: skip listings that the company-site feed already carries
    ...(path === "active-jb" ? { exclude_ats_duplicate: "true" } : {}),
    ...cfg.extra,
  });
  const reply = await apiJson<unknown>(`https://data.fantastic.jobs/v1/${path}?${params}`, { headers: { Authorization: `Bearer ${cfg.apiKey}` } });
  const jobs: ApiJob[] = [];
  for (const r of rowsOf(reply)) {
    const id = pick(r, "id");
    if (!id) continue;
    jobs.push({
      externalId: id,
      title: pick(r, "title"),
      company: pick(r, "organization"),
      contactName: pick(r, "recruiter_name", "ai_hiring_manager_name"),
      location: pick(r, "locations_derived", "locations_alt", "cities_derived", "regions_derived", "countries_derived"),
      description: pick(r, "description_text") ?? "",
      applyUrl: pick(r, "url"),
      postedAt: toDate(pick(r, "date_posted", "date_created")),
      employmentHint: pick(r, "ai_employment_type", "employment_type"),
      isRemote: pick(r, "location_type") === "TELECOMMUTE" || /remote/i.test(pick(r, "ai_work_arrangement") ?? "") || undefined,
      raw: { source: r.source, recruiterUrl: r.recruiter_url ?? null, recruiterTitle: r.recruiter_title ?? null, salary: r.ai_salary_value ?? null, salaryUnit: r.ai_salary_unit_text ?? null, visa: r.ai_visa_sponsorship ?? null },
    });
  }
  return jobs;
};

/** Jobs from company career sites (ATS) */
export const fantastic = feed("active-ats");
/** Listings posted directly on LinkedIn, Wellfound and Y Combinator */
export const fantasticBoards = feed("active-jb");
