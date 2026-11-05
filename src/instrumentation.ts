export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { processAutoJobs } = await import("@/lib/autojobs");
  const { processJobFeed } = await import("@/lib/jobfeed/worker");
  const { ensureScreens, grantScreensOnce } = await import("@/lib/screens");
  const { processEmailStats } = await import("@/lib/gmail/stats");

  // Register screens added after the initial seed (e.g. Vendor Management) so User Roles can grant them.
  void ensureScreens().catch((err) => console.error("[screens] ensureScreens failed:", err));
  void grantScreensOnce().catch((err) => console.error("[screens] grantScreensOnce failed:", err));

  // AutoJobs worker: match pending runs and dispatch queued emails every 30s.
  setInterval(() => {
    void processAutoJobs();
  }, 30_000);

  // Job feed worker: crawl company career sites, scheduled Apify boards and AI classification.
  // Each company is crawled at most once per crawlIntervalMin; the 5-min tick just picks up what's due.
  setInterval(() => {
    void processJobFeed();
  }, 5 * 60_000);

  // Gmail counts: re-count each connected mailbox's received / sent mail (each at most every 15 min).
  setInterval(() => {
    void processEmailStats();
  }, 5 * 60_000);
}
