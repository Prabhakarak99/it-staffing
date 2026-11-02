import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

// Cheapest current model; plenty for pulling structured fields out of a job post
export const AI_MODEL = "claude-haiku-5-5";
const BATCH_SIZE = 500;
// Guard against pathological pages (whole careers sites pasted into one posting)
const MAX_DESCRIPTION_CHARS = 40_000;

export function isAiConfigured() {
  return !!process.env.ANTHROPIC_API_KEY;
}

let client: Anthropic | null = null;
function getClient() {
  if (!isAiConfigured()) return null;
  client ??= new Anthropic();
  return client;
}

const nullable = (type: string) => ({ anyOf: [{ type }, { type: "null" }] });

const JOB_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "employmentType", "isContract", "rateMin", "rateMax", "rateUnit", "visa",
    "primaryTech", "skills", "clientName", "remote", "durationMonths", "vendor", "confidence",
  ],
  properties: {
    employmentType: { type: "string", enum: ["C2C", "C2C/W2", "W2", "1099", "Contract", "Full-time", "Unknown"] },
    isContract: { type: "boolean" },
    rateMin: nullable("integer"),
    rateMax: nullable("integer"),
    rateUnit: { type: "string", enum: ["hour", "year", "unknown"] },
    visa: { type: "array", items: { type: "string", enum: ["USC", "GC", "H1B", "TN", "OPT/CPT", "EAD", "Any"] } },
    primaryTech: nullable("string"),
    skills: { type: "array", items: { type: "string" } },
    clientName: nullable("string"),
    remote: { type: "boolean" },
    durationMonths: nullable("integer"),
    vendor: {
      type: "object",
      additionalProperties: false,
      required: ["name", "email", "phone"],
      properties: { name: nullable("string"), email: nullable("string"), phone: nullable("string") },
    },
    confidence: { type: "number" },
  },
} as const;

interface AiJob {
  employmentType: string;
  isContract: boolean;
  rateMin: number | null;
  rateMax: number | null;
  rateUnit: "hour" | "year" | "unknown";
  visa: string[];
  primaryTech: string | null;
  skills: string[];
  clientName: string | null;
  remote: boolean;
  durationMonths: number | null;
  vendor: { name: string | null; email: string | null; phone: string | null };
  confidence: number;
}

const SYSTEM_PROMPT = `You classify US IT job postings for a C2C staffing company.
Read the posting and fill every field of the JSON schema.

employmentType:
- "C2C" when corp-to-corp is allowed; "C2C/W2" when both are offered; "W2" for W2-only contracts; "1099" for 1099.
- "Contract" for a contract or contract-to-hire role that does not say C2C, W2 or 1099.
- "Full-time" for a permanent/direct-hire employee role (salary, benefits, "full-time employee").
- "Unknown" only when the posting gives no signal.
isContract: true for every contract type, false for Full-time.
rateMin/rateMax: pay as whole numbers in rateUnit; null when not stated. Do not convert salaries to hourly.
visa: work authorizations the posting accepts or requires; empty when not stated; "Any" when it says all visas are fine.
primaryTech: the single main technology or platform (e.g. "SAP S/4HANA", "Java", "Salesforce"). skills: up to 12 key technologies.
clientName: the end client if a staffing vendor names one, else null.
vendor: the recruiter or staffing contact named in the posting (not the end client), else nulls.
durationMonths: contract length in months when stated.
confidence: 0 to 1, how sure you are about employmentType.`;

function buildPrompt(job: { title: string | null; companyName: string | null; vendorName: string | null; location: string | null; jobDescription: string | null; rawData: unknown }) {
  const hint = (job.rawData as { employmentHint?: string | null } | null)?.employmentHint;
  return [
    `Title: ${job.title ?? ""}`,
    `Company: ${job.companyName ?? job.vendorName ?? ""}`,
    `Location: ${job.location ?? ""}`,
    hint ? `Career site employment type: ${hint}` : "",
    "",
    (job.jobDescription ?? "").slice(0, MAX_DESCRIPTION_CHARS),
  ].filter((l) => l !== "").join("\n");
}

/** Jobs waiting for AI: classifiedBy is null (rules weren't certain) */
export function pendingAiWhere() {
  return { classifiedBy: null, isActive: true, title: { not: null } };
}

/**
 * One step of the AI pipeline, called from the worker:
 * - a batch is in flight → collect it if it has ended
 * - no batch in flight → submit the next BATCH_SIZE pending jobs
 */
