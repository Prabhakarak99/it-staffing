import { prisma } from "@/lib/prisma";
import { addDays, fmtDayKey, keyToDate, todayKey } from "@/lib/attendance/dates";
import { dayRange } from "@/lib/easy/data";
import {
  CLOSED_STATUSES, FIRST_DUE_DAYS, GRACE_DAYS, MAX_FOLLOWUPS, SECOND_DUE_DAYS,
  draftBody, type FollowUpKind,
} from "./templates";

export interface FollowUpItem {
  key: string;
  kind: FollowUpKind;
  /** Submission id, or interview id for interviews */
  id: string;
  submissionId: string;
  submissionCode: string;
  /** The follow-up that is due, or the one sent today */
  sequence: number;
  state: "due" | "sent";
  dueDay: string;
  daysLate: number;
  /** Submission day, or the interview day */
  day: string;
  dayLabel: string;
  interviewLevel: string | null;
  consultantName: string;
  technology: string;
  clientName: string | null;
  vendorCompany: string;
  vendorName: string;
  vendorEmail: string;
  recruiterId: string;
  recruiterName: string;
  sentAt: string | null;
  /** Previous follow-ups already sent for this item */
  sentCount: number;
  body: string;
}

/** Look back far enough to cover follow-up 2 sent late: 7 + grace + 7 + grace days, with room */
const LOOKBACK_DAYS = 40;

const fullName = (u: { firstName: string; lastName: string } | null | undefined) => (u ? `${u.firstName} ${u.lastName}`.trim() : "");
const daysBetween = (from: string, to: string) => Math.round((keyToDate(to).getTime() - keyToDate(from).getTime()) / 86_400_000);

/**
 * Where an item stands today: the next follow-up when it's due (within the grace days), the last one
 * when it went out today, or nothing.
 */
function standing(kind: FollowUpKind, day: string, sent: Date[], today: string) {
  const last = sent.at(-1);
  if (last && todayKey(last) === today) return { state: "sent" as const, sequence: sent.length, dueDay: today, daysLate: 0, sentAt: last };
  if (sent.length >= MAX_FOLLOWUPS) return null;
  const dueDay = sent.length === 0 ? addDays(day, FIRST_DUE_DAYS[kind]) : addDays(todayKey(sent[0]), SECOND_DUE_DAYS);
  const daysLate = daysBetween(dueDay, today);
  if (daysLate < 0 || daysLate > GRACE_DAYS) return null;
  return { state: "due" as const, sequence: sent.length + 1, dueDay, daysLate, sentAt: last ?? null };
}

/**
 * Follow-ups due today (or sent today) for one recruiter, or for everyone when `recruiterId` is null.
 * Submissions: a week after submitting, then a week later; skipped once an interview is scheduled or
 * the status is closed. Interviews: the day after, then a week later; skipped once a later round exists.
 */
export async function listFollowUps(recruiterId: string | null): Promise<FollowUpItem[]> {
  const today = todayKey();
  const since = dayRange(addDays(today, -LOOKBACK_DAYS)).start;
  const todayStart = dayRange(today).start;
  const mine = recruiterId ? { recruiterId } : {};
  const person = { select: { firstName: true, lastName: true } };
  const sentOnly = { where: { status: "sent" }, select: { createdAt: true }, orderBy: { createdAt: "asc" as const } };

  const [submissions, interviews, sender] = await Promise.all([
    prisma.submission.findMany({
      where: { ...mine, submissionDate: { gte: since }, status: { notIn: CLOSED_STATUSES } },
      include: {
        consultant: person,
        recruiter: person,
        _count: { select: { interviews: true } },
        followUps: { ...sentOnly, where: { status: "sent", kind: "submission" } },
      },
    }),
    prisma.interview.findMany({
      where: { ...mine, interviewStartDate: { gte: since, lt: todayStart }, interviewStatus: { notIn: CLOSED_STATUSES } },
      include: {
        recruiter: person,
        submission: { include: { consultant: person, interviews: { select: { id: true, interviewStartDate: true } } } },
        followUps: sentOnly,
      },
    }),
    recruiterId ? prisma.user.findUnique({ where: { id: recruiterId }, select: { firstName: true, lastName: true, emailSignature: true } }) : null,
  ]);

  const items: FollowUpItem[] = [];

  for (const s of submissions) {
    const day = todayKey(s.submissionDate);
    const st = standing("submission", day, s.followUps.map((f) => f.createdAt), today);
    // Once an interview is on, the interview follow-ups take over
    if (!st || (st.state === "due" && s._count.interviews > 0)) continue;
    const ctx = {
      consultantName: fullName(s.consultant), technology: s.technology, clientName: s.clientName,
      vendorName: s.vendorRecruiterName, dayLabel: fmtDayKey(day),
    };
    items.push({
      key: `submission:${s.id}`, kind: "submission", id: s.id, submissionId: s.id, submissionCode: s.submissionId,
      sequence: st.sequence, state: st.state, dueDay: st.dueDay, daysLate: st.daysLate, day, dayLabel: ctx.dayLabel,
      interviewLevel: null, consultantName: ctx.consultantName, technology: s.technology, clientName: s.clientName,
      vendorCompany: s.vendorCompany, vendorName: s.vendorRecruiterName, vendorEmail: s.vendorRecruiterEmail,
      recruiterId: s.recruiterId, recruiterName: fullName(s.recruiter),
      sentAt: st.sentAt?.toISOString() ?? null, sentCount: s.followUps.length,
      body: draftBody({ kind: "submission", sequence: st.sequence, ...ctx, senderName: fullName(sender ?? s.recruiter), signature: sender?.emailSignature }),
    });
  }

  for (const iv of interviews) {
    const day = todayKey(iv.interviewStartDate);
    const st = standing("interview", day, iv.followUps.map((f) => f.createdAt), today);
    const laterRound = iv.submission.interviews.some((o) => o.id !== iv.id && o.interviewStartDate > iv.interviewStartDate);
    if (!st || (st.state === "due" && laterRound)) continue;
    const sub = iv.submission;
    const ctx = {
      consultantName: fullName(sub.consultant), technology: sub.technology, clientName: sub.clientName,
      vendorName: sub.vendorRecruiterName, dayLabel: fmtDayKey(day), interviewLevel: iv.interviewLevel,
    };
    items.push({
      key: `interview:${iv.id}`, kind: "interview", id: iv.id, submissionId: sub.id, submissionCode: sub.submissionId,
      sequence: st.sequence, state: st.state, dueDay: st.dueDay, daysLate: st.daysLate, day, dayLabel: ctx.dayLabel,
      interviewLevel: iv.interviewLevel, consultantName: ctx.consultantName, technology: sub.technology, clientName: sub.clientName,
      vendorCompany: sub.vendorCompany, vendorName: sub.vendorRecruiterName, vendorEmail: sub.vendorRecruiterEmail,
      recruiterId: iv.recruiterId, recruiterName: fullName(iv.recruiter),
      sentAt: st.sentAt?.toISOString() ?? null, sentCount: iv.followUps.length,
      body: draftBody({ kind: "interview", sequence: st.sequence, ...ctx, senderName: fullName(sender ?? iv.recruiter), signature: sender?.emailSignature }),
    });
  }

  // Due first (most overdue on top), then the ones already sent today
  return items.sort(
    (a, b) => Number(a.state === "sent") - Number(b.state === "sent") || b.daysLate - a.daysLate || a.day.localeCompare(b.day) || a.consultantName.localeCompare(b.consultantName),
  );
}
