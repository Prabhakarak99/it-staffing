import { apifyClient } from "./apifyClient";
import { extractTechnologies, extractPrimaryTechnology, extractEmail, extractPhone, extractRate, extractVisaRequirements, detectJobType, isC2CJob, detectRemote, extractClientName } from "./parserService";
import type { ScrapedJob } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adapt(item: any): ScrapedJob {
  const desc = String(item.description ?? item.jobDescription ?? item.job_description ?? "");
  const titleText = String(item.title ?? item.job_title ?? item.position ?? "");
  const company = item.company_name ?? item.companyName ?? item.company ?? null;
  const location = item.location ?? item.job_location ?? item.place ?? null;
  const applyLink = item.job_link ?? item.apply_link ?? item.url ?? item.link ?? null;
  const combined = `${titleText} ${desc}`;
  const { min, max } = extractRate(desc);
  const postedRaw = item.date_posted ?? item.posted_at ?? item.datePosted ?? null;
  return {
    jobId: `google_${item.job_id ?? item.id ?? `${company}_${titleText}`.replace(/\W+/g, "_").slice(0, 40)}_${Math.random().toString(36).slice(2, 6)}`,
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
  const input = {
    queries: [
      "MES Engineer C2C contract USA",
      "SAP S4HANA C2C contract USA",
      "PLM Teamcenter C2C contract USA",
      "Pharma IT C2C contract USA",
    ],
    country: "us",
    language: "en",
    maxResultsPerQuery: 50,
  };

  // lhotanok/google-jobs-results-scraper is the correct actor for Google Jobs
  const run = await apifyClient.actor("lhotanok/google-jobs-results-scraper").call(input, { waitSecs: 300 });
  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

  return (items as Record<string, unknown>[])
    .map(adapt)
    .filter((j) => isC2CJob(j.jobDescription ?? "") || j.jobType !== "Contract");
}
