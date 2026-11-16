import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { appOrigin } from "@/lib/app-url";
import { OAUTH_STATE_COOKIE, authUrl, isGmailConfigured } from "@/lib/gmail/oauth";
import { CLOUD_SCOPE, SHEET_API_STATE } from "@/lib/leads/sheet";

/**
 * GET /api/leads/sheet/enable-api — "Turn it on now": send the user to Google to let the app switch
 * the Google Sheets API on in the project. Works only for an owner / editor of that Google Cloud project.
 * The access is used once in the callback and not stored.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", appOrigin()));
  if (!(await isGmailConfigured())) return NextResponse.redirect(new URL("/admin/leads?sheet=error&message=Google+sign-in+is+not+set+up+yet.", appOrigin()));

  const state = `${randomBytes(24).toString("base64url")}.${session.userId}.${SHEET_API_STATE}`;
  const res = NextResponse.redirect(await authUrl(state, undefined, CLOUD_SCOPE));
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/gmail/callback",
    maxAge: 600,
  });
  return res;
}
