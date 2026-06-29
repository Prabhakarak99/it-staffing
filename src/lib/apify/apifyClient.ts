import ApifyClient from "apify-client";

if (!process.env.APIFY_TOKEN) {
  console.warn("[Apify] APIFY_TOKEN is not set — job scraping will not work.");
}

export const apifyClient = new ApifyClient({
  token: process.env.APIFY_TOKEN ?? "",
});
