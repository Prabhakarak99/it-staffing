import { NextRequest, NextResponse } from "next/server";
import { unscopedPrisma } from "@/lib/prisma";
import { requirePlatform } from "@/lib/tenant/platform";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST { userId, toCompanyId, roleId? } — moves a user from this company to another one.
 *
 * Each company keeps its own records, so the user's history (submissions, attendance, assigned
 * consultants…) stays with this company under the old account, which is deactivated. The other company
 * gets an active account with the same name, email, details and password (an earlier deactivated account
 * there is switched back on instead). roleId: a role of the other company; "" = Company Admin; left out =
 * the role with the same name there.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { session, response } = await requirePlatform();
  if (response) return response;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const user = await unscopedPrisma.user.findFirst({ where: { id: String(body.userId ?? ""), companyId: id }, include: { role: true } });
  if (!user) return NextResponse.json({ error: "User not found in this company" }, { status: 404 });
  if (user.isPlatformAdmin || user.id === session.userId) return NextResponse.json({ error: "The Super Admin account can't be transferred" }, { status: 400 });
  if (user.activationToken) {
    return NextResponse.json({ error: "This user never activated the account. Set their password first, or add them directly in the other company." }, { status: 400 });
  }

  const target = await unscopedPrisma.company.findUnique({ where: { id: String(body.toCompanyId ?? "") } });
  if (!target || target.kind !== "company") return NextResponse.json({ error: "Choose the company to move the user to" }, { status: 400 });
  if (target.id === id) return NextResponse.json({ error: "The user is already in this company" }, { status: 400 });

  // The role in the other company
  let roleId: string | null;
  if (body.roleId === "") roleId = null;
  else if (typeof body.roleId === "string") {
    const role = await unscopedPrisma.role.findFirst({ where: { id: body.roleId, companyId: target.id }, select: { id: true } });
    if (!role) return NextResponse.json({ error: `That role is not in ${target.name}` }, { status: 400 });
    roleId = role.id;
  } else if (!user.role) roleId = null;
  else {
    const same = await unscopedPrisma.role.findFirst({ where: { companyId: target.id, name: user.role.name }, select: { id: true } });
    if (!same) return NextResponse.json({ error: `${target.name} has no "${user.role.name}" role. Choose a role.` }, { status: 400 });
    roleId = same.id;
  }

  const existing = await unscopedPrisma.user.findFirst({ where: { companyId: target.id, email: { equals: user.email, mode: "insensitive" } } });
  if (existing?.isActive) return NextResponse.json({ error: `${user.email} already has an active account in ${target.name}` }, { status: 409 });
  if (target.maxUsers != null) {
    const active = await unscopedPrisma.user.count({ where: { companyId: target.id, isActive: true } });
    if (active >= target.maxUsers) return NextResponse.json({ error: `${target.name} is at its limit of ${target.maxUsers} active users` }, { status: 400 });
  }

  const today = new Date();
  const profile = {
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber,
    password: user.password, // same password at the new company's link
    easySubmissionsEnabled: user.easySubmissionsEnabled,
    emailSignature: user.emailSignature,
    businessNumber: user.businessNumber,
    fullAddress: user.fullAddress,
    experience: user.experience,
    salary: user.salary,
    bankName: user.bankName,
    accountNumber: user.accountNumber,
    ifscCode: user.ifscCode,
    bankBranch: user.bankBranch,
    accountType: user.accountType,
    blackChequeDocument: user.blackChequeDocument,
    roleId,
    isActive: true,
    startDate: today,
    endDate: null,
    activationToken: null,
    activationExpiry: null,
    resetToken: null,
    resetExpiry: null,
  };

  await unscopedPrisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { isActive: false, endDate: user.endDate ?? today, resetToken: null, resetExpiry: null } });
    if (existing) await tx.user.update({ where: { id: existing.id }, data: profile });
    else await tx.user.create({ data: { ...profile, companyId: target.id, email: user.email } });
  });

  return NextResponse.json({ ok: true, to: { name: target.name, slug: target.slug }, reused: !!existing });
}
