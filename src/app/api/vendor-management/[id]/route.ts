import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVendorAccess, ownedWhere } from "@/lib/vendors/access";
import { parseVendorInput } from "@/lib/vendors/input";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/vendor-management/:id — edit a contact (owner or admin) */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const access = await getVendorAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params;

  const vendor = await prisma.recruiterVendor.findFirst({ where: { id, ...ownedWhere(access) } });
  if (!vendor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const input = parseVendorInput(await req.json());
  if (typeof input === "string") return NextResponse.json({ error: input }, { status: 400 });

  if (input.email !== vendor.email) {
    const clash = await prisma.recruiterVendor.findUnique({
      where: { ownerId_email: { ownerId: vendor.ownerId, email: input.email } },
    });
    if (clash) return NextResponse.json({ error: "Another contact in this vendor book already uses this email" }, { status: 409 });
  }

  const updated = await prisma.recruiterVendor.update({ where: { id }, data: input });
  return NextResponse.json(updated);
}

/** DELETE /api/vendor-management/:id — owner or admin */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const access = await getVendorAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params;

  const { count } = await prisma.recruiterVendor.deleteMany({ where: { id, ...ownedWhere(access) } });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
