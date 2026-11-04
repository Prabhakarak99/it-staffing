import { NextRequest, NextResponse } from "next/server";
import { getMailboxAccess } from "@/lib/gmail/access";
import { getEmailActivity } from "@/lib/gmail/activity";
import { syncEmailStats } from "@/lib/gmail/stats";

/**
 * GET /api/gmail/stats[?refresh=1] — the user's connection status and received / sent counts;
 * admins also get every user's counts. refresh=1 re-counts the caller's own mailbox first.
 */
export async function GET(req: NextRequest) {
  const access = await getMailboxAccess();
  if (!access.ok) return access.response;

  if (req.nextUrl.searchParams.get("refresh") === "1") {
    try {
      await syncEmailStats(access.session.userId);
    } catch {
      // Error is stored on the account and shown in the status
    }
  }

  return NextResponse.json(await getEmailActivity(access.session.userId, access.isAdmin));
}
