import { NextRequest, NextResponse } from "next/server";
import { unscopedPrisma } from "@/lib/prisma";
import { requirePlatform, listCompanies } from "@/lib/tenant/platform";
import { PLATFORM_COMPANY_ID } from "@/lib/tenant/context";

type Ctx = { params: Promise<{ id: string }> };

const TIMEZONES = new Set(Intl.supportedValuesOf("timeZone"));

/**
 * PATCH { name?, status? (active | suspended), timezone?, attendanceTimezone?, disabledModules?, maxUsers? }
 * The login name (slug) and code stay fixed: links and submission ids depend on them.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { response } = await requirePlatform();
  if (response) return response;
  const { id } = await params;
  const company = await unscopedPrisma.company.findUnique({ where: { id } });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    if (!body.name.trim()) return NextResponse.json({ error: "Enter the company name" }, { status: 400 });
    data.name = body.name.trim().slice(0, 120);
  }
  if (body.status !== undefined) {
    if (body.status !== "active" && body.status !== "suspended") return NextResponse.json({ error: "Status is active or suspended" }, { status: 400 });
    if (id === PLATFORM_COMPANY_ID) return NextResponse.json({ error: "The platform cannot be suspended" }, { status: 400 });
    data.status = body.status;
  }
  for (const key of ["timezone", "attendanceTimezone"] as const) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== "string" || !TIMEZONES.has(body[key] as string)) return NextResponse.json({ error: `Unknown time zone: ${String(body[key])}` }, { status: 400 });
    data[key] = body[key];
  }
  if (body.disabledModules !== undefined) {
    if (!Array.isArray(body.disabledModules)) return NextResponse.json({ error: "disabledModules must be a list of screen paths" }, { status: 400 });
    const screens = new Set((await unscopedPrisma.screen.findMany({ select: { path: true } })).map((s) => s.path));
    const paths = body.disabledModules.map(String).filter((p) => screens.has(p) && p !== "/admin");
    data.disabledModules = [...new Set(paths)];
  }
  if (body.maxUsers !== undefined) {
    const n = body.maxUsers === null || body.maxUsers === "" ? null : Number(body.maxUsers);
    if (n !== null && (!Number.isInteger(n) || n < 1)) return NextResponse.json({ error: "User limit: a whole number, or empty for no limit" }, { status: 400 });
    data.maxUsers = n;
  }
  await unscopedPrisma.company.update({ where: { id }, data });
  return NextResponse.json(await listCompanies());
}
