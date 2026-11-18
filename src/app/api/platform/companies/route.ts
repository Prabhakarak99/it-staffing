import { NextRequest, NextResponse } from "next/server";
import { requirePlatform, listCompanies } from "@/lib/tenant/platform";
import { ProvisionError, provisionCompany } from "@/lib/tenant/provision";

/** GET — every company with its usage (Super Admin only) */
export async function GET() {
  const { response } = await requirePlatform();
  if (response) return response;
  return NextResponse.json(await listCompanies());
}

/** POST { name, slug, code, timezone?, attendanceTimezone?, admin: { firstName, lastName, email } } — a new company, ready to use */
export async function POST(req: NextRequest) {
  const { session, response } = await requirePlatform();
  if (response) return response;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const admin = (body.admin ?? {}) as Record<string, unknown>;
  try {
    const result = await provisionCompany({
      name: String(body.name ?? ""),
      slug: String(body.slug ?? ""),
      code: String(body.code ?? ""),
      timezone: typeof body.timezone === "string" ? body.timezone : undefined,
      attendanceTimezone: typeof body.attendanceTimezone === "string" ? body.attendanceTimezone : undefined,
      admin: { firstName: String(admin.firstName ?? ""), lastName: String(admin.lastName ?? ""), email: String(admin.email ?? "") },
      createdById: session.userId,
    });
    return NextResponse.json({ ...result, companies: await listCompanies() }, { status: 201 });
  } catch (err) {
    if (err instanceof ProvisionError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[platform] create company failed:", err);
    return NextResponse.json({ error: "Could not create the company" }, { status: 500 });
  }
}
