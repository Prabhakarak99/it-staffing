import { htmlToText } from "../rules";
import { atsJobId, buildAtsJob, fetchJson, inScope, seenStub, toDate, type AtsAdapter } from "./common";

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string;
  createdAt?: number;
  workplaceType?: string; // remote | onsite | hybrid
  categories?: { commitment?: string; location?: string; allLocations?: string[]; team?: string };
  descriptionPlain?: string;
  lists?: { text: string; content: string }[];
  additionalPlain?: string;
}

// Public Postings API — no auth: https://github.com/lever/postings-api
export const crawlLever: AtsAdapter = async (company, ctx) => {
  const postings = await fetchJson<LeverPosting[]>(
    `https://api.lever.co/v0/postings/${encodeURIComponent(company.boardToken)}?mode=json`,
  );
  const candidates = postings.filter((p) => inScope(p.text, p.categories?.location));
  const ids = candidates.map((p) => atsJobId(company, p.id));
  const known = await ctx.existing(ids);

  const jobs = candidates.map((p, i) => {
    if (known.has(ids[i])) return seenStub(company, ids[i]);
    const description = [
      p.descriptionPlain ?? "",
      ...(p.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`),
      p.additionalPlain ?? "",
    ].filter(Boolean).join("\n\n");
    return buildAtsJob(company, {
      jobId: ids[i],
      title: p.text,
      location: p.categories?.location ?? null,
      description,
      applyLink: p.applyUrl ?? p.hostedUrl,
      datePosted: toDate(p.createdAt),
      isRemote: p.workplaceType === "remote" || undefined,
      employmentHint: p.categories?.commitment ?? null,
      raw: { leverId: p.id, team: p.categories?.team ?? null },
    });
  });

  return { jobs, totalOnBoard: postings.length };
};
