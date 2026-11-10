import { getAccessToken, type MailboxOwner } from "./oauth";

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export class GmailApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Every call is made with that mailbox's own token (a user's own Gmail, or a consultant's connected
 * one), so one mailbox can never reach another.
 */
export async function gmailFetch<T>(owner: MailboxOwner, path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken(owner);
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
  // 204, or a 200 with an empty body, both mean "nothing"
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Sends an RFC 822 message through the user's Gmail, so it lands in their Sent folder */
export const sendRaw = (owner: MailboxOwner, raw: Buffer, threadId?: string) =>
  gmailFetch<{ id: string; threadId: string }>(owner, "/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw: raw.toString("base64url"), ...(threadId ? { threadId } : {}) }),
  });

export interface MessageHeaders {
  id: string;
  threadId: string;
  subject: string;
  messageId: string | null;
  references: string | null;
}

/** Newest message matching a Gmail search, with only the headers needed to reply in its thread */
export async function findMessage(userId: string, q: string): Promise<MessageHeaders | null> {
  const params = new URLSearchParams({ q, maxResults: "1", fields: "messages/id" });
  const page = await gmailFetch<{ messages?: { id: string }[] } | undefined>(userId, `/messages?${params}`);
  const id = page?.messages?.[0]?.id;
  if (!id) return null;

  const meta = new URLSearchParams({ format: "metadata" });
  for (const h of ["Subject", "Message-ID", "References"]) meta.append("metadataHeaders", h);
  const msg = await gmailFetch<{ id: string; threadId: string; payload?: { headers?: { name: string; value: string }[] } }>(
    userId,
    `/messages/${id}?${meta}`,
  );
  const header = (name: string) => msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;
  return { id: msg.id, threadId: msg.threadId, subject: header("Subject") ?? "", messageId: header("Message-ID"), references: header("References") };
}

/** Never page further than this for one count; a single day is normally a single request */
const MAX_COUNT = 5000;

/**
 * Number of messages matching a Gmail search. Only message ids are fetched (500 per request),
 * never the email contents.
 */
export async function countMessages(userId: string, q: string) {
  let total = 0;
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ q, maxResults: "500", fields: "messages/id,nextPageToken" });
    if (pageToken) params.set("pageToken", pageToken);
    // With a `fields` mask Google answers 204 No Content (no body) when nothing matches
    const page = await gmailFetch<{ messages?: unknown[]; nextPageToken?: string } | undefined>(userId, `/messages?${params}`);
    total += page?.messages?.length ?? 0;
    pageToken = page?.nextPageToken;
  } while (pageToken && total < MAX_COUNT);
  return total;
}
