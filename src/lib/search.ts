/**
 * Person search used by the pickers (consultants, recruiters, tech support).
 * Ignores capitals, and "john sm" matches John Smith: every typed word must hit the first name,
 * last name or email. Returns undefined for an empty query (no filter).
 */
export function personSearchWhere(query: string | null | undefined) {
  const words = (query ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return undefined;
  return {
    AND: words.map((w) => ({
      OR: [
        { firstName: { contains: w, mode: "insensitive" as const } },
        { lastName: { contains: w, mode: "insensitive" as const } },
        { email: { contains: w, mode: "insensitive" as const } },
      ],
    })),
  };
}
