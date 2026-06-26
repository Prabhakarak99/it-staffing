import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { sendActivationEmail } from "@/lib/email";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    include: { role: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { firstName, lastName, email, phoneNumber, password, roleId, isActive } = body;

    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

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
