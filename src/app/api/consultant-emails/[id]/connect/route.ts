import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appOrigin } from "@/lib/app-url";
import { OAUTH_STATE_COOKIE, authUrl, isGmailConfigured } from "@/lib/gmail/oauth";
import { CONSULTANT_MAIL_SCREEN, consultantMailAccess } from "@/lib/consultant-mail/data";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET — sends the recruiter to Google to sign in as the consultant's Gmail and allow read + send access.
 * Uses the same callback as Mailbox; the state marks it as a consultant connection.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const access = await consultantMailAccess(id);
  if (!access.ok) return access.response;
  if (!(await isGmailConfigured())) {
    const url = new URL(CONSULTANT_MAIL_SCREEN.path, appOrigin());
    url.searchParams.set("gmail", "error");
    url.searchParams.set("message", "Gmail isn't set up yet. An admin needs to finish the setup in Mailbox first.");
    return NextResponse.redirect(url);
  }

  const pm = await prisma.preMarketing.findFirst({ where: { consultantId: id }, select: { marketingEmail: true, consultant: { select: { email: true } } } });
  const hint = pm?.marketingEmail?.trim() || pm?.consultant.email || undefined;

  // state = nonce . user id . consultant id; the callback only accepts it from the same browser and user
  const state = `${randomBytes(24).toString("base64url")}.${access.session.userId}.c_${id}`;
  const res = NextResponse.redirect(await authUrl(state, hint));
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/gmail/callback",
    maxAge: 600,
  });
  return res;
}
