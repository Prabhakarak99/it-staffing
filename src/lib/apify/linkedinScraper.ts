import { apifyClient } from "./apifyClient";
import { extractTechnologies, extractPrimaryTechnology, extractEmail, extractPhone, extractRate, extractVisaRequirements, detectJobType, isC2CJob, detectRemote, extractClientName } from "./parserService";
import type { ScrapedJob } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adapt(item: any): ScrapedJob {
  const desc = String(item.description ?? item.jobDescription ?? "");
  const { min, max } = extractRate(desc);
  const titleText = String(item.title ?? item.jobTitle ?? "");
  const combined = `${titleText} ${desc}`;
  return {
    jobId: `linkedin_${item.id ?? item.jobId ?? item.externalJobPostingId ?? Math.random().toString(36).slice(2)}`,
    source: "LinkedIn",
    title: titleText || null,
    vendorName: item.companyName ?? item.company ?? null,
    vendorEmail: extractEmail(desc),
    vendorPhone: extractPhone(desc),
    location: item.location ?? item.jobLocation ?? null,
    isRemote: detectRemote(desc, item.location),
    jobDescription: desc || null,
    technology: extractPrimaryTechnology(combined),
    technologies: extractTechnologies(combined),
    jobType: detectJobType(desc),
    visaRequirements: extractVisaRequirements(desc),
    clientName: extractClientName(desc),
    rateMin: min,
    rateMax: max,
    applyLink: item.applyUrl ?? item.jobUrl ?? item.url ?? null,
    datePosted: item.postedAt ?? item.postedDate ? new Date(item.postedAt ?? item.postedDate) : null,
    rawData: item,
  };
}

const SEARCH_TERMS = [
  "MES Engineer C2C contract",
  "SAP S4HANA C2C contract",
  "PLM Teamcenter C2C contract",
  "Pharma IT C2C contract",
  "OT Security C2C contract",
  "Siemens Opcenter C2C contract",
];

export async function scrapeLinkedIn(): Promise<ScrapedJob[]> {
  // curious_coder/linkedin-jobs-scraper requires an array of LinkedIn search URLs
  const urls = SEARCH_TERMS.map(
    (q) =>
      `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(q)}&location=United%20States&f_JT=C&f_TPR=r604800`
  );

  const input = { urls, limit: 100 };

  const run = await apifyClient.actor("curious_coder/linkedin-jobs-scraper").call(input, { waitSecs: 300 });
  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

  return (items as Record<string, unknown>[])
    .map(adapt)
    .filter((j) => isC2CJob(j.jobDescription ?? "") || j.jobType !== "Contract");
}
