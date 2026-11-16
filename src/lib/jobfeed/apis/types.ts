// Shared shapes for the job-data API connectors. Each connector file depends only on this file and
// `fetch`, so it can be lifted into another system as is.

/** A job as returned by any provider, before our own classification */
export interface ApiJob {
  /** The provider's own id for the job (stable between runs) */
  externalId: string;
  title: string | null;
  company: string | null;
  /** Where the job was found, when it differs from the provider (e.g. "LinkedIn" from a job-board feed) */
  sourceLabel?: string;
  /** The recruiter or poster, when the provider names one */
  contactName?: string | null;
  location: string | null;
  /** Plain text */
  description: string;
  applyUrl: string | null;
  postedAt: Date | null;
  /** The provider's employment type, as given ("contract", "CONTRACTOR", "Full-Time", ...) */
  employmentHint: string | null;
  isRemote?: boolean;
  raw?: Record<string, unknown>;
}

export interface ApiRunConfig {
  apiKey: string;
  keywords: string[];
  contractOnly: boolean;
  /** Most jobs to return (and to pay for) in this run */
  maxJobs: number;
  /** Only jobs posted in this many hours (rounded up from `since`) */
  sinceHours: number;
  /** The exact moment the previous pull covered up to; jobs before it were already fetched */
  since: Date;
  /** Extra provider-specific settings typed by the admin (query parameters / input fields) */
  extra: Record<string, string>;
  /** Pages to read (Zyte only) */
  startUrls: string[];
  /** Which of these external ids are already stored, so pay-per-job providers skip them */
  isKnown: (externalIds: string[]) => Promise<Set<string>>;
}

export type JobApiConnector = (cfg: ApiRunConfig) => Promise<ApiJob[]>;

export class JobApiError extends Error {}

/** JSON request with a timeout; throws JobApiError with the provider's own message on a non-2xx reply */
export async function apiJson<T>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const { timeoutMs = 30_000, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, { ...rest, headers: { Accept: "application/json", ...(rest.headers ?? {}) }, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  } catch (err) {
    throw new JobApiError(`Could not reach ${new URL(url).host}: ${err instanceof Error ? err.message : "network error"}`);
  }
  const text = await res.text();
  if (!res.ok) {
    const hint = res.status === 401 || res.status === 403 ? " (the API key was not accepted)" : res.status === 402 || res.status === 429 ? " (out of credits or rate limited)" : "";
    throw new JobApiError(`${new URL(url).host} answered ${res.status}${hint}: ${text.replace(/\s+/g, " ").slice(0, 200) || res.statusText}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new JobApiError(`${new URL(url).host} did not return JSON: ${text.slice(0, 120)}`);
  }
}

type Rec = Record<string, unknown>;

/** The list of records in a reply, whether it is a bare array or wrapped in data / jobs / results / items */
export function rowsOf(reply: unknown): Rec[] {
  if (Array.isArray(reply)) return reply as Rec[];
  if (reply && typeof reply === "object") {
    for (const k of ["data", "jobs", "results", "items", "hits"]) {
      const v = (reply as Rec)[k];
      if (Array.isArray(v)) return v as Rec[];
    }
  }
  return [];
}

/** First non-empty value among several possible field names (dotted paths allowed), as text */
export function pick(rec: Rec, ...paths: string[]): string | null {
  for (const path of paths) {
    let v: unknown = rec;
    for (const part of path.split(".")) v = v && typeof v === "object" ? (v as Rec)[part] : undefined;
    if (Array.isArray(v)) v = v.find((x) => typeof x === "string" && x.trim());
    if (typeof v === "number") return String(v);
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** ISO strings, "yyyy-MM-dd HH:mm:ss", and Unix seconds / milliseconds */
export function toDate(v: string | null): Date | null {
  if (!v) return null;
  const d = /^\d{9,13}$/.test(v) ? new Date(Number(v) * (v.length <= 10 ? 1000 : 1)) : new Date(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(v) ? `${v.replace(" ", "T")}Z` : v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const stripHtml = (s: string | null) =>
  (s ?? "").replace(/<\s*(br|\/p|\/li|\/div|\/h\d)\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();

/** Jobs per keyword so the whole run stays within maxJobs */
export const perKeyword = (cfg: ApiRunConfig) => Math.max(1, Math.ceil(cfg.maxJobs / Math.max(1, cfg.keywords.length)));
