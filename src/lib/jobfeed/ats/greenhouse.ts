import { htmlToText } from "../rules";
import { atsJobId, buildAtsJob, fetchJson, inScope, seenStub, toDate, type AtsAdapter } from "./common";

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  updated_at?: string;
  first_published?: string;
  location?: { name?: string };
  content?: string; // entity-escaped HTML
  metadata?: { name: string; value: unknown }[] | null;
}

// Public Job Board API — no auth: https://developers.greenhouse.io/job-board.html
export const crawlGreenhouse: AtsAdapter = async (company, ctx) => {
  const data = await fetchJson<{ jobs: GreenhouseJob[] }>(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(company.boardToken)}/jobs?content=true`,
  );
  const jobsOnBoard = data.jobs ?? [];
  const candidates = jobsOnBoard.filter((j) => inScope(j.title, j.location?.name));
  const ids = candidates.map((j) => atsJobId(company, j.id));
  const known = await ctx.existing(ids);

  const jobs = candidates.map((j, i) => {
    if (known.has(ids[i])) return seenStub(company, ids[i]);
    // Some boards tag employment type in custom metadata fields
    const hint = (j.metadata ?? [])
      .filter((m) => /employment|type|commitment/i.test(m.name))
      .map((m) => String(m.value ?? ""))
      .join(" ");
    return buildAtsJob(company, {
      jobId: ids[i],
      title: j.title,
      location: j.location?.name ?? null,
      description: htmlToText(j.content),
      applyLink: j.absolute_url,
      datePosted: toDate(j.first_published ?? j.updated_at),
      employmentHint: hint || null,
      raw: { greenhouseId: j.id },
    });
  });

  return { jobs, totalOnBoard: jobsOnBoard.length };
};
