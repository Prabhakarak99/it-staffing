import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import { canManageUsers } from "@/lib/user-safe";

export const maxDuration = 300;

const RESET_TTL_MS = 24 * 60 * 60 * 1000;

async function sendReset(user: { id: string; email: string; firstName: string }) {
  const resetToken = randomBytes(32).toString("hex");
  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken, resetExpiry: new Date(Date.now() + RESET_TTL_MS) },
  });
  await sendPasswordResetEmail(user.email, user.firstName, resetToken);
}

/**
 * POST /api/users/send-password-reset — admins only.
 *   { userId }    → email one active user a reset link
 *   { all: true } → email every active user except the admin sending it
 * Pending (not yet activated) users get the activation email instead, from "Resend".
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session)) return NextResponse.json({ error: "Only admins can send password reset links" }, { status: 403 });

  const body = await req.json().catch(() => ({}));

  if (body.all === true) {
    const users = await prisma.user.findMany({
      where: { isActive: true, id: { not: session.userId } },
      select: { id: true, email: true, firstName: true },
    });
    let sent = 0;
    const failed: string[] = [];
    // One at a time: Gmail SMTP throttles bursts
    for (const u of users) {
      try {
        await sendReset(u);
        sent++;
      } catch (err) {
        console.error(`Password reset email to ${u.email} failed:`, err);
        failed.push(u.email);
      }
    }
    return NextResponse.json({ sent, failed });
  }

  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) return NextResponse.json({ error: "userId or all is required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, firstName: true, isActive: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!user.isActive) {
    return NextResponse.json({ error: "This user hasn't activated their account yet — use Resend to send the activation email." }, { status: 400 });
  }

  try {
    await sendReset(user);
  } catch (err) {
    console.error("Password reset email failed:", err);
    return NextResponse.json({ error: "Could not send the email. Check the SMTP settings." }, { status: 502 });
  }
  return NextResponse.json({ sent: 1, failed: [] });
}
