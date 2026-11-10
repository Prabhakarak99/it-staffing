/**
 * ATS check: how well the resume covers the job description's key terms. The AI picks the terms from
 * the JD; the match itself is a plain text search, so the same resume always gets the same score and
 * the "before" and "after" numbers are directly comparable.
 *
 * Matching is forgiving the way real ATS parsers are: "PAS-X" = "PAS X" = "PASX", plurals count,
 * and "Manufacturing Execution System (MES)" is found as either the full name or "MES".
 */

export type KeywordPriority = "main" | "required" | "preferred";

/** Main skills weigh the most, like a recruiter screening the JD's top requirements */
export const PRIORITY_WEIGHT: Record<KeywordPriority, number> = { main: 3, required: 2, preferred: 1 };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** One spelling of a term → regex source: separators flexible, optional plural */
function variantSource(variant: string) {
  const parts = variant.toLowerCase().split(/[\s\-/_]+/).filter(Boolean);
  if (parts.length === 0) return null;
  let src = parts.map(escape).join("[\\s\\-/_]*");
  const last = parts[parts.length - 1];
  // "Pipelines", and for short acronyms "MBRs"
  if (/[a-z]$/.test(last)) src += last.length > 3 ? "(?:e?s)?" : "s?";
  return src;
}

/** "Manufacturing Execution System (MES)" → full name, the name without the acronym, and "MES" */
function variantsOf(term: string) {
  const t = term.trim();
  const out = new Set([t]);
  const paren = t.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (paren) {
    if (paren[1].trim()) out.add(paren[1].trim());
    if (paren[2].trim()) out.add(paren[2].trim());
  }
  return [...out];
}

const cache = new Map<string, RegExp>();

/** Global, case-insensitive whole-term regex for a keyword */
export function termRegex(term: string) {
  const key = term.trim().toLowerCase();
  let re = cache.get(key);
  if (!re) {
    const alts = variantsOf(term).map(variantSource).filter(Boolean);
    // Whole-term so "Java" doesn't count inside "JavaScript"
    re = new RegExp(`(?<![a-z0-9])(?:${alts.join("|") || escape(key)})(?![a-z0-9])`, "gi");
    if (cache.size > 2000) cache.clear();
    cache.set(key, re);
  }
  re.lastIndex = 0;
  return re;
}

/** How many times the keyword appears in the text */
export function countTerm(text: string, term: string) {
  return text.match(termRegex(term))?.length ?? 0;
}

export interface KeywordTarget {
  term: string;
  priority: KeywordPriority;
}

/**
 * Weighted coverage: the share of the JD's keyword weight the resume contains (main skills count 3×,
 * required 2×, preferred 1×). Plain strings are treated as required.
 */
export function atsScore(resumeText: string, keywords: (string | KeywordTarget)[]) {
  const text = resumeText.replace(/\s+/g, " ");
  const seen = new Set<string>();
  const terms: KeywordTarget[] = [];
  for (const k of keywords) {
    const t = typeof k === "string" ? { term: k.trim(), priority: "required" as const } : { ...k, term: k.term.trim() };
    if (t.term.length < 2 || seen.has(t.term.toLowerCase())) continue;
    seen.add(t.term.toLowerCase());
    terms.push(t);
  }
  if (terms.length === 0) return { score: 0, matched: [] as string[], missing: [] as string[], counts: {} as Record<string, number> };

  const matched: string[] = [];
  const missing: string[] = [];
  const counts: Record<string, number> = {};
  let got = 0;
  let total = 0;
  for (const t of terms) {
    const n = countTerm(text, t.term);
    counts[t.term] = n;
    const w = PRIORITY_WEIGHT[t.priority] ?? 2;
    total += w;
    if (n > 0) {
      got += w;
      matched.push(t.term);
    } else {
      missing.push(t.term);
    }
  }
  return { score: Math.round((got / total) * 100), matched, missing, counts };
}
