import { apifyClient } from "./apifyClient";
import { extractTechnologies, extractPrimaryTechnology, extractEmail, extractPhone, extractRate, extractVisaRequirements, detectJobType, detectRemote, extractClientName } from "./parserService";
import type { ScrapedJob } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adapt(item: any): ScrapedJob {
  const desc = String(item.description ?? item.jobDescription ?? item.fullDescription ?? item.descriptionHtml?.replace(/<[^>]+>/g, "") ?? "");
  const titleText = String(item.positionName ?? item.title ?? item.jobTitle ?? "");
  const combined = `${titleText} ${desc}`;
  const { min, max } = extractRate(desc);
  const postedRaw = item.datePosted ?? item.postingDateParsed ?? item.scrapedAt ?? null;
  return {
    jobId: `indeed_${item.id ?? item.jobKey ?? String(item.url ?? "").split("jk=")[1]?.slice(0, 16) ?? Math.random().toString(36).slice(2)}`,
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
    datePosted: postedRaw ? new Date(postedRaw) : null,
    rawData: item,
  };
}

export async function scrapeIndeed(): Promise<ScrapedJob[]> {
  // misceres/indeed-scraper expects queries as plain strings + shared location/country
  const input = {
    queries: [
      "MES Engineer C2C contract",
      "SAP S4HANA C2C contract",
      "PLM Teamcenter C2C contract",
      "Pharma IT C2C contract",
    ],
    location: "United States",
    countryCode: "US",
    maxItems: 200,
  };

  const run = await apifyClient.actor("misceres/indeed-scraper").call(input, { waitSecs: 300 });
  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

  return (items as Record<string, unknown>[]).map(adapt);
}