export async function runAiStep(config: { aiBatchId: string | null }) {
  const anthropic = getClient();
  if (!anthropic) return;

  if (config.aiBatchId) {
    await collectBatch(anthropic, config.aiBatchId);
    return;
  }

  const jobs = await prisma.jobSearchResult.findMany({
    where: pendingAiWhere(),
    orderBy: { createdAt: "desc" },
    take: BATCH_SIZE,
    select: { id: true, title: true, companyName: true, vendorName: true, location: true, jobDescription: true, rawData: true },
  });
  if (jobs.length === 0) return;

  const batch = await anthropic.messages.batches.create({
    requests: jobs.map((job) => ({
      custom_id: job.id,
      params: {
        model: AI_MODEL,
        max_tokens: 1024,
        thinking: { type: "disabled" },
        output_config: { effort: "low", format: { type: "json_schema", schema: JOB_SCHEMA } },
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildPrompt(job) }],
      },
    })),
  });

  await prisma.jobIngestConfig.update({
    where: { id: "singleton" },
    data: { aiBatchId: batch.id, aiBatchSubmittedAt: new Date() },
  });
  console.log(`[jobfeed] AI batch ${batch.id} submitted with ${jobs.length} jobs`);
}

async function collectBatch(anthropic: Anthropic, batchId: string) {
  let status: string;
  try {
    status = (await anthropic.messages.batches.retrieve(batchId)).processing_status;
  } catch (err) {
    if (err instanceof Anthropic.NotFoundError) {
      await clearBatch();
      return;
    }
    throw err;
  }
  if (status !== "ended") return;

  let ok = 0;
  let failed = 0;
  for await (const item of await anthropic.messages.batches.results(batchId)) {
    const jobId = item.custom_id;
    if (item.result.type !== "succeeded") {
      // A malformed request fails the same way every time; server errors / expiry are retried next batch
      if (item.result.type === "errored" && item.result.error.error.type === "invalid_request_error") {
        await prisma.jobSearchResult.update({
          where: { id: jobId },
          data: { classifiedBy: "ai_error", aiParsedAt: new Date() },
        }).catch(() => undefined);
      }
      failed++;
      continue;
    }
    const message = item.result.message;
    const text = message.content.find((b) => b.type === "text");
    let parsed: AiJob | null = null;
    if (message.stop_reason === "end_turn" && text?.type === "text") {
      try {
        parsed = JSON.parse(text.text) as AiJob;
      } catch {
        parsed = null;
      }
    }
    if (!parsed) {
      // Refusal, truncation or bad JSON — mark it so it isn't retried forever
      await prisma.jobSearchResult.update({
        where: { id: jobId },
        data: { classifiedBy: "ai_error", aiParsedAt: new Date() },
      }).catch(() => undefined);
      failed++;
      continue;
    }
    await applyAiResult(jobId, parsed).then(() => ok++, () => failed++);
  }

  await clearBatch();
  console.log(`[jobfeed] AI batch ${batchId} collected: ${ok} classified, ${failed} failed`);
}

async function applyAiResult(jobId: string, ai: AiJob) {
  const job = await prisma.jobSearchResult.findUnique({
    where: { id: jobId },
    select: { technology: true, technologies: true, visaRequirements: true, rateMin: true, rateMax: true, clientName: true, vendorEmail: true, vendorPhone: true, isRemote: true, sourceType: true, vendorName: true },
  });
  if (!job) return;

  const jobType = ai.isContract
    ? (ai.employmentType === "Full-time" || ai.employmentType === "Unknown" ? "Contract" : ai.employmentType)
    : "Full-time";
  const hourly = ai.rateUnit === "hour";
  const skills = [...new Set([...job.technologies, ...ai.skills])].slice(0, 15);

  await prisma.jobSearchResult.update({
    where: { id: jobId },
    data: {
      jobType,
      employmentType: ai.employmentType,
      isContract: ai.isContract,
      technology: ai.primaryTech ?? job.technology,
      technologies: skills,
      visaRequirements: ai.visa.length ? ai.visa : job.visaRequirements,
      rateMin: hourly && ai.rateMin ? ai.rateMin : job.rateMin,
      rateMax: hourly && ai.rateMax ? ai.rateMax : job.rateMax,
      clientName: job.clientName ?? ai.clientName,
      vendorEmail: job.vendorEmail ?? ai.vendor.email,
      vendorPhone: job.vendorPhone ?? ai.vendor.phone,
      // Career-site jobs keep the employer as vendorName; board/email jobs take the recruiter's firm
      vendorName: job.sourceType === "ats" ? job.vendorName : job.vendorName ?? ai.vendor.name,
      isRemote: job.isRemote || ai.remote,
      classifiedBy: "ai",
      aiParsedAt: new Date(),
      aiConfidence: ai.confidence,
    },
  });
}

async function clearBatch() {
  await prisma.jobIngestConfig.update({
    where: { id: "singleton" },
    data: { aiBatchId: null, aiBatchSubmittedAt: null },
  });
}
