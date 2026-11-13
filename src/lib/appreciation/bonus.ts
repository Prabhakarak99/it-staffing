// Additional Bonus reasons. No server imports: the popup uses these too.

export const BONUS_REASONS = [
  { id: "placement", label: "Placement" },
  { id: "submissions", label: "Submissions" },
  { id: "interviews", label: "Interviews" },
  { id: "special-gift", label: "Special Gift" },
  { id: "other", label: "Other" },
] as const;

export type BonusReason = (typeof BONUS_REASONS)[number]["id"];

export const isBonusReason = (v: unknown): v is BonusReason => BONUS_REASONS.some((r) => r.id === v);

/** "Placement · Anusha P", "Other · Diwali gift", "Special Gift" */
export function bonusReasonLabel(b: { reason: string; otherReason: string | null; consultantName: string | null }) {
  const label = BONUS_REASONS.find((r) => r.id === b.reason)?.label ?? b.reason;
  if (b.reason === "other") return b.otherReason ? `Other · ${b.otherReason}` : label;
  return b.reason === "placement" && b.consultantName ? `${label} · ${b.consultantName}` : label;
}

export const MAX_BONUS = 1_000_000;
