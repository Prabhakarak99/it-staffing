import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { leadScope } from "@/lib/leads/access";
import { isLeadStatus, parseLeadInput } from "@/lib/leads/fields";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const lead = await prisma.lead.findFirst({ where: { id, ...leadScope(session) } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(lead);
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const owned = await prisma.lead.findFirst({ where: { id, ...leadScope(session) }, select: { id: true } });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as Record<string, unknown>;

  // Status-only update from the grid's dropdown
  if (Object.keys(body).length === 1 && "status" in body) {
    if (!isLeadStatus(body.status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    return NextResponse.json(await prisma.lead.update({ where: { id }, data: { status: body.status } }));
  }

  const parsed = parseLeadInput(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const lead = await prisma.lead.update({ where: { id }, data: parsed.data });
  return NextResponse.json(lead);
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const { count } = await prisma.lead.deleteMany({ where: { id, ...leadScope(session) } });
    if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
