import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { unscopedPrisma } from "@/lib/prisma";
import { requirePlatform, listCompanies } from "@/lib/tenant/platform";
import { sendActivationEmail, sendPasswordResetEmail } from "@/lib/email";

type Ctx = { params: Promise<{ id: string }> };

const sendError = (err: unknown) => (err instanceof Error ? err.message : "Could not send the email");

/** POST { firstName, lastName, email } — another Company Admin (no role = every screen in the company) */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { response } = await requirePlatform();
  if (response) return response;
  const { id } = await params;
  const company = await unscopedPrisma.company.findUnique({ where: { id } });
  if (!company || company.kind !== "company") return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!firstName || !lastName || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter first name, last name and a valid email" }, { status: 400 });
  if (await unscopedPrisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } })) {
    return NextResponse.json({ error: "That email already has an account" }, { status: 409 });
  }
  const activationToken = randomBytes(32).toString("hex");
  const user = await unscopedPrisma.user.create({
    data: {
      companyId: company.id, firstName, lastName, email, roleId: null, isActive: false,
      password: await bcrypt.hash(randomBytes(24).toString("hex"), 12),
      activationToken, activationExpiry: new Date(Date.now() + 7 * 86_400_000),
    },
  });
  let emailError: string | null = null;
  await sendActivationEmail(user.email, user.firstName, activationToken).catch((err) => (emailError = sendError(err)));
  return NextResponse.json({ emailSent: !emailError, emailError, companies: await listCompanies() }, { status: 201 });
}

/** PATCH { userId, action: "resend-activation" | "reset-password" } — for one of this company's admins */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { response } = await requirePlatform();
  if (response) return response;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const user = await unscopedPrisma.user.findFirst({ where: { id: String(body.userId ?? ""), companyId: id, roleId: null } });
  if (!user) return NextResponse.json({ error: "Admin not found in this company" }, { status: 404 });

  const token = randomBytes(32).toString("hex");
  let emailError: string | null = null;
  if (body.action === "resend-activation") {
    if (user.isActive) return NextResponse.json({ error: "This admin is already active" }, { status: 400 });
    await unscopedPrisma.user.update({ where: { id: user.id }, data: { activationToken: token, activationExpiry: new Date(Date.now() + 7 * 86_400_000) } });
    await sendActivationEmail(user.email, user.firstName, token).catch((err) => (emailError = sendError(err)));
  } else if (body.action === "reset-password") {
    await unscopedPrisma.user.update({ where: { id: user.id }, data: { resetToken: token, resetExpiry: new Date(Date.now() + 86_400_000) } });
    await sendPasswordResetEmail(user.email, user.firstName, token).catch((err) => (emailError = sendError(err)));
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  return NextResponse.json({ emailSent: !emailError, emailError });
}
