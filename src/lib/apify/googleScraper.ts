import { apifyClient } from "./apifyClient";
import { extractTechnologies, extractPrimaryTechnology, extractEmail, extractPhone, extractRate, extractVisaRequirements, detectJobType, isC2CJob, detectRemote, extractClientName } from "./parserService";
import type { ScrapedJob } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adapt(item: any): ScrapedJob {
  const desc = String(item.description ?? item.jobDescription ?? "");
  const applyOptions = Array.isArray(item.apply_options) ? item.apply_options : [];
  const applyLink = applyOptions[0]?.link ?? item.job_link ?? item.url ?? null;
  const { min, max } = extractRate(desc);
  const titleText = String(item.title ?? item.job_title ?? "");
  const combined = `${titleText} ${desc}`;
  return {
    jobId: `google_${item.job_id ?? item.id ?? `${titleText}_${item.company_name}`.replace(/\s+/g, "_").slice(0, 50)}_${Math.random().toString(36).slice(2, 6)}`,
    source: "Google",
    title: titleText || null,
    vendorName: item.company_name ?? item.companyName ?? item.company ?? null,
    vendorEmail: extractEmail(desc),
    vendorPhone: extractPhone(desc),
    location: item.location ?? item.job_location ?? null,
    isRemote: detectRemote(desc, item.location ?? item.job_location),
    jobDescription: desc || null,
    technology: extractPrimaryTechnology(combined),
    technologies: extractTechnologies(combined),
    jobType: detectJobType(desc),
    visaRequirements: extractVisaRequirements(desc),
    clientName: extractClientName(desc),
    rateMin: min,
    rateMax: max,
    applyLink,
    datePosted: item.date_posted ?? item.posted_at ? new Date(item.date_posted ?? item.posted_at) : null,
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
    maxPagesPerQuery: 3,
    countryCode: "us",
    languageCode: "en",
  };

  const run = await apifyClient.actor("apify/google-jobs-scraper").call(input, { waitSecs: 300 });
  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

  return (items as Record<string, unknown>[])
    .map(adapt)
    .filter((j) => isC2CJob(j.jobDescription ?? "") || j.jobType !== "Contract");
}
