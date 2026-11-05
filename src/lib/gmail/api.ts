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

/** Sends an RFC 822 message through the user's Gmail, so it lands in their Sent folder */
export const sendRaw = (userId: string, raw: Buffer) =>
  gmailFetch<{ id: string }>(userId, "/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw: raw.toString("base64url") }),
  });

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
    const page = await gmailFetch<{ messages?: unknown[]; nextPageToken?: string }>(userId, `/messages?${params}`);
    total += page.messages?.length ?? 0;
    pageToken = page.nextPageToken;
  } while (pageToken && total < MAX_COUNT);
  return total;
}
