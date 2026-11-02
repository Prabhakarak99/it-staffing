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

    // Emails are matched ignoring capitals ("Zindaask@…" = "zindaask@…"). An exact match wins;
    // if several older accounts differ only by case, the one whose password matches signs in.
    const typed = String(email).trim();
    const candidates = await prisma.user.findMany({
      where: { email: { equals: typed, mode: "insensitive" } },
      include: { role: true },
    });
    candidates.sort((a, b) => Number(b.email === typed) - Number(a.email === typed));

    let user: (typeof candidates)[number] | null = null;
    for (const c of candidates) {
      if (await bcrypt.compare(password, c.password)) {
        user = c;
        break;
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    if (!Boolean(user.isActive)) {
      return NextResponse.json({ error: "Invalid credentials or account not active" }, { status: 401 });
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
