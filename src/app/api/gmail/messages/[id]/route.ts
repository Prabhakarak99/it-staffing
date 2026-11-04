import { NextRequest, NextResponse } from "next/server";
import { getMailboxAccess, gmailErrorResponse } from "@/lib/gmail/access";
import { getMessage, modifyMessage, toDetail, toSummary, trashMessage, untrashMessage } from "@/lib/gmail/api";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/gmail/messages/:id — full message; opening an unread message marks it read */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const access = await getMailboxAccess();
  if (!access.ok) return access.response;
  const { id } = await params;

  try {
    let msg = await getMessage(access.session.userId, id);
    if (msg.labelIds?.includes("UNREAD")) {
      const updated = await modifyMessage(access.session.userId, id, [], ["UNREAD"]);
      msg = { ...msg, labelIds: updated.labelIds };
    }
    return NextResponse.json(toDetail(msg));
  } catch (err) {
    return gmailErrorResponse(err);
  }
}

const SAFE_LABEL = /^[A-Za-z0-9_-]{1,100}$/;

/**
 * PATCH /api/gmail/messages/:id
 *   { add?: string[], remove?: string[] }   read/unread (UNREAD), star (STARRED), archive (remove INBOX), labels
 *   { action: "untrash" }                   restore from Trash
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const access = await getMailboxAccess();
  if (!access.ok) return access.response;
  const { id } = await params;
  const body = await req.json();

  try {
    if (body.action === "untrash") {
      return NextResponse.json(toSummary(await untrashMessage(access.session.userId, id)));
    }
    const add = (Array.isArray(body.add) ? body.add : []).filter((l: unknown) => typeof l === "string" && SAFE_LABEL.test(l));
    const remove = (Array.isArray(body.remove) ? body.remove : []).filter((l: unknown) => typeof l === "string" && SAFE_LABEL.test(l));
    if (add.length === 0 && remove.length === 0) return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
    const updated = await modifyMessage(access.session.userId, id, add, remove);
    return NextResponse.json({ id: updated.id, labelIds: updated.labelIds ?? [] });
  } catch (err) {
    return gmailErrorResponse(err);
  }
}

/** DELETE /api/gmail/messages/:id — move to Trash (Gmail empties it after 30 days) */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const access = await getMailboxAccess();
  if (!access.ok) return access.response;
  const { id } = await params;

  try {
    await trashMessage(access.session.userId, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return gmailErrorResponse(err);
  }
}
