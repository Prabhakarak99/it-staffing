import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getMailboxAccess } from "@/lib/gmail/access";
import { OAUTH_STATE_COOKIE, authUrl } from "@/lib/gmail/oauth";

/** GET /api/gmail/connect — send the signed-in user to Google to allow access to their own mailbox */
export async function GET() {
  const access = await getMailboxAccess();
  if (!access.ok) return access.response;

  // state = nonce + user id; the callback only accepts it from the same browser and the same user
  const nonce = randomBytes(24).toString("base64url");
  const state = `${nonce}.${access.session.userId}`;
  const res = NextResponse.redirect(await authUrl(state, access.session.email));
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/gmail/callback",
    maxAge: 600,
  });
  return res;
}
