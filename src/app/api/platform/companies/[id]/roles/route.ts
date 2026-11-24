import { NextRequest, NextResponse } from "next/server";
import { unscopedPrisma } from "@/lib/prisma";
import { requirePlatform } from "@/lib/tenant/platform";

type Ctx = { params: Promise<{ id: string }> };

/** One company's roles, for picking a transferred user's role there */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { response } = await requirePlatform();
  if (response) return response;
  const { id } = await params;
  const roles = await unscopedPrisma.role.findMany({ where: { companyId: id }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  return NextResponse.json(roles);
}
