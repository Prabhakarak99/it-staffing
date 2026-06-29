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

export async function scrapeLinkedIn(): Promise<ScrapedJob[]> {
  const input = {
    queries: ["MES Engineer", "SAP S4HANA", "PLM Teamcenter", "Pharma IT", "OT Security", "Siemens Opcenter"],
    location: "United States",
    contractType: "CONTRACT",
    datePosted: "past_week",
    limit: 100,
  };

  const run = await apifyClient.actor("curious_coder/linkedin-jobs-scraper").call(input, { waitSecs: 300 });
  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

  return (items as Record<string, unknown>[])
    .map(adapt)
    .filter((j) => isC2CJob(j.jobDescription ?? "") || j.jobType !== "Contract");
}
