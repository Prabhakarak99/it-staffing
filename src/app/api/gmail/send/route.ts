import { NextRequest, NextResponse } from "next/server";
import { getMailboxAccess, gmailErrorResponse } from "@/lib/gmail/access";
import { MAX_ATTACHMENT_BYTES, addresses, sendMail } from "@/lib/gmail/compose";
import { syncEmailStats } from "@/lib/gmail/stats";

export const maxDuration = 120;

/** POST /api/gmail/send (multipart form): to, cc, bcc, subject, body, files[] */
export async function POST(req: NextRequest) {
  const access = await getMailboxAccess();
  if (!access.ok) return access.response;

  const form = await req.formData();
  const field = (k: string) => (typeof form.get(k) === "string" ? (form.get(k) as string).trim() : "");

  const to = field("to");
  const cc = field("cc");
  const bcc = field("bcc");
  if (addresses(`${to},${cc},${bcc}`).length === 0) {
    return NextResponse.json({ error: "Add at least one recipient" }, { status: 400 });
  }
  if (!field("subject")) return NextResponse.json({ error: "Subject is required" }, { status: 400 });

  const uploads = form.getAll("files").filter((f): f is File => typeof f !== "string" && f.size > 0);
  const totalBytes = uploads.reduce((n, f) => n + f.size, 0);
  if (totalBytes > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: "Attachments are too large (18 MB total max)" }, { status: 400 });
  }

  try {
    await sendMail(access.session.userId, {
      to, cc, bcc,
      subject: field("subject"),
      body: (form.get("body") as string | null) ?? "",
      files: await Promise.all(
        uploads.map(async (f) => ({
          filename: f.name,
          contentType: f.type || "application/octet-stream",
          content: Buffer.from(await f.arrayBuffer()),
        })),
      ),
    });
  } catch (err) {
    return gmailErrorResponse(err);
  }

  // Refresh today's Sent count in the background
  void syncEmailStats(access.session.userId).catch(() => {});
  return NextResponse.json({ success: true });
}
