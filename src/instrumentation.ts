export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Local testing on a copy of real data: no inbox reading, AutoJobs emails or job pulls
  if (process.env.DISABLE_BACKGROUND_JOBS === "1") {
    console.log("[startup] background jobs are off (DISABLE_BACKGROUND_JOBS=1)");
    return;
  }

  const { processAutoJobs } = await import("@/lib/autojobs");
  const { processJobFeed } = await import("@/lib/jobfeed/worker");
  const { ensureScreens, grantScreensOnce } = await import("@/lib/screens");
  const { processEmailStats } = await import("@/lib/gmail/stats");
  const { processRequirementInboxes } = await import("@/lib/requirements/scan");
  // Background work runs once per company, inside that company's scope (src/lib/tenant)
  const { asOriginalCompany, forEachCompany } = await import("@/lib/tenant/jobs");

  // Register screens added after the initial seed (e.g. Vendor Management) so User Roles can grant them.
  void ensureScreens().catch((err) => console.error("[screens] ensureScreens failed:", err));
  void forEachCompany("screens", grantScreensOnce);
  void import("@/lib/attendance/quotes")
    .then(({ ensureQuotes }) => ensureQuotes())
    .catch((err) => console.error("[attendance] ensureQuotes failed:", err));

  // One-time fixes from before companies existed: they only ever apply to GenFusion Tech's data
  void asOriginalCompany(async () => {
    const { migrateToCentralOnce } = await import("@/lib/tz-migration");
    await migrateToCentralOnce();
    const { undoRequirementSubmissionsOnce } = await import("@/lib/requirements/backfill");
    await undoRequirementSubmissionsOnce();
  }).catch((err) => console.error("[startup] one-time fixes failed:", err));

  // The shared job pool belongs to the platform; each company may also have its own sources
  void forEachCompany(
    "jobfeed-archive",
    async () => {
      const { archiveOldJobsOnce, archiveOldPostedJobsOnce, restoreYesterdayPostedJobsOnce } = await import("@/lib/jobfeed/archive");
      await archiveOldJobsOnce();
      await archiveOldPostedJobsOnce();
      await restoreYesterdayPostedJobsOnce();
    },
    { includePlatform: true },
  );

  // Appreciation: on the 1st, last month's top recruiters get their award (checked hourly; settled once)
  const settleAppreciation = () =>
    void forEachCompany("appreciation", async () => {
      const { ensureAppreciationAwards } = await import("@/lib/appreciation/data");
      await ensureAppreciationAwards();
    });
  settleAppreciation();
  setInterval(settleAppreciation, 60 * 60_000);

  // AutoJobs worker: match pending runs and dispatch queued emails every 30s.
  setInterval(() => void forEachCompany("autojobs", processAutoJobs), 30_000);

  // Job feed worker: crawl career sites, scheduled boards and AI classification (shared pool + company sources).
  setInterval(() => void forEachCompany("jobfeed", processJobFeed, { includePlatform: true }), 5 * 60_000);

  // Gmail counts: re-count each connected mailbox's received / sent mail (each at most every 15 min).
  setInterval(() => void forEachCompany("gmail-stats", processEmailStats), 5 * 60_000);

  // Vendor requirement emails: read each connected inbox for new requirements (each at most every 4 min).
  setInterval(() => void forEachCompany("requirements", processRequirementInboxes), 60_000);
}
