import { NextRequest, NextResponse } from "next/server";
import { companyBySlug } from "@/lib/tenant/session";

/** GET ?slug= — public: the company's display name for its login page (nothing else is shown) */
export async function GET(req: NextRequest) {
  const company = await companyBySlug(req.nextUrl.searchParams.get("slug"));
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  return NextResponse.json({ name: company.name, slug: company.slug, logoFile: company.logoFile, active: company.status === "active" });
}
