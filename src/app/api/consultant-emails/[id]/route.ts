import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/gmail/crypto";
import { disconnectConsultant } from "@/lib/gmail/oauth";
import { consultantMailAccess } from "@/lib/consultant-mail/data";
import { cleanAppPassword, verifyAppPassword } from "@/lib/consultant-mail/imap";

type RouteContext = { params: Promise<{ id: string }> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST { email, appPassword } — connect the consultant's Gmail with a Google App Password. Google is
 * asked first (read over IMAP and send over SMTP); only a working password is saved, encrypted.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const access = await consultantMailAccess(id);
  if (!access.ok) return access.response;

  const body = (await req.json().catch(() => ({}))) as { email?: unknown; appPassword?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.appPassword === "string" ? cleanAppPassword(body.appPassword) : "";
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Enter the consultant's Gmail address" }, { status: 400 });
  if (!/^[a-zA-Z]{16}$/.test(password)) {
    return NextResponse.json({ error: "An App Password is 16 letters (Google shows it in four groups of four). The normal Gmail password won't work." }, { status: 400 });
  }

  // Not a staff mailbox, and not already used for another consultant
  const [staff, staffGmail, other] = await Promise.all([
    prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } }),
    prisma.gmailAccount.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } }),
    prisma.consultantMailbox.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, consultantId: { not: id } },
      select: { consultant: { select: { firstName: true, lastName: true } } },
    }),
  ]);
  if (staff || staffGmail) return NextResponse.json({ error: `${email} is a staff mailbox. Use the consultant's own Gmail.` }, { status: 400 });
  if (other) return NextResponse.json({ error: `${email} is already connected for ${other.consultant.firstName} ${other.consultant.lastName}.` }, { status: 400 });

  const problem = await verifyAppPassword({ email, password });
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const data = {
    email,
    authType: "app_password",
    appPasswordEnc: encrypt(password),
    refreshTokenEnc: null,
    accessTokenEnc: null,
    accessTokenExpiry: null,
    connectedById: access.session.userId,
    connectedAt: new Date(),
    lastError: null,
    // Read from now on (first read looks back two days)
    reqScanAt: null,
  };
  await prisma.consultantMailbox.upsert({ where: { consultantId: id }, create: { consultantId: id, ...data }, update: data });
  return NextResponse.json({ success: true, email });
}

/** DELETE — disconnect the consultant's Gmail (a Google sign-in is revoked at Google too) */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const access = await consultantMailAccess(id);
  if (!access.ok) return access.response;
  await disconnectConsultant(id);
  return NextResponse.json({ success: true });
}
