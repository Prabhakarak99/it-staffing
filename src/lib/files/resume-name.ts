/**
 * Every resume the app hands out is named the same way: "First_Last_Resume.<ext>" (the uploaded or
 * AI file's own name is never shown to vendors).
 */
export function resumeName(person: { firstName: string; lastName: string } | string, ext: string) {
  const full = typeof person === "string" ? person : `${person.firstName} ${person.lastName}`;
  const base = full.normalize("NFKD").replace(/[^\w ]+/g, "").trim().replace(/\s+/g, "_") || "Consultant";
  return `${base}_Resume.${ext.replace(/^\./, "").toLowerCase() || "docx"}`;
}
