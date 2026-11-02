import { atsJobId, buildAtsJob, fetchJson, inScope, seenStub, toDate, type AtsAdapter } from "./common";

interface AshbyJob {
  id: string;
  title: string;
  location?: string;
  employmentType?: string; // FullTime | PartTime | Contract | Intern | Temporary
  isRemote?: boolean;
  isListed?: boolean;
  descriptionPlain?: string;
  jobUrl?: string;
  applyUrl?: string;
  publishedAt?: string;
  address?: { postalAddress?: { addressCountry?: string } };
  compensation?: { compensationTierSummary?: string | null };
}

// Public Job Posting API — no auth: https://developers.ashbyhq.com/docs/public-job-posting-api
export const crawlAshby: AtsAdapter = async (company, ctx) => {
  const data = await fetchJson<{ jobs: AshbyJob[] }>(
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(company.boardToken)}?includeCompensation=true`,
  );
  const listed = (data.jobs ?? []).filter((j) => j.isListed !== false);
  const where = (j: AshbyJob) => [j.location, j.address?.postalAddress?.addressCountry].filter(Boolean).join(", ");
  const candidates = listed.filter((j) => inScope(j.title, where(j)));
  const ids = candidates.map((j) => atsJobId(company, j.id));
  const known = await ctx.existing(ids);

  const jobs = candidates.map((j, i) => {
    if (known.has(ids[i])) return seenStub(company, ids[i]);
    const comp = j.compensation?.compensationTierSummary;
    return buildAtsJob(company, {
      jobId: ids[i],
      title: j.title,
      location: j.location ?? null,
      // Keep the pay summary in the text so the rate rules / AI can read it
      description: [comp ? `Compensation: ${comp}` : "", j.descriptionPlain ?? ""].filter(Boolean).join("\n\n"),
      applyLink: j.applyUrl ?? j.jobUrl ?? null,
      datePosted: toDate(j.publishedAt),
      isRemote: j.isRemote || undefined,
      employmentHint: j.employmentType ?? null,
      raw: { ashbyId: j.id },
    });
  });

  return { jobs, totalOnBoard: listed.length };
};
