import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseConfirmation } from "@/lib/profit-sharing/data";
import { incentiveSession, listPlacements, parseBillRate } from "@/lib/incentives/data";

type RouteContext = { params: Promise<{ id: string }> };

/** The placement, when this user may change it (recruiters: only their own) */
async function mine(a: { session: { userId: string }; all: boolean }, id: string) {
  const row = await prisma.incentivePlacement.findUnique({ where: { id } });
  return row && (a.all || row.recruiterId === a.session.userId) ? row : null;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const a = await incentiveSession();
  if ("response" in a) return a.response;
  const existing = await mine(a, (await params).id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseConfirmation(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const rate = parseBillRate(body.billRate);
  if ("error" in rate) return NextResponse.json({ error: rate.error }, { status: 400 });

  let interview: { interviewRefId: string | null; interviewCode: string | null } | undefined;
  if (body.interviewRefId !== undefined) {
    const found = typeof body.interviewRefId === "string" && body.interviewRefId
      ? await prisma.interview.findFirst({ where: { id: body.interviewRefId, submissionId: existing.submissionRefId }, select: { id: true, interviewId: true } })
      : null;
    interview = { interviewRefId: found?.id ?? null, interviewCode: found?.interviewId ?? null };
  }

  await prisma.incentivePlacement.update({ where: { id: existing.id }, data: { ...parsed.data, billRate: rate.billRate, ...interview } });
  return NextResponse.json(await listPlacements(a.session));
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const a = await incentiveSession();
  if ("response" in a) return a.response;
  const existing = await mine(a, (await params).id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.incentivePlacement.delete({ where: { id: existing.id } });
  return NextResponse.json(await listPlacements(a.session));
}
