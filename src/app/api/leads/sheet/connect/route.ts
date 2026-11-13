import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { appOrigin } from "@/lib/app-url";
import { OAUTH_STATE_COOKIE, authUrl, isGmailConfigured } from "@/lib/gmail/oauth";
import { SHEET_SCOPE, SHEET_STATE } from "@/lib/leads/sheet";

/** GET /api/leads/sheet/connect — send the signed-in user to Google to allow creating their Leads sheet */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", appOrigin()));
  if (!(await isGmailConfigured())) {
    const url = new URL("/admin/leads", appOrigin());
    url.searchParams.set("sheet", "error");
    url.searchParams.set("message", "Google sign-in is not set up yet. An admin needs to finish the Google setup in Mailbox first.");
    return NextResponse.redirect(url);
  }

  // Same callback as Gmail (one redirect URI at Google); the third part marks it as the Leads sheet
  const state = `${randomBytes(24).toString("base64url")}.${session.userId}.${SHEET_STATE}`;
  const res = NextResponse.redirect(await authUrl(state, session.email, SHEET_SCOPE));
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/gmail/callback",
    maxAge: 600,
  });
  return res;
}
