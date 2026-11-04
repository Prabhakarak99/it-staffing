import { NextRequest, NextResponse } from "next/server";
import { getMailboxAccess, gmailErrorResponse } from "@/lib/gmail/access";
import { listMessages } from "@/lib/gmail/api";

/** GET /api/gmail/messages?folder=inbox|sent|…&label=<id>&q=<gmail search>&pageToken= */
export async function GET(req: NextRequest) {
  const access = await getMailboxAccess();
  if (!access.ok) return access.response;

  const sp = req.nextUrl.searchParams;
  try {
    return NextResponse.json(
      await listMessages(access.session.userId, {
        folder: sp.get("folder") ?? "inbox",
        labelId: sp.get("label") || undefined,
        q: sp.get("q") || undefined,
        pageToken: sp.get("pageToken") || undefined,
      }),
    );
  } catch (err) {
    return gmailErrorResponse(err);
  }
}
