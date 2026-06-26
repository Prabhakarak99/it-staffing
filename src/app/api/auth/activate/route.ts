import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { activationToken: token } });

    if (!user) {
      return NextResponse.json({ error: "Invalid or already-used activation link" }, { status: 400 });
    }
    if (Boolean(user.isActive)) {
      return NextResponse.json({ error: "Account is already active" }, { status: 400 });
    }
    if (user.activationExpiry && new Date() > user.activationExpiry) {
      return NextResponse.json({ error: "Activation link has expired" }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, isActive: true, activationToken: null, activationExpiry: null },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
