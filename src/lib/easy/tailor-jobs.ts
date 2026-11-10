import { randomBytes } from "crypto";
import { AiError } from "@/lib/ai/providers";
import { tailorResume, type TailorInput } from "./tailor";

/**
 * AI resume updates take a minute or two, longer than a proxy will hold an idle request, so they run
 * in the background and the page polls. Jobs live in memory: the app runs on a single machine.
 */
export interface TailorJob {
  userId: string;
  status: "running" | "done" | "failed";
  result?: { id: string; file: string; name: string; atsBefore: number; atsAfter: number; missing: string[]; createdAt: string };
  error?: string;
  startedAt: number;
}

const jobs = ((globalThis as { __tailorJobs?: Map<string, TailorJob> }).__tailorJobs ??= new Map());
const KEEP_MS = 30 * 60_000;

/**
 * At most this many resumes are written at the same time (each is 2–3 AI calls); the rest wait their
 * turn, so "Generate All" for a big team doesn't hit the AI provider's rate limits.
 */
const MAX_PARALLEL = 4;
const slots = ((globalThis as { __tailorSlots?: { running: number; waiting: (() => void)[] } }).__tailorSlots ??= { running: 0, waiting: [] });

async function withSlot<T>(run: () => Promise<T>): Promise<T> {
  if (slots.running >= MAX_PARALLEL) await new Promise<void>((resolve) => slots.waiting.push(resolve));
  else slots.running++;
  try {
    return await run();
  } finally {
    const next = slots.waiting.shift();
    if (next) next(); // hand the slot straight to the next job
    else slots.running--;
  }
}

export function startTailorJob(input: TailorInput) {
  const { userId } = input;
  for (const [id, job] of jobs) if (Date.now() - job.startedAt > KEEP_MS) jobs.delete(id);

  const id = randomBytes(12).toString("hex");
  const job: TailorJob = { userId, status: "running", startedAt: Date.now() };
  jobs.set(id, job);

  withSlot(() => tailorResume(input))
    .then((t) => {
      const keywords = t.keywords as { missing?: string[] };
      job.status = "done";
      job.result = {
        id: t.id, file: t.file, name: t.fileName, atsBefore: t.atsBefore, atsAfter: t.atsAfter,
        missing: keywords.missing ?? [], createdAt: t.createdAt.toISOString(),
      };
    })
    .catch((err: unknown) => {
      job.status = "failed";
      job.error = err instanceof AiError ? err.message : "Could not update the resume. Please try again.";
      if (!(err instanceof AiError)) console.error("[resumes] tailor failed:", err);
    });
  return id;
}

/** Only the user who started a job can read it */
export function getTailorJob(id: string, userId: string) {
  const job = jobs.get(id);
  return job && job.userId === userId ? job : null;
}
