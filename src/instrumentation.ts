export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { processAutoJobs } = await import("@/lib/autojobs");

  // AutoJobs worker: match pending runs and dispatch queued emails every 30s.
  setInterval(() => {
    void processAutoJobs();
  }, 30_000);
}
