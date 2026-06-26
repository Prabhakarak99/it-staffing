import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!user || !Boolean(user.isActive)) {
      return NextResponse.json({ error: "Invalid credentials or account not active" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Super admin (no roleId) gets null = unrestricted access
    // Role-based users get the list of paths their role can view
    let allowedScreens: string[] | null = null;
    if (user.roleId) {
      const roleScreens = await prisma.roleScreen.findMany({
        where: { roleId: user.roleId, canView: true },
        include: { screen: true },
      });
      allowedScreens = roleScreens.map((rs) => rs.screen.path);
    }

    await createSession({
      userId: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role?.name ?? null,
      allowedScreens,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
