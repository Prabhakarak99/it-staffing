import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { OAUTH_STATE_COOKIE, exchangeCode, fetchProfileEmail, saveAccount } from "@/lib/gmail/oauth";
import { syncEmailStats } from "@/lib/gmail/stats";

/** GET /api/gmail/callback — Google redirects here after the user allows (or denies) access */
export async function GET(req: NextRequest) {
  const back = (params: Record<string, string>) => {
    const url = new URL("/admin/mailbox", req.url);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = NextResponse.redirect(url);
    res.cookies.delete({ name: OAUTH_STATE_COOKIE, path: "/api/gmail/callback" });
    return res;
  };

  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const { searchParams } = req.nextUrl;
  if (searchParams.get("error")) return back({ gmail: "denied" });

  const state = searchParams.get("state") ?? "";
  const expected = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!expected || state !== expected || !state.endsWith(`.${session.userId}`)) {
    return back({ gmail: "error", message: "The connection request expired. Please try again." });
  }

  const code = searchParams.get("code");
  if (!code) return back({ gmail: "error", message: "Google did not return an authorization code." });

  try {
    const tokens = await exchangeCode(code);
    const email = await fetchProfileEmail(tokens.access_token);
    await saveAccount(session.userId, email, tokens);
  } catch (err) {
    console.error("[gmail] connect failed:", err);
    return back({ gmail: "error", message: err instanceof Error ? err.message : "Could not connect Gmail." });
  }

  // First count in the background; the page shows the mailbox right away
  void syncEmailStats(session.userId).catch((err) => console.error("[gmail-stats] initial sync:", err));
  return back({ gmail: "connected" });
}
