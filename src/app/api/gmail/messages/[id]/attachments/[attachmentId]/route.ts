import { NextRequest, NextResponse } from "next/server";
import { getMailboxAccess, gmailErrorResponse } from "@/lib/gmail/access";
import { getAttachment, getMessage, toDetail } from "@/lib/gmail/api";

type Ctx = { params: Promise<{ id: string; attachmentId: string }> };

/** GET /api/gmail/messages/:id/attachments/:attachmentId — download one attachment */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const access = await getMailboxAccess();
  if (!access.ok) return access.response;
  const { id, attachmentId } = await params;

  try {
    // Name and type come from the message itself, never from the URL
    const meta = toDetail(await getMessage(access.session.userId, id)).attachments.find((a) => a.attachmentId === attachmentId);
    if (!meta) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

    const data = await getAttachment(access.session.userId, id, attachmentId);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        // Always a download, so an attached HTML file can never run on our origin
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(meta.filename)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return gmailErrorResponse(err);
  }
}
