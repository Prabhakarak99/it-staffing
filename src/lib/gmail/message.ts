import { gmailFetch } from "./api";
import type { MailboxOwner } from "./oauth";

interface Part {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; size?: number };
  parts?: Part[];
  headers?: { name: string; value: string }[];
}

export interface FullMessage {
  id: string;
  threadId: string;
  subject: string;
  fromName: string | null;
  fromEmail: string;
  to: string;
  receivedAt: Date;
  /** Plain text: the text part, or the HTML part with tags removed */
  text: string;
}

/** Ids of messages matching a Gmail search, newest first */
export async function listMessageIds(owner: MailboxOwner, q: string, max: number) {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ q, maxResults: String(Math.min(100, max - ids.length)), fields: "messages/id,nextPageToken" });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await gmailFetch<{ messages?: { id: string }[]; nextPageToken?: string } | undefined>(owner, `/messages?${params}`);
    ids.push(...(page?.messages ?? []).map((m) => m.id));
    pageToken = page?.nextPageToken;
  } while (pageToken && ids.length < max);
  return ids;
}

const decode = (data?: string) => (data ? Buffer.from(data, "base64url").toString("utf8") : "");

function findPart(part: Part, mime: string): string | null {
  if (part.mimeType === mime && !part.filename && part.body?.data) return decode(part.body.data);
  for (const p of part.parts ?? []) {
    const hit = findPart(p, mime);
    if (hit) return hit;
  }
  return null;
}

/** HTML email → readable text (keeps line breaks and list items) */
export function htmlToText(html: string) {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<td[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** "Jane Doe <jane@vendor.com>" → name and address */
export function parseAddress(value: string) {
  const m = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || null, email: m[2].trim().toLowerCase() };
  return { name: null, email: value.trim().toLowerCase() };
}

/** One message with its headers and its body as plain text */
export async function getFullMessage(owner: MailboxOwner, id: string): Promise<FullMessage> {
  const msg = await gmailFetch<{ id: string; threadId: string; internalDate?: string; payload?: Part }>(owner, `/messages/${id}?format=full`);
  const headers = msg.payload?.headers ?? [];
  const header = (name: string) => headers.find((h) => h.name.toLowerCase() === name)?.value ?? "";
  const from = parseAddress(header("from"));
  const plain = msg.payload ? findPart(msg.payload, "text/plain") : null;
  const html = msg.payload && !plain ? findPart(msg.payload, "text/html") : null;
  return {
    id: msg.id,
    threadId: msg.threadId,
    subject: header("subject"),
    fromName: from.name,
    fromEmail: from.email,
    to: header("to"),
    receivedAt: msg.internalDate ? new Date(Number(msg.internalDate)) : new Date(),
    text: (plain ?? (html ? htmlToText(html) : "")).replace(/\r\n/g, "\n").trim(),
  };
}
