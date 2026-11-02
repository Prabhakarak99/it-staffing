import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// POST /api/auth/reset-password { token, password } — public; the emailed token is the credential
export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (typeof token !== "string" || !token || typeof password !== "string" || !password) {
      return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
    }
    // Same rules the form shows
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json({ error: "Password must be at least 8 characters with an uppercase letter and a number" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { resetToken: token } });
    if (!user) {
      return NextResponse.json({ error: "Invalid or already-used reset link" }, { status: 400 });
    }
    if (!user.isActive) {
      return NextResponse.json({ error: "This account is disabled. Please contact your administrator." }, { status: 400 });
    }
    if (!user.resetExpiry || new Date() > user.resetExpiry) {
      return NextResponse.json({ error: "This reset link has expired. Please ask your administrator for a new one." }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(password, 12), resetToken: null, resetExpiry: null },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
