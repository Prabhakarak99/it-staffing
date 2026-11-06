/**
 * ATS check: the share of the job description's key terms that appear in the resume text. The AI picks
 * the terms from the JD; the match itself is a plain text search, so the same resume always gets the
 * same score and the "before" and "after" numbers are directly comparable.
 */
export function atsScore(resumeText: string, keywords: string[]) {
  const text = ` ${resumeText.toLowerCase().replace(/\s+/g, " ")} `;
  const terms = [...new Set(keywords.map((k) => k.trim()).filter((k) => k.length > 1))];
  if (terms.length === 0) return { score: 0, matched: [] as string[], missing: [] as string[] };

  const matched: string[] = [];
  const missing: string[] = [];
  for (const term of terms) {
    const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    // Whole-term match so "Java" doesn't count inside "JavaScript"
    const found = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`).test(text);
    (found ? matched : missing).push(term);
  }
  return { score: Math.round((matched.length / terms.length) * 100), matched, missing };
}
