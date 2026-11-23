import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { unscopedPrisma } from "@/lib/prisma";
import { requirePlatform } from "@/lib/tenant/platform";
import { validatePassword } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export interface CompanyUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  /** Never chose a password (the activation link was not used) */
  pendingActivation: boolean;
  isPlatformAdmin: boolean;
}

async function listUsers(companyId: string): Promise<CompanyUserRow[]> {
  const users = await unscopedPrisma.user.findMany({
    where: { companyId },
    select: { id: true, firstName: true, lastName: true, email: true, isActive: true, isPlatformAdmin: true, activationToken: true, role: { select: { name: true } } },
    orderBy: [{ isActive: "desc" }, { firstName: "asc" }],
  });
  return users.map((u) => ({
    id: u.id,
    name: `${u.firstName} ${u.lastName}`.trim(),
    email: u.email,
    role: u.role?.name ?? "Company Admin",
    isActive: u.isActive,
    pendingActivation: !u.isActive && !!u.activationToken,
    isPlatformAdmin: u.isPlatformAdmin,
  }));
}

async function findCompany(id: string) {
  const company = await unscopedPrisma.company.findUnique({ where: { id }, select: { id: true, kind: true, maxUsers: true } });
  return company?.kind === "company" ? company : null;
}

/** Every user of one company, for the Super Admin console */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { response } = await requirePlatform();
  if (response) return response;
  const { id } = await params;
  if (!(await findCompany(id))) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  return NextResponse.json(await listUsers(id));
}

/**
 * PATCH { userId, password?, isActive? }
 * - password: the Super Admin sets it directly; this also activates the account (no email needed)
 * - isActive: activate or deactivate the account
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { session, response } = await requirePlatform();
  if (response) return response;
  const { id } = await params;
  const company = await findCompany(id);
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const user = await unscopedPrisma.user.findFirst({ where: { id: String(body.userId ?? ""), companyId: id } });
  if (!user) return NextResponse.json({ error: "User not found in this company" }, { status: 404 });

  const password = typeof body.password === "string" ? body.password : undefined;
  const wantActive = typeof body.isActive === "boolean" ? body.isActive : password !== undefined ? true : undefined;
  if (password === undefined && wantActive === undefined) return NextResponse.json({ error: "Nothing to change" }, { status: 400 });

  if (password !== undefined) {
    const err = validatePassword(password);
    if (err) return NextResponse.json({ error: `Password: ${err}` }, { status: 400 });
  }
  if (wantActive === false) {
    if (user.id === session.userId) return NextResponse.json({ error: "You can't deactivate your own account" }, { status: 400 });
    if (user.isPlatformAdmin) return NextResponse.json({ error: "A Super Admin account can't be deactivated here" }, { status: 400 });
  }
  if (wantActive === true && !user.isActive) {
    if (password === undefined && user.activationToken) {
      return NextResponse.json({ error: "This user never chose a password. Set a password to activate the account." }, { status: 400 });
    }
    if (company.maxUsers != null) {
      const active = await unscopedPrisma.user.count({ where: { companyId: id, isActive: true } });
      if (active >= company.maxUsers) return NextResponse.json({ error: `This company is at its limit of ${company.maxUsers} active users` }, { status: 400 });
    }
  }

  await unscopedPrisma.user.update({
    where: { id: user.id },
    data: {
      ...(password !== undefined
        ? { password: await bcrypt.hash(password, 12), activationToken: null, activationExpiry: null, resetToken: null, resetExpiry: null }
        : {}),
      ...(wantActive !== undefined ? { isActive: wantActive } : {}),
    },
  });
  return NextResponse.json(await listUsers(id));
}
