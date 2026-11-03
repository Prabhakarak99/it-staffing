import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVendorAccess } from "@/lib/vendors/access";
import { parseVendorInput } from "@/lib/vendors/input";
import { listVendors } from "@/lib/vendors/list";

/** GET /api/vendor-management — the caller's vendor contacts (admins: everyone's, with the owner) */
export async function GET() {
  const access = await getVendorAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  return NextResponse.json(await listVendors(access));
}

/** POST /api/vendor-management — add a contact to the caller's own vendor book */
export async function POST(req: NextRequest) {
  const access = await getVendorAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const input = parseVendorInput(await req.json());
  if (typeof input === "string") return NextResponse.json({ error: input }, { status: 400 });

  const ownerId = access.session.userId;
  const existing = await prisma.recruiterVendor.findUnique({ where: { ownerId_email: { ownerId, email: input.email } } });
  if (existing) return NextResponse.json({ error: "You already have a vendor contact with this email" }, { status: 409 });

  const vendor = await prisma.recruiterVendor.create({ data: { ...input, ownerId } });
  return NextResponse.json(vendor, { status: 201 });
}
