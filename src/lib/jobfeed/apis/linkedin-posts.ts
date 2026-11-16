import { apiJson, perKeyword, pick, rowsOf, toDate, type ApiJob, type JobApiConnector } from "./types";

const ACTOR = "harvestapi~linkedin-post-search";

// Words that mark a post as a job requirement, and ones that mark it as something else
const REQUIREMENT_RE = /\b(c2c|corp[- ]?to[- ]?corp|w-?2|1099|contract|requirement|hiring|opening|position|job title|role\s*:|duration|looking for an?\b)/i;
const NOT_A_JOB_RE = /\b(hot ?list|bench (sales|list|consultants?)|available consultants?|consultants? available|open to work|#opentowork|i am looking for|i'm looking for|actively looking|seeking (a )?(new )?(role|opportunit)|training|course|webinar|certification batch)\b/i;

const clean = (s: string) => s.replace(/[#*_`•●▪■►➤✅🔥📍📌💼🚀👉⭐️]+/gu, " ").replace(/\s+/g, " ").trim();

/** "Role: Java Developer" style line, else the first line that reads like a title */
function titleOf(text: string, keyword: string): string {
  const labelled = /(?:job\s*title|job\s*role|position|role|title|hiring(?:\s+for)?|requirement(?:\s+for)?|looking for(?: an?)?)\s*[:\-–—]\s*([^\n|]{3,120})/i.exec(text);
  if (labelled) return clean(labelled[1]).slice(0, 120);
  const line = text.split("\n").map(clean).find((l) => l.length >= 8 && new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(l));
  return (line ?? clean(text.split("\n")[0] ?? "")).slice(0, 120) || `${keyword} requirement`;
}

const locationOf = (text: string) => {
  const m = /(?:location|loc|work location)\s*[:\-–—]\s*([^\n|]{2,80})/i.exec(text);
  return m ? clean(m[1]) : null;
};

// LinkedIn posts — https://apify.com/harvestapi/linkedin-post-search (public posts, no LinkedIn login).
// One actor run searches every title; billing is per post read, so only posts newer than the last
// pull are requested, and posts that are not job requirements are dropped.
export const linkedinPosts: JobApiConnector = async (cfg) => {
  const terms = cfg.contractOnly ? ' AND (C2C OR W2 OR contract)' : " AND (hiring OR requirement)";
  const input = {
    searchQueries: cfg.keywords.map((k) => `"${k.replace(/"/g, "")}"${terms}`),
    maxPosts: perKeyword(cfg),
    postedLimitDate: cfg.since.toISOString(),
    sortBy: "date",
    scrapeReactions: false,
    scrapeComments: false,
    ...cfg.extra,
  };
  const reply = await apiJson<unknown>(`https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?format=json&clean=true`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
    timeoutMs: 280_000,
  });

  const jobs: ApiJob[] = [];
  const seen = new Set<string>();
  for (const r of rowsOf(reply)) {
    const id = pick(r, "id", "linkedinUrl");
    const text = pick(r, "content", "text") ?? "";
    if (!id || seen.has(id) || text.length < 60) continue;
    seen.add(id);
    if (!REQUIREMENT_RE.test(text) || NOT_A_JOB_RE.test(text)) continue;
    const keyword = cfg.keywords.find((k) => text.toLowerCase().includes(k.toLowerCase())) ?? cfg.keywords[0] ?? "";
    jobs.push({
      externalId: id,
      title: titleOf(text, keyword),
      company: pick(r, "author.name"),
      contactName: pick(r, "author.name"),
      location: locationOf(text),
      description: text,
      applyUrl: pick(r, "linkedinUrl"),
      postedAt: toDate(pick(r, "postedAt.date", "postedAt.timestamp")),
      employmentHint: /\b(c2c|corp[- ]?to[- ]?corp|contract)\b/i.test(text) ? "contract" : null,
      raw: { authorUrl: pick(r, "author.linkedinUrl"), authorInfo: pick(r, "author.info") },
    });
  }
  return jobs;
};
