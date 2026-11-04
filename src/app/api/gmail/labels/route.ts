import { NextResponse } from "next/server";
import { getMailboxAccess, gmailErrorResponse } from "@/lib/gmail/access";
import { getLabel, listLabels } from "@/lib/gmail/api";

/** GET /api/gmail/labels — the user's own labels plus the Inbox unread count */
export async function GET() {
  const access = await getMailboxAccess();
  if (!access.ok) return access.response;

  try {
    const [labels, inbox] = await Promise.all([
      listLabels(access.session.userId),
      getLabel(access.session.userId, "INBOX"),
    ]);
    return NextResponse.json({
      inboxUnread: inbox.messagesUnread ?? 0,
      labels: labels
        .filter((l) => l.type === "user")
        .map((l) => ({ id: l.id, name: l.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  } catch (err) {
    return gmailErrorResponse(err);
  }
}
