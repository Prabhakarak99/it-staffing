import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "./crypto";

/** Read, label, trash and send. Not "full mail" scope, so nothing can be deleted permanently. */
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.modify";

export const OAUTH_STATE_COOKIE = "gmail-oauth-state";

export function isGmailConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function redirectUri() {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/gmail/callback`;
}

export function authUrl(state: string, loginHint?: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    // Always show consent so Google returns a refresh token, even on a reconnect
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  if (loginHint) params.set("login_hint", loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      ...body,
    }),
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok) throw new GmailAuthError(json.error_description ?? json.error ?? `Token request failed (${res.status})`, json.error);
  return json;
}

export class GmailAuthError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

/** Thrown when the user has no connected mailbox or must reconnect it */
export class GmailNotConnectedError extends Error {}

export function exchangeCode(code: string) {
  return tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
}

/** Google's mailbox address for a fresh access token */
export async function fetchProfileEmail(accessToken: string) {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Could not read the Gmail profile (${res.status})`);
  return ((await res.json()) as { emailAddress: string }).emailAddress;
}

export async function saveAccount(userId: string, email: string, tokens: TokenResponse) {
  if (!tokens.refresh_token) throw new Error("Google did not return a refresh token; please try connecting again");
  const data = {
    email,
    refreshTokenEnc: encrypt(tokens.refresh_token),
    accessTokenEnc: encrypt(tokens.access_token),
    accessTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
    connectedAt: new Date(),
    lastError: null,
  };
  await prisma.gmailAccount.upsert({ where: { userId }, create: { userId, ...data }, update: data });
}

/** A valid access token for this user's mailbox, refreshing (and caching) it when it is about to expire. */
export async function getAccessToken(userId: string): Promise<string> {
  const account = await prisma.gmailAccount.findUnique({ where: { userId } });
  if (!account) throw new GmailNotConnectedError("Gmail is not connected");

  if (account.accessTokenEnc && account.accessTokenExpiry && account.accessTokenExpiry.getTime() > Date.now() + 60_000) {
    return decrypt(account.accessTokenEnc);
  }

  try {
    const tokens = await tokenRequest({ refresh_token: decrypt(account.refreshTokenEnc), grant_type: "refresh_token" });
    await prisma.gmailAccount.update({
      where: { userId },
      data: {
        accessTokenEnc: encrypt(tokens.access_token),
        accessTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
        lastError: null,
      },
    });
    return tokens.access_token;
  } catch (err) {
    if (err instanceof GmailAuthError && err.code === "invalid_grant") {
      // Revoked in Google, password changed, or removed by the Workspace admin
      await prisma.gmailAccount.update({ where: { userId }, data: { lastError: "Access expired. Please reconnect Gmail." } });
      throw new GmailNotConnectedError("Gmail access expired. Please reconnect.");
    }
    throw err;
  }
}

/** Revoke at Google (best effort) and forget the tokens. Daily counts are kept. */
export async function disconnect(userId: string) {
  const account = await prisma.gmailAccount.findUnique({ where: { userId } });
  if (!account) return;
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decrypt(account.refreshTokenEnc))}`, { method: "POST" });
  } catch {
    // Already revoked or unreachable; deleting locally is what matters
  }
  await prisma.gmailAccount.delete({ where: { userId } });
}
