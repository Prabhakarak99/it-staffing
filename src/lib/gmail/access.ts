import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "@/lib/auth";
import { canViewScreen } from "@/lib/screen-access";
import { canManageUsers } from "@/lib/user-safe";
import { GmailApiError } from "./api";
import { GmailAuthError, GmailNotConnectedError, isGmailConfigured } from "./oauth";

export const MAILBOX_SCREEN = { name: "Mailbox", path: "/admin/mailbox" };

type Access =
  | { ok: false; response: NextResponse }
  | { ok: true; session: SessionPayload; isAdmin: boolean };

/** Signed in + Mailbox screen. Every mailbox call then uses session.userId's own Gmail token. */
export async function getMailboxAccess(): Promise<Access> {
  const session = await getSession();
  if (!session) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!(await canViewScreen(session, MAILBOX_SCREEN.path))) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (!isGmailConfigured()) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Gmail integration is not configured yet", code: "not_configured" }, { status: 503 }),
    };
  }
  return { ok: true, session, isAdmin: canManageUsers(session) };
}

/** Maps Gmail / token failures to a JSON response the mailbox UI understands */
export function gmailErrorResponse(err: unknown) {
  if (err instanceof GmailNotConnectedError) {
    return NextResponse.json({ error: err.message, code: "not_connected" }, { status: 409 });
  }
  if (err instanceof GmailAuthError) {
    return NextResponse.json({ error: err.message, code: "not_connected" }, { status: 409 });
  }
  if (err instanceof GmailApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status === 404 ? 404 : 502 });
  }
  console.error("[gmail]", err);
  return NextResponse.json({ error: "Something went wrong talking to Gmail" }, { status: 500 });
}
