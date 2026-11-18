import { NextRequest, NextResponse } from "next/server";
import { unscopedPrisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { requirePlatform } from "@/lib/tenant/platform";
import { sessionFor } from "@/lib/tenant/session";

/**
 * POST { companyId } — the Super Admin works inside that company (or the platform company, for the
 * shared keys and job sources); { companyId: "all" } — the All companies view (no new records there).
 */
export async function POST(req: NextRequest) {
  const { session, response } = await requirePlatform();
  if (response) return response;
  const { companyId } = (await req.json().catch(() => ({}))) as { companyId?: string };
  const user = await unscopedPrisma.user.findUnique({ where: { id: session.userId }, include: { role: true, company: true } });
  if (!user || !user.isPlatformAdmin || !user.isActive) return NextResponse.json({ error: "Only the Super Admin can switch companies" }, { status: 403 });

  if (companyId === "all") {
    await createSession({ ...(await sessionFor(user, user.company, true)), companyName: "All companies", allCompanies: true });
    return NextResponse.json({ ok: true, companyName: "All companies" });
  }
  const company = companyId ? await unscopedPrisma.company.findUnique({ where: { id: companyId } }) : null;
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  await createSession(await sessionFor(user, company, true));
  return NextResponse.json({ ok: true, companyName: company.name });
}
