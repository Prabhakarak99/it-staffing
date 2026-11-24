import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { sendActivationEmail } from "@/lib/email";
import { emailConflict } from "@/lib/tenant/user-email";
import { SAFE_USER_OMIT, canManageUsers } from "@/lib/user-safe";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    include: { role: true },
    omit: SAFE_USER_OMIT,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Only admins (Company Admin, or a role with the Users screen) may change users
  if (!canManageUsers(session)) return NextResponse.json({ error: "Only an admin can manage users" }, { status: 403 });

  try {
    const body = await req.json();
    const { firstName, lastName, phoneNumber, password, roleId, isActive } = body;
    // Stored lowercase so sign-in never depends on how the admin typed it
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Unique inside this company; an account in another company is fine once it is deactivated there
    const conflict = await emailConflict(email, session.companyId);
    if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });

    const hashed = await bcrypt.hash(password, 12);
    const activationToken = randomBytes(32).toString("hex");
    const activationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const active = isActive === "true" || isActive === true;

    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        phoneNumber: phoneNumber || null,
        password: hashed,
        roleId: roleId || null,
        isActive: active,
        activationToken: active ? null : activationToken,
        activationExpiry: active ? null : activationExpiry,
      },
    });

    let emailSent = false;
    let emailError: string | null = null;

    if (!active) {
      try {
        await sendActivationEmail(email, firstName, activationToken);
        emailSent = true;
      } catch (emailErr) {
        emailError = emailErr instanceof Error ? emailErr.message : "Unknown email error";
        console.error("Failed to send activation email:", emailErr);
      }
    }

    return NextResponse.json({ id: user.id, emailSent, emailError }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
