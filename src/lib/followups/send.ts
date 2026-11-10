import { prisma } from "@/lib/prisma";
import { sendVendorEmail } from "@/lib/email";
import { findMessage } from "@/lib/gmail/api";
import { sendMail } from "@/lib/gmail/compose";
import { GmailNotConnectedError, isGmailConfigured } from "@/lib/gmail/oauth";
import { syncEmailStats } from "@/lib/gmail/stats";
import { listFollowUps, type FollowUpItem } from "./data";
import { FOLLOWUP_CATEGORY, followUpVars, freshSubject, type FollowUpKind } from "./templates";
import { fillFields, renderBody } from "@/lib/email-templates/render";

export class FollowUpError extends Error {}

interface Thread {
  threadId: string;
  subject: string;
  inReplyTo: string | null;
  references: string | null;
}

const DAY_S = 86_400;
const quote = (s: string) => `"${s.replace(/"/g, "")}"`;

/**
 * The email this follow-up replies to: the thread of an earlier follow-up, otherwise the recruiter's
 * own sent email to the vendor about this consultant (the rate confirmation) around the submission day.
 */
async function findThread(userId: string, item: FollowUpItem, submittedAt: Date): Promise<Thread | null> {
  const earlier = await prisma.followUp.findFirst({
    where: { submissionId: item.submissionId, senderId: userId, status: "sent", via: "gmail", threadId: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  if (earlier?.threadId) {
    return { threadId: earlier.threadId, subject: earlier.subject, inReplyTo: earlier.inReplyTo, references: null };
  }

  const t = Math.floor(submittedAt.getTime() / 1000);
  const around = `after:${t - 3 * DAY_S} before:${t + 3 * DAY_S}`;
  const to = `in:sent to:${item.vendorEmail}`;
  const first = item.consultantName.split(/\s+/)[0];
  const searches = [
    `${to} ${quote(item.consultantName)} ${around}`,
    ...(first && first !== item.consultantName ? [`${to} ${quote(first)} ${around}`] : []),
    `${to} ${around}`,
    // Interviews can come weeks later; the latest email to the vendor about the consultant still fits
    ...(item.kind === "interview" ? [`${to} ${quote(item.consultantName)} newer_than:60d`] : []),
  ];
  for (const q of searches) {
    const msg = await findMessage(userId, q);
    if (msg) return { threadId: msg.threadId, subject: msg.subject, inReplyTo: msg.messageId, references: msg.references };
  }
  return null;
}

const replySubject = (subject: string) => (/^re:/i.test(subject.trim()) ? subject.trim() : `Re: ${subject.trim()}`);

/**
 * Sends the due follow-up for one of the sender's own submissions or interviews: from their Gmail as a
 * reply in the original thread when found, otherwise as a new email (company mailbox without Gmail).
 */
export async function sendFollowUp(senderId: string, kind: FollowUpKind, id: string, templateId: string | null = null) {
  const item = (await listFollowUps(senderId)).find((i) => i.kind === kind && i.id === id);
  if (!item) throw new FollowUpError("This follow-up isn't due. It may have been sent already, or the submission is closed.");
  if (item.state === "sent") throw new FollowUpError("This follow-up was already sent today.");
  if (!item.vendorEmail?.includes("@")) throw new FollowUpError("This submission has no vendor email.");

  const [sender, submission] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: senderId }, select: { firstName: true, lastName: true, email: true, emailSignature: true } }),
    prisma.submission.findUniqueOrThrow({ where: { id: item.submissionId }, select: { submissionDate: true } }),
  ]);
  const senderName = `${sender.firstName} ${sender.lastName}`.trim() || sender.email;
  // The sender's own template when one is picked (it must be theirs and for follow-ups)
  const template = templateId
    ? await prisma.emailTemplate.findFirst({ where: { id: templateId, userId: senderId, category: { in: [FOLLOWUP_CATEGORY[kind], "general"] } } })
    : null;
  if (templateId && !template) throw new FollowUpError("That template wasn't found. Pick another one.");
  const vars = template ? followUpVars(item, { name: senderName, email: sender.email, signature: sender.emailSignature }) : null;
  const body = template && vars ? renderBody(template.body, vars) : item.body;
  // Used only when the original email isn't found; a reply keeps "Re: <original subject>" so it threads
  const fresh = (template && vars && fillFields(template.subject, vars).trim()) || freshSubject({ ...item, sequence: item.sequence, senderName });

  let via: "gmail" | "smtp" =
    (await isGmailConfigured()) &&
    !!(await prisma.gmailAccount.findFirst({ where: { userId: senderId, lastError: null }, select: { id: true } }))
      ? "gmail"
      : "smtp";
  let thread: Thread | null = null;
  let subject = fresh;
  let error: string | null = null;

  try {
    if (via === "gmail") {
      try {
        thread = await findThread(senderId, item, submission.submissionDate);
        subject = thread ? replySubject(thread.subject || fresh) : fresh;
        await sendMail(senderId, {
          to: item.vendorEmail,
          subject,
          body,
          thread: thread ? { threadId: thread.threadId, inReplyTo: thread.inReplyTo, references: thread.references } : undefined,
        });
      } catch (err) {
        if (!(err instanceof GmailNotConnectedError)) throw err;
        via = "smtp"; // Gmail access expired: send through the company mailbox instead
        thread = null;
        subject = fresh;
      }
    }
    if (via === "smtp") {
      await sendVendorEmail({ to: item.vendorEmail, subject, body, senderName, replyTo: sender.email });
    }
  } catch (err) {
    error = err instanceof Error ? err.message.slice(0, 300) : "Send failed";
    console.error(`[follow-ups] ${kind} ${id}:`, error);
  }

  await prisma.followUp.create({
    data: {
      kind,
      submissionId: item.submissionId,
      interviewId: kind === "interview" ? item.id : null,
      senderId,
      sequence: item.sequence,
      toEmail: item.vendorEmail.toLowerCase(),
      subject: subject.slice(0, 300),
      threadId: thread?.threadId ?? null,
      inReplyTo: thread?.inReplyTo ?? null,
      via,
      status: error ? "failed" : "sent",
      error,
    },
  });
  if (error) throw new FollowUpError(`Could not send the follow-up: ${error}`);
  if (via === "gmail") void syncEmailStats(senderId).catch(() => {});

  return { inThread: !!thread, subject, via, sequence: item.sequence };
}
