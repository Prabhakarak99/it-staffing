import { apifyClient } from "./apifyClient";
import { extractTechnologies, extractPrimaryTechnology, extractEmail, extractPhone, extractRate, extractVisaRequirements, detectJobType, detectRemote, extractClientName } from "./parserService";
import type { ScrapedJob } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adapt(item: any): ScrapedJob {
  const desc = String(item.description ?? item.jobDescription ?? item.job_description ?? "");
  const titleText = String(item.title ?? item.job_title ?? item.position ?? "");
  const company = item.company_name ?? item.companyName ?? item.company ?? null;
  const location = item.location ?? item.job_location ?? item.place ?? null;
  const applyLink = item.job_link ?? item.apply_link ?? item.url ?? item.link ?? item.apply_options?.[0]?.link ?? item.share_link ?? null;
  const combined = `${titleText} ${desc}`;
  const { min, max } = extractRate(desc);
  const postedRaw = item.date_posted ?? item.posted_at ?? item.datePosted ?? null;
  return {
    jobId: `google_${item.job_id ?? item.id ?? `${String(company ?? "").replace(/\W+/g, "_")}_${String(titleText).replace(/\W+/g, "_")}`.slice(0, 50)}_${Math.random().toString(36).slice(2, 6)}`,
    source: "Google",
    title: titleText || null,
    vendorName: company,
    vendorEmail: extractEmail(desc),
    vendorPhone: extractPhone(desc),
    location,
    isRemote: detectRemote(desc, location),
    jobDescription: desc || null,
    technology: extractPrimaryTechnology(combined),
    technologies: extractTechnologies(combined),
    jobType: detectJobType(desc),
    visaRequirements: extractVisaRequirements(desc),
    clientName: extractClientName(desc),
    rateMin: min,
    rateMax: max,
    applyLink,
    datePosted: postedRaw ? new Date(postedRaw) : null,
    rawData: item,
  };
}

export async function scrapeGoogle(): Promise<ScrapedJob[]> {
  const queries = [
    "MES Engineer C2C contract USA",
    "SAP S4HANA C2C contract USA",
    "PLM Teamcenter C2C contract USA",
    "Pharma IT C2C contract USA",
  ];

  // The Actor takes a single query, so run it once per query
  const items: Record<string, unknown>[] = [];
  for (const query of queries) {
    const input = {
      query,
      country: "us",
      language: "en",
      num_results: 50,
    };

    const run = await apifyClient.actor("johnvc/Google-Jobs-Scraper").call(input, { waitSecs: 300 });
    const { items: rows } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    items.push(...(rows as Record<string, unknown>[]));
  }

  // Error rows have no title
  return items.filter((item) => item.title).map(adapt);
}
