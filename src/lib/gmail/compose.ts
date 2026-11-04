import MailComposer from "nodemailer/lib/mail-composer";
import type Mail from "nodemailer/lib/mailer";
import { prisma } from "@/lib/prisma";
import { addresses } from "./addresses";
import { getAttachment, getMessage, sendRaw, toDetail } from "./api";

export { addresses };

export type ComposeMode = "new" | "reply" | "replyAll" | "forward";

/** Gmail rejects messages over 25 MB; base64 adds about a third */
export const MAX_ATTACHMENT_BYTES = 18 * 1024 * 1024;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const textToHtml = (s: string) => escapeHtml(s).replace(/\r?\n/g, "<br>");

const prefixed = (subject: string, prefix: "Re" | "Fwd") =>
  new RegExp(`^${prefix}:`, "i").test(subject.trim()) ? subject : `${prefix}: ${subject}`;

export interface ComposeInput {
  mode: ComposeMode;
  /** Original message for reply / reply all / forward */
  messageId?: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  files: { filename: string; content: Buffer; contentType: string }[];
}

/**
 * Builds the MIME message and sends it through the user's own Gmail, so it appears in their Sent
 * folder. Replies stay in the original thread; the quoted original is appended below the new text.
 */
export async function sendMail(userId: string, input: ComposeInput) {
  const [account, user] = await Promise.all([
    prisma.gmailAccount.findUniqueOrThrow({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } }),
  ]);
  const fromName = user ? `${user.firstName} ${user.lastName}`.trim() : "";

  const mail: Mail.Options = {
    from: fromName ? { name: fromName, address: account.email } : account.email,
    to: input.to || undefined,
    cc: input.cc || undefined,
    bcc: input.bcc || undefined,
    subject: input.subject,
    text: input.body,
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;">${textToHtml(input.body)}</div>`,
    attachments: input.files.map((f) => ({ filename: f.filename, content: f.content, contentType: f.contentType })),
  };

  let threadId: string | undefined;

  if (input.mode !== "new" && input.messageId) {
    const original = toDetail(await getMessage(userId, input.messageId));
    const quotedHtml = original.html ?? (original.text ? textToHtml(original.text) : "");
    const quotedText = (original.text ?? "").split("\n").map((l) => `> ${l}`).join("\n");

    if (input.mode === "forward") {
      mail.subject = prefixed(input.subject || original.subject, "Fwd");
      const intro = `---------- Forwarded message ---------\nFrom: ${original.from}\nDate: ${new Date(original.date).toUTCString()}\nSubject: ${original.subject}\nTo: ${original.to}`;
      mail.text = `${input.body}\n\n${intro}\n\n${original.text ?? ""}`;
      mail.html += `<br><div>${textToHtml(intro)}</div><br>${quotedHtml}`;
      // Forward keeps the original attachments
      for (const a of original.attachments) {
        (mail.attachments as Mail.Attachment[]).push({
          filename: a.filename,
          contentType: a.mimeType,
          content: await getAttachment(userId, original.id, a.attachmentId),
        });
      }
    } else {
      threadId = original.threadId;
      mail.subject = prefixed(input.subject || original.subject, "Re");
      if (original.messageIdHeader) {
        mail.inReplyTo = original.messageIdHeader;
        mail.references = [original.references, original.messageIdHeader].filter(Boolean).join(" ");
      }
      const intro = `On ${new Date(original.date).toUTCString()}, ${original.from} wrote:`;
      mail.text = `${input.body}\n\n${intro}\n${quotedText}`;
      mail.html += `<br><div>${escapeHtml(intro)}</div><blockquote style="margin:0 0 0 .8ex;border-left:1px solid #ccc;padding-left:1ex;">${quotedHtml}</blockquote>`;
    }
  }

  const raw = await new MailComposer(mail).compile().build();
  return sendRaw(userId, raw, threadId);
}
