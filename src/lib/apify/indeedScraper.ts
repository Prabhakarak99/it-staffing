import { apifyClient } from "./apifyClient";
import { extractTechnologies, extractPrimaryTechnology, extractEmail, extractPhone, extractRate, extractVisaRequirements, detectJobType, isC2CJob, detectRemote, extractClientName } from "./parserService";
import type { ScrapedJob } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adapt(item: any): ScrapedJob {
  const desc = String(item.description ?? item.jobDescription ?? item.fullDescription ?? "");
  const { min, max } = extractRate(desc);
  const titleText = String(item.positionName ?? item.title ?? "");
  const combined = `${titleText} ${desc}`;
  return {
    jobId: `indeed_${item.id ?? item.jobKey ?? item.url ?? Math.random().toString(36).slice(2)}`,
    source: "Indeed",
    title: titleText || null,
    vendorName: item.company ?? item.companyName ?? null,
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
    applyLink: item.url ?? item.externalApplyLink ?? null,
    datePosted: item.datePosted ?? item.postingDateParsed ? new Date(item.datePosted ?? item.postingDateParsed) : null,
    rawData: item,
  };
}

export async function scrapeIndeed(): Promise<ScrapedJob[]> {
  const input = {
    queries: [
      { query: "MES Engineer C2C",    location: "United States", jobType: "contract" },
      { query: "SAP S4HANA C2C",      location: "United States", jobType: "contract" },
      { query: "PLM Teamcenter C2C",  location: "United States", jobType: "contract" },
      { query: "Pharma IT C2C",       location: "United States", jobType: "contract" },
    ],
    maxItems: 200,
  };

  const run = await apifyClient.actor("misceres/indeed-scraper").call(input, { waitSecs: 300 });
  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

  return (items as Record<string, unknown>[])
    .map(adapt)
    .filter((j) => isC2CJob(j.jobDescription ?? "") || j.jobType !== "Contract");
}
