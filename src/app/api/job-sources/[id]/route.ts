import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRequirementsAccess } from "@/lib/jobfeed/access";

// PATCH /api/job-sources/[id] { isActive?, name? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireRequirementsAccess();
  if (denied) return denied;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const data: { isActive?: boolean; name?: string } = {};
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();

  try {
    const company = await prisma.atsCompany.update({ where: { id }, data });
    return NextResponse.json({ company });
  } catch {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }
}

// DELETE /api/job-sources/[id] — stops crawling it; jobs already loaded stay until they go stale
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireRequirementsAccess();
  if (denied) return denied;
  const { id } = await params;
  try {
    await prisma.atsCompany.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }
}
