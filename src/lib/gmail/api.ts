import { getAccessToken } from "./oauth";

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export class GmailApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Every call is made with the given user's own token, so one user can never reach another's mailbox. */
export async function gmailFetch<T>(userId: string, path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken(userId);
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) {
    let message = `Gmail request failed (${res.status})`;
    try {
      message = ((await res.json()) as { error?: { message?: string } }).error?.message ?? message;
    } catch {}
    throw new GmailApiError(message, res.status);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

// ── Raw Gmail shapes (only the fields we read) ──────────────────────────────

interface Header { name: string; value: string }

interface Part {
  partId?: string;
  mimeType: string;
  filename?: string;
  headers?: Header[];
  body?: { size: number; data?: string; attachmentId?: string };
  parts?: Part[];
}

export interface RawMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  sizeEstimate?: number;
  payload?: Part;
}

export interface RawLabel {
  id: string;
  name: string;
  type: "system" | "user";
  messagesUnread?: number;
  messagesTotal?: number;
}

// ── Parsing ─────────────────────────────────────────────────────────────────

const decode = (data: string) => Buffer.from(data, "base64url").toString("utf8");

export function header(msg: RawMessage, name: string) {
  const lower = name.toLowerCase();
  return msg.payload?.headers?.find((h) => h.name.toLowerCase() === lower)?.value ?? "";
}

export interface MessageSummary {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
  starred: boolean;
  labelIds: string[];
}

export function toSummary(msg: RawMessage): MessageSummary {
  const labels = msg.labelIds ?? [];
  return {
    id: msg.id,
    threadId: msg.threadId,
    from: header(msg, "From"),
    to: header(msg, "To"),
    subject: header(msg, "Subject"),
    snippet: decodeEntities(msg.snippet ?? ""),
    date: new Date(Number(msg.internalDate ?? 0)).toISOString(),
    unread: labels.includes("UNREAD"),
    starred: labels.includes("STARRED"),
    labelIds: labels,
  };
}

// Gmail snippets arrive HTML-escaped
function decodeEntities(s: string) {
  return s
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

export interface Attachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface MessageDetail extends MessageSummary {
  cc: string;
  bcc: string;
  replyTo: string;
  messageIdHeader: string;
  references: string;
  html: string | null;
  text: string | null;
  attachments: Attachment[];
}

export function toDetail(msg: RawMessage): MessageDetail {
  let html: string | null = null;
  let text: string | null = null;
  const attachments: Attachment[] = [];

  const walk = (part: Part | undefined) => {
    if (!part) return;
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        attachmentId: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType,
        size: part.body.size,
      });
    } else if (part.body?.data) {
      // First html / plain body wins; later ones are usually quoted copies in multipart/alternative
      if (part.mimeType === "text/html" && html === null) html = decode(part.body.data);
      else if (part.mimeType === "text/plain" && text === null) text = decode(part.body.data);
    }
    part.parts?.forEach(walk);
  };
  walk(msg.payload);

  return {
    ...toSummary(msg),
    cc: header(msg, "Cc"),
    bcc: header(msg, "Bcc"),
    replyTo: header(msg, "Reply-To"),
    messageIdHeader: header(msg, "Message-ID"),
    references: header(msg, "References"),
    html,
    text,
    attachments,
  };
}

// ── Calls ───────────────────────────────────────────────────────────────────

/** System folders shown in the mailbox, mapped to Gmail label ids */
export const FOLDERS: Record<string, { label: string; labelId?: string; spamTrash?: boolean }> = {
  inbox:   { label: "Inbox",   labelId: "INBOX" },
  starred: { label: "Starred", labelId: "STARRED" },
  sent:    { label: "Sent",    labelId: "SENT" },
  drafts:  { label: "Drafts",  labelId: "DRAFT" },
  all:     { label: "All Mail" },
  spam:    { label: "Spam",    labelId: "SPAM", spamTrash: true },
  trash:   { label: "Trash",   labelId: "TRASH", spamTrash: true },
};

const LIST_HEADERS = ["From", "To", "Subject", "Date"].map((h) => `metadataHeaders=${h}`).join("&");

export async function listMessages(
  userId: string,
  opts: { folder?: string; labelId?: string; q?: string; pageToken?: string; pageSize?: number },
) {
  const folder = FOLDERS[opts.folder ?? "inbox"] ?? FOLDERS.inbox;
  const params = new URLSearchParams({ maxResults: String(opts.pageSize ?? 25) });
  const labelId = opts.labelId ?? folder.labelId;
  if (labelId) params.set("labelIds", labelId);
  if (opts.q) params.set("q", opts.q);
  if (opts.pageToken) params.set("pageToken", opts.pageToken);
  if (folder.spamTrash && !opts.labelId) params.set("includeSpamTrash", "true");

  const list = await gmailFetch<{ messages?: { id: string }[]; nextPageToken?: string; resultSizeEstimate?: number }>(
    userId,
    `/messages?${params}`,
  );
  const messages = await Promise.all(
    (list.messages ?? []).map((m) => gmailFetch<RawMessage>(userId, `/messages/${m.id}?format=metadata&${LIST_HEADERS}`)),
  );
  return {
    messages: messages.map(toSummary),
    nextPageToken: list.nextPageToken ?? null,
    estimate: list.resultSizeEstimate ?? 0,
  };
}

export const getMessage = (userId: string, id: string) =>
  gmailFetch<RawMessage>(userId, `/messages/${encodeURIComponent(id)}?format=full`);

export const modifyMessage = (userId: string, id: string, addLabelIds: string[], removeLabelIds: string[]) =>
  gmailFetch<RawMessage>(userId, `/messages/${encodeURIComponent(id)}/modify`, {
    method: "POST",
    body: JSON.stringify({ addLabelIds, removeLabelIds }),
  });

export const trashMessage = (userId: string, id: string) =>
  gmailFetch<RawMessage>(userId, `/messages/${encodeURIComponent(id)}/trash`, { method: "POST" });

export const untrashMessage = (userId: string, id: string) =>
  gmailFetch<RawMessage>(userId, `/messages/${encodeURIComponent(id)}/untrash`, { method: "POST" });

export async function getAttachment(userId: string, messageId: string, attachmentId: string) {
  const { data } = await gmailFetch<{ data: string }>(
    userId,
    `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
  );
  return Buffer.from(data, "base64url");
}

export async function listLabels(userId: string) {
  const { labels } = await gmailFetch<{ labels: RawLabel[] }>(userId, "/labels");
  return labels;
}

export async function getLabel(userId: string, id: string) {
  return gmailFetch<RawLabel>(userId, `/labels/${encodeURIComponent(id)}`);
}

export const sendRaw = (userId: string, raw: Buffer, threadId?: string) =>
  gmailFetch<RawMessage>(userId, "/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw: raw.toString("base64url"), ...(threadId ? { threadId } : {}) }),
  });

/** Exact number of messages matching a search (pages through ids only, 500 at a time). */
export async function countMessages(userId: string, q: string) {
  let total = 0;
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ q, maxResults: "500", fields: "messages/id,nextPageToken" });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await gmailFetch<{ messages?: unknown[]; nextPageToken?: string }>(userId, `/messages?${params}`);
    total += page.messages?.length ?? 0;
    pageToken = page.nextPageToken;
  } while (pageToken);
  return total;
}
