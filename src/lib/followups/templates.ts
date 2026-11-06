// Follow-up timing and email wording. No server imports: the Follow-ups page previews these.

export const FOLLOWUPS_SCREEN = { name: "Follow-ups", path: "/admin/follow-ups" };

export type FollowUpKind = "submission" | "interview";

/** At most this many follow-ups per submission and per interview */
export const MAX_FOLLOWUPS = 2;

/** Days after the submission (or after the interview day) that follow-up 1 is due; follow-up 2 is due this long after follow-up 1 */
export const FIRST_DUE_DAYS: Record<FollowUpKind, number> = { submission: 7, interview: 1 };
export const SECOND_DUE_DAYS = 7;

/** A due follow-up stays on the list this many days if it isn't sent on the day (weekends, leave) */
export const GRACE_DAYS = 6;

/** Statuses that need no follow-up: the outcome is already known */
export const CLOSED_STATUSES = ["Rejected", "Confirmation"];

export interface DraftContext {
  kind: FollowUpKind;
  sequence: number;
  vendorName: string;
  consultantName: string;
  technology: string;
  clientName: string | null;
  /** Label of the submission day or the interview day, e.g. "Mon, Nov 2" */
  dayLabel: string;
  interviewLevel?: string | null;
  senderName: string;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "there";

/** Subject when the original email isn't found in Sent and the follow-up goes out as a new email */
export function freshSubject(c: DraftContext) {
  const role = [c.technology, c.clientName].filter(Boolean).join(" – ");
  return c.kind === "submission"
    ? `Follow-up: ${c.consultantName} – ${role}`
    : `Interview feedback: ${c.consultantName} – ${role}`;
}

export function draftBody(c: DraftContext) {
  const role = `the ${c.technology} position${c.clientName ? ` with ${c.clientName}` : ""}`;
  const ask =
    c.kind === "submission"
      ? c.sequence === 1
        ? `I am following up on ${c.consultantName}'s profile that I submitted on ${c.dayLabel} for ${role}. Could you please let me know if there is any update, or any further movement towards an interview?`
        : `Just following up again on ${c.consultantName}'s profile that I submitted on ${c.dayLabel} for ${role}. Please let me know if the position is still open and if there is any feedback from the client.`
      : c.sequence === 1
        ? `Thank you for arranging ${c.consultantName}'s ${c.interviewLevel ? `${c.interviewLevel} ` : ""}interview on ${c.dayLabel} for ${role}. Could you please share the feedback and let me know the status and next steps?`
        : `Just following up again on the feedback for ${c.consultantName}'s ${c.interviewLevel ? `${c.interviewLevel} ` : ""}interview on ${c.dayLabel} for ${role}. Please let me know the status whenever you hear back from the client.`;

  return `Hi ${firstName(c.vendorName)},\n\nHope you are doing well.\n\n${ask}\n\nLooking forward to hearing from you.\n\nThanks & Regards,\n${c.senderName}`;
}
