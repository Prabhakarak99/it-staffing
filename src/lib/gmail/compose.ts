import MailComposer from "nodemailer/lib/mail-composer";
import type Mail from "nodemailer/lib/mailer";
import { prisma } from "@/lib/prisma";
import { sendRaw } from "./api";

/** Gmail rejects messages over 25 MB; base64 adds about a third */
export const MAX_ATTACHMENT_BYTES = 18 * 1024 * 1024;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const textToHtml = (s: string) => escapeHtml(s).replace(/\r?\n/g, "<br>");

/** Splits "a@x.com, Name <b@y.com>; c@z.com" into addresses */
export function addresses(list: string): string[] {
  return list.split(/[,;]/).map((s) => s.trim()).filter((s) => /\S+@\S+\.\S+/.test(s));
}

export interface ComposeInput {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  /** Plain text; an HTML version is built from it unless `html` is given */
  body: string;
  html?: string;
  replyTo?: string;
  files?: { filename: string; content: Buffer; contentType: string }[];
}

/** Sends from the user's connected Gmail, under their name, so it appears in their Sent folder */
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
    replyTo: input.replyTo || undefined,
    subject: input.subject,
    text: input.body,
    html: input.html ?? `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;">${textToHtml(input.body)}</div>`,
    attachments: (input.files ?? []).map((f) => ({ filename: f.filename, content: f.content, contentType: f.contentType })),
  };

  const raw = await new MailComposer(mail).compile().build();
  return sendRaw(userId, raw);
}
