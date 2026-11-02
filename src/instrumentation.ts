export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { processAutoJobs } = await import("@/lib/autojobs");
  const { processJobFeed } = await import("@/lib/jobfeed/worker");

  // AutoJobs worker: match pending runs and dispatch queued emails every 30s.
  setInterval(() => {
    void processAutoJobs();
  }, 30_000);

  // Job feed worker: crawl company career sites, scheduled Apify boards and AI classification.
  // Each company is crawled at most once per crawlIntervalMin; the 5-min tick just picks up what's due.
  setInterval(() => {
    void processJobFeed();
  }, 5 * 60_000);
}
