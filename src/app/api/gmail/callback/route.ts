import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appOrigin } from "@/lib/app-url";
import { OAUTH_STATE_COOKIE, exchangeCode, fetchProfileEmail, saveAccount, saveConsultantMailbox } from "@/lib/gmail/oauth";
import { syncEmailStats } from "@/lib/gmail/stats";
import { CONSULTANT_MAIL_SCREEN } from "@/lib/consultant-mail/data";
import { consultantScope } from "@/lib/resumes/data";

/**
 * GET /api/gmail/callback — Google redirects here after access is allowed (or denied): for the user's
 * own Gmail (Mailbox), or for a consultant's Gmail (Consultant Email Configuration, state ends ".c_<id>").
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const state = searchParams.get("state") ?? "";
  const [, stateUser, target] = state.split(".");
  const consultantId = target?.startsWith("c_") ? target.slice(2) : null;

  const back = (params: Record<string, string>) => {
    const url = new URL(consultantId ? CONSULTANT_MAIL_SCREEN.path : "/admin/mailbox", appOrigin());
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = NextResponse.redirect(url);
    res.cookies.delete({ name: OAUTH_STATE_COOKIE, path: "/api/gmail/callback" });
    return res;
  };

  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", appOrigin()));
  if (searchParams.get("error")) return back({ gmail: "denied" });

  const expected = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!expected || state !== expected || stateUser !== session.userId) {
    return back({ gmail: "error", message: "The connection request expired. Please try again." });
  }

  const code = searchParams.get("code");
  if (!code) return back({ gmail: "error", message: "Google did not return an authorization code." });

  try {
    const tokens = await exchangeCode(code);
    const email = await fetchProfileEmail(tokens.access_token);

    if (consultantId) {
      // Still this recruiter's consultant, and not someone's own work mailbox signed in by mistake
      const mine = await prisma.student.findFirst({ where: { id: consultantId, ...consultantScope(session) }, select: { firstName: true } });
      if (!mine) return back({ gmail: "error", message: "That consultant isn't assigned to you." });
      const lower = email.toLowerCase();
      const [staff, staffGmail, otherConsultant] = await Promise.all([
        prisma.user.findFirst({ where: { email: { equals: lower, mode: "insensitive" } }, select: { id: true } }),
        prisma.gmailAccount.findFirst({ where: { email: { equals: lower, mode: "insensitive" } }, select: { id: true } }),
        prisma.consultantMailbox.findFirst({ where: { email: { equals: lower, mode: "insensitive" }, consultantId: { not: consultantId } }, select: { consultant: { select: { firstName: true, lastName: true } } } }),
      ]);
      if (staff || staffGmail) {
        return back({ gmail: "error", message: `${email} is a staff mailbox. Sign in to Google as the consultant's Gmail instead (use a private window or "Use another account").` });
      }
      if (otherConsultant) {
        return back({ gmail: "error", message: `${email} is already connected for ${otherConsultant.consultant.firstName} ${otherConsultant.consultant.lastName}.` });
      }
      await saveConsultantMailbox(consultantId, session.userId, email, tokens);
      return back({ gmail: "connected", email, name: mine.firstName });
    }

    await saveAccount(session.userId, email, tokens);
  } catch (err) {
    console.error("[gmail] connect failed:", err);
    return back({ gmail: "error", message: err instanceof Error ? err.message : "Could not connect Gmail." });
  }

  // First count in the background; the page shows the mailbox right away
  void syncEmailStats(session.userId).catch((err) => console.error("[gmail-stats] initial sync:", err));
  return back({ gmail: "connected" });
}
