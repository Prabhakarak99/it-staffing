import { ImapFlow } from "imapflow";
import { simpleParser, type AddressObject } from "mailparser";
import nodemailer from "nodemailer";
import { htmlToText, type FullMessage } from "@/lib/gmail/message";

/**
 * A consultant's Gmail over IMAP (read) and SMTP (send), signed in with a Google App Password: a
 * 16-character password Google issues for one app, revocable any time, never the real password.
 */

const IMAP = { host: "imap.gmail.com", port: 993, secure: true } as const;
const SMTP = { host: "smtp.gmail.com", port: 465, secure: true } as const;

export interface AppPasswordLogin {
  email: string;
  password: string;
}

/** Google shows the 16 characters in groups of four; spaces don't matter */
export const cleanAppPassword = (raw: string) => raw.replace(/\s+/g, "");

const imapClient = ({ email, password }: AppPasswordLogin) =>
  new ImapFlow({ ...IMAP, auth: { user: email, pass: password }, logger: false, socketTimeout: 60_000 });

/** Friendly reason for a failed sign-in */
function loginError(err: unknown, part: "read" | "send") {
  const e = err as { authenticationFailed?: boolean; responseText?: string; message?: string; code?: string; responseCode?: number };
  const text = `${e.responseText ?? ""} ${e.message ?? ""}`;
  if (e.authenticationFailed || e.code === "EAUTH" || e.responseCode === 535 || /invalid credentials|username and password not accepted|AUTHENTICATIONFAILED/i.test(text)) {
    return "Google didn't accept this Gmail address and App Password. Check the address, and create a new App Password if needed (the normal Gmail password won't work).";
  }
  if (/application-specific password required/i.test(text)) {
    return "This account needs an App Password, not the normal Gmail password. Create one at myaccount.google.com/apppasswords.";
  }
  if (/IMAP access is disabled|web login required/i.test(text)) {
    return "Google blocked the sign-in. Open the Gmail account in a browser, approve any security prompt, then try again.";
  }
  return `Could not ${part === "read" ? "read the inbox" : "check sending"}: ${e.message ?? "unknown error"}`;
}

/** Signs in to read (IMAP) and to send (SMTP); returns null when both work, otherwise the reason */
export async function verifyAppPassword(login: AppPasswordLogin): Promise<string | null> {
  const client = imapClient(login);
  try {
    await client.connect();
  } catch (err) {
    return loginError(err, "read");
  } finally {
    await client.logout().catch(() => {});
  }
  const transport = nodemailer.createTransport({ ...SMTP, auth: { user: login.email, pass: login.password } });
  try {
    await transport.verify();
  } catch (err) {
    return loginError(err, "send");
  } finally {
    transport.close();
  }
  return null;
}

/** Thrown when Google stops accepting the saved App Password (revoked, or 2-Step Verification turned off) */
export class AppPasswordRejectedError extends Error {}

/**
 * Opens the inbox once for a whole scan. `list` runs a Gmail search (same syntax as the Gmail search
 * box) and returns Gmail message ids, newest first; `get` reads one of them.
 */
export async function openImapReader(login: AppPasswordLogin) {
  const client = imapClient(login);
  try {
    await client.connect();
  } catch (err) {
    const e = err as { authenticationFailed?: boolean };
    if (e.authenticationFailed) throw new AppPasswordRejectedError("The App Password was rejected. Please reconnect this Gmail.");
    throw err;
  }
  const lock = await client.getMailboxLock("INBOX");
  const uidOf = new Map<string, number>();

  return {
    async list(q: string, max: number) {
      const uids = (await client.search({ gmraw: q }, { uid: true })) || [];
      const newest = [...uids].sort((a, b) => b - a).slice(0, max);
      if (!newest.length) return [];
      const ids: string[] = [];
      for await (const msg of client.fetch(newest, { uid: true, emailId: true }, { uid: true })) {
        const id = msg.emailId ?? `uid-${msg.uid}`;
        uidOf.set(id, msg.uid);
        ids.push(id);
      }
      // fetch returns them oldest first
      return ids.sort((a, b) => (uidOf.get(b) ?? 0) - (uidOf.get(a) ?? 0));
    },
    async get(id: string): Promise<FullMessage> {
      const uid = uidOf.get(id);
      if (!uid) throw new Error(`Message ${id} not found`);
      const msg = await client.fetchOne(String(uid), { uid: true, source: true, internalDate: true }, { uid: true });
      if (!msg || !msg.source) throw new Error(`Message ${id} has no content`);
      const parsed = await simpleParser(msg.source);
      const from = (parsed.from as AddressObject | undefined)?.value?.[0];
      const to = ([] as AddressObject[]).concat(parsed.to ?? []).map((a) => a.text).join(", ");
      const text = parsed.text?.trim() || (typeof parsed.html === "string" ? htmlToText(parsed.html) : "");
      return {
        id,
        threadId: "",
        subject: parsed.subject ?? "",
        fromName: from?.name?.trim() || null,
        fromEmail: (from?.address ?? "").toLowerCase(),
        to,
        receivedAt: msg.internalDate instanceof Date ? msg.internalDate : parsed.date ?? new Date(),
        text: text.replace(/\r\n/g, "\n").trim(),
      };
    },
    async close() {
      lock.release();
      await client.logout().catch(() => {});
    },
  };
}

/** Sends from the consultant's Gmail over SMTP; it lands in their Sent folder */
export async function sendWithAppPassword(
  login: AppPasswordLogin,
  mail: { to: string; subject: string; text: string; fromName?: string; attachments?: { filename: string; content: Buffer; contentType: string }[] },
) {
  const transport = nodemailer.createTransport({ ...SMTP, auth: { user: login.email, pass: login.password } });
  try {
    await transport.sendMail({
      from: mail.fromName ? `"${mail.fromName.replace(/"/g, "")}" <${login.email}>` : login.email,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      attachments: mail.attachments,
    });
  } finally {
    transport.close();
  }
}
