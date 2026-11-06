import { prisma } from "@/lib/prisma";
import { sendVendorEmail } from "@/lib/email";
import { sendMail } from "@/lib/gmail/compose";
import { GmailNotConnectedError, isGmailConfigured } from "@/lib/gmail/oauth";
import { syncEmailStats } from "@/lib/gmail/stats";
import { RESUME_TYPES, extOf, readResume } from "@/lib/files/resumes";

export const MAX_VENDORS_PER_SEND = 50;

export interface SendInput {
  submissionId: string;
  consultantId: string;
  vendors: { email: string; name?: string | null; company?: string | null }[];
  subject: string;
  body: string;
  /** Attach the latest AI-updated resume when there is one (otherwise the original) */
  useTailored: boolean;
}

const firstName = (name?: string | null) => name?.trim().split(/\s+/)[0] || "there";

/** "{firstName}" and "{company}" in the subject or body are filled in per vendor */
const personalize = (text: string, v: SendInput["vendors"][number]) =>
  text.replace(/\{firstName\}/g, firstName(v.name)).replace(/\{company\}/g, v.company?.trim() || "your team");

/**
 * Emails the consultant's resume to each vendor separately, from the sender's Gmail when connected
 * (so it counts in their Sent total) or the company mailbox otherwise, and logs every send.
 */
export async function sendToVendors(senderId: string, input: SendInput) {
  const [sender, consultant, tailored] = await Promise.all([
    prisma.user.findUnique({ where: { id: senderId }, select: { firstName: true, lastName: true, email: true } }),
    prisma.student.findUnique({ where: { id: input.consultantId }, select: { resumeFile: true, resumeFileName: true } }),
    input.useTailored
      ? prisma.tailoredResume.findFirst({ where: { submissionId: input.submissionId, consultantId: input.consultantId }, orderBy: { createdAt: "desc" } })
      : null,
  ]);
  if (!sender) throw new Error("Unauthorized");

  const attachment = tailored
    ? { file: tailored.file, name: tailored.fileName }
    : consultant?.resumeFile
      ? { file: consultant.resumeFile, name: consultant.resumeFileName ?? "Resume" }
      : null;
  if (!attachment) throw new Error("This consultant has no resume to attach. Upload one first.");

  const bytes = await readResume(attachment.file);
  const files = [{ filename: attachment.name, content: bytes, contentType: RESUME_TYPES[extOf(attachment.file)] ?? "application/octet-stream" }];
  const senderName = `${sender.firstName} ${sender.lastName}`.trim() || sender.email;

  let viaGmail =
    (await isGmailConfigured()) &&
    !!(await prisma.gmailAccount.findFirst({ where: { userId: senderId, lastError: null }, select: { id: true } }));

  const results: { email: string; ok: boolean; error?: string }[] = [];
  for (const v of input.vendors) {
    const message = { to: v.email, subject: personalize(input.subject, v), body: personalize(input.body, v) };
    let via = viaGmail ? "gmail" : "smtp";
    let error: string | null = null;
    try {
      if (viaGmail) {
        try {
          await sendMail(senderId, { ...message, files });
        } catch (err) {
          if (!(err instanceof GmailNotConnectedError)) throw err;
          viaGmail = false; // Gmail access expired mid-batch: send the rest through the company mailbox
          via = "smtp";
          await sendVendorEmail({ ...message, senderName, replyTo: sender.email, attachments: files });
        }
      } else {
        await sendVendorEmail({ ...message, senderName, replyTo: sender.email, attachments: files });
      }
    } catch (err) {
      error = err instanceof Error ? err.message.slice(0, 300) : "Send failed";
      console.error(`[easy-submissions] ${v.email}:`, error);
    }
    await prisma.easySubmissionSend.create({
      data: {
        submissionId: input.submissionId,
        consultantId: input.consultantId,
        senderId,
        vendorEmail: v.email.toLowerCase(),
        vendorName: v.name ?? null,
        vendorCompany: v.company ?? null,
        tailoredResumeId: tailored?.id ?? null,
        subject: message.subject.slice(0, 300),
        via,
        status: error ? "failed" : "sent",
        error,
      },
    });
    results.push({ email: v.email, ok: !error, ...(error ? { error } : {}) });
  }

  if (results.some((r) => r.ok) && viaGmail) void syncEmailStats(senderId).catch(() => {});
  return { results, attached: attachment.name };
}
