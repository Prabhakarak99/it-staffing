import { apifyClient } from "./apifyClient";
import { extractTechnologies, extractPrimaryTechnology, extractEmail, extractPhone, extractRate, extractVisaRequirements, detectJobType, detectRemote, extractClientName } from "./parserService";
import type { ScrapedJob } from "./types";

const SEARCH_TERMS = [
  "MES Engineer C2C contract",
  "SAP S4HANA C2C contract",
  "PLM Teamcenter C2C contract",
  "Pharma IT C2C contract",
  "OT Security C2C contract",
  "Siemens Opcenter C2C contract",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adapt(item: any): ScrapedJob {
  const desc = String(item.description ?? item.jobDescription ?? item.descriptionText ?? "");
  const titleText = String(item.title ?? item.jobTitle ?? "");
  const combined = `${titleText} ${desc}`;
  const { min, max } = extractRate(desc);
  const postedRaw = item.postedAt ?? item.postedDate ?? item.publishedAt ?? null;
  return {
    jobId: `linkedin_${item.id ?? item.jobId ?? item.externalJobPostingId ?? Math.random().toString(36).slice(2)}`,
    source: "LinkedIn",
    title: titleText || null,
    vendorName: item.companyName ?? item.company ?? null,
    vendorEmail: extractEmail(desc),
    vendorPhone: extractPhone(desc),
    location: item.location ?? item.jobLocation ?? null,
    isRemote: detectRemote(desc, item.location ?? item.jobLocation),
    jobDescription: desc || null,
    technology: extractPrimaryTechnology(combined),
    technologies: extractTechnologies(combined),
    jobType: detectJobType(desc),
    visaRequirements: extractVisaRequirements(desc),
    clientName: extractClientName(desc),
    rateMin: min,
    rateMax: max,
    applyLink: item.applyUrl ?? item.jobUrl ?? item.url ?? null,
    datePosted: postedRaw ? new Date(postedRaw) : null,
    rawData: item,
  };
}

export async function scrapeLinkedIn(): Promise<ScrapedJob[]> {
  // curious_coder/linkedin-jobs-scraper requires urls[] of LinkedIn search pages
  const urls = SEARCH_TERMS.map(
    (q) =>
      `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(q)}&location=United%20States&f_JT=C&f_TPR=r604800`
  );

  const run = await apifyClient.actor("curious_coder/linkedin-jobs-scraper").call(
    { urls, limit: 100 },
    { waitSecs: 300 }
  );
  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

  return (items as Record<string, unknown>[]).map(adapt);
}
