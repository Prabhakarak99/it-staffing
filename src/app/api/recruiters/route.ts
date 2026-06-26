import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { sendActivationEmail } from "@/lib/email";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const recruiterRole = await prisma.role.findUnique({ where: { name: "Recruiter" } });

  const recruiters = await prisma.user.findMany({
    where: recruiterRole ? { roleId: recruiterRole.id } : {},
    include: { role: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(recruiters);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { firstName, lastName, email, phoneNumber, businessNumber, startDate, endDate, roleId } = body;

    if (!firstName || !lastName || !email || !startDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
    }

    const activationToken = randomBytes(32).toString("hex");
    const activationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Use provided roleId or fall back to the Recruiter role
    let resolvedRoleId = roleId || null;
    if (!resolvedRoleId) {
      const recruiterRole = await prisma.role.findUnique({ where: { name: "Recruiter" } });
      resolvedRoleId = recruiterRole?.id ?? null;
    }

    const recruiter = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        phoneNumber: phoneNumber || null,
        businessNumber: businessNumber || null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        roleId: resolvedRoleId,
        isActive: false,
        password: "",
        activationToken,
        activationExpiry,
      },
    });

    let emailSent = false;
    let emailError: string | null = null;
    try {
      await sendActivationEmail(email, firstName, activationToken);
      emailSent = true;
    } catch (err) {
      emailError = err instanceof Error ? err.message : "Email send failed";
      console.error("Recruiter activation email failed:", err);
    }

    return NextResponse.json({ id: recruiter.id, emailSent, emailError }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
