import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendVendorEmail } from "@/lib/email";
import { sendMail } from "@/lib/gmail/compose";
import { GmailNotConnectedError, isGmailConfigured } from "@/lib/gmail/oauth";
import { syncEmailStats } from "@/lib/gmail/stats";
import { getVendorAccess, ownedWhere } from "@/lib/vendors/access";

export const maxDuration = 300;

/** Keeps one click well inside Gmail's per-day sending limit */
const MAX_RECIPIENTS = 100;

/** {name}, {firstName} and {company} are filled in per contact */
function personalize(template: string, v: { name: string; companyName: string }) {
  return template
    .replace(/\{firstName\}/gi, v.name.split(/\s+/)[0] ?? v.name)
    .replace(/\{name\}/gi, v.name)
    .replace(/\{company\}/gi, v.companyName);
}

/**
 * POST /api/vendor-management/email  { ids: string[], subject, body }
 * Sends one separate email per contact (recipients never see each other), from the company
 * mailbox under the signed-in recruiter's name with Reply-To set to their own email.
 */
export async function POST(req: NextRequest) {
  const access = await getVendorAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { ids, subject, body } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: "Select at least one vendor" }, { status: 400 });
  if (ids.length > MAX_RECIPIENTS) {
    return NextResponse.json({ error: `You can email up to ${MAX_RECIPIENTS} vendors at a time` }, { status: 400 });
  }
  if (typeof subject !== "string" || !subject.trim() || typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
  }

  const [sender, vendors] = await Promise.all([
    prisma.user.findUnique({ where: { id: access.session.userId }, select: { firstName: true, lastName: true, email: true } }),
    prisma.recruiterVendor.findMany({ where: { id: { in: ids.map(String) }, ...ownedWhere(access) } }),
  ]);
  if (!sender) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const senderName = `${sender.firstName} ${sender.lastName}`.trim() || sender.email;

  // From the recruiter's own Gmail when connected (it shows in their Sent count), else the company SMTP
  let viaGmail =
    (await isGmailConfigured()) &&
    !!(await prisma.gmailAccount.findFirst({ where: { userId: access.session.userId, lastError: null }, select: { id: true } }));

  let sent = 0;
  const failed: string[] = [];
  for (const v of vendors) {
    const message = { to: v.email, subject: personalize(subject.trim(), v), body: personalize(body, v) };
    try {
      if (viaGmail) {
        try {
          await sendMail(access.session.userId, message);
        } catch (err) {
          if (!(err instanceof GmailNotConnectedError)) throw err;
          viaGmail = false; // access expired mid-batch: send the rest through SMTP
          await sendVendorEmail({ ...message, senderName, replyTo: sender.email });
        }
      } else {
        await sendVendorEmail({ ...message, senderName, replyTo: sender.email });
      }
      await prisma.recruiterVendor.update({
        where: { id: v.id },
        data: { lastEmailedAt: new Date(), emailCount: { increment: 1 } },
      });
      sent++;
    } catch (err) {
      console.error(`[vendor-email] ${v.email}:`, err);
      failed.push(v.email);
    }
  }

  // Refresh today's Sent count in the background
  if (viaGmail && sent > 0) void syncEmailStats(access.session.userId).catch(() => {});
  return NextResponse.json({ sent, failed });
}
