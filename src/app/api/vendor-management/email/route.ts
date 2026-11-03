import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendVendorEmail } from "@/lib/email";
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

  let sent = 0;
  const failed: string[] = [];
  for (const v of vendors) {
    try {
      await sendVendorEmail({
        to: v.email,
        subject: personalize(subject.trim(), v),
        body: personalize(body, v),
        senderName,
        replyTo: sender.email,
      });
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

  return NextResponse.json({ sent, failed });
}
