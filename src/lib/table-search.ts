/** Filter rows where any searchable field contains the query (case-insensitive). */
export function filterBySearch<T>(
  items: T[],
  query: string,
  getSearchText: (item: T) => string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => getSearchText(item).toLowerCase().includes(q));
}

/** Join values into a single searchable string. */
export function searchBlob(...parts: (string | number | null | undefined)[]): string {
  return parts.filter((p) => p != null && p !== "").map(String).join(" ");
}
