import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { sendActivationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { userId } = body;
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (Boolean(user.isActive)) {
      return NextResponse.json({ error: "User is already active" }, { status: 400 });
    }

    const activationToken = randomBytes(32).toString("hex");
    const activationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: userId },
      data: { activationToken, activationExpiry },
    });

    await sendActivationEmail(user.email, user.firstName, activationToken);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Resend user activation error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
