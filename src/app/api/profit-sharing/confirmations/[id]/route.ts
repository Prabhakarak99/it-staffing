import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listConfirmations, parseConfirmation, profitSession } from "@/lib/profit-sharing/data";

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH — change the dates, rate, names or which interview it points at */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const a = await profitSession();
  if ("response" in a) return a.response;
  const { id } = await params;
  const existing = await prisma.confirmation.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseConfirmation(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  let interview: { interviewRefId: string | null; interviewCode: string | null } | undefined;
  if (body.interviewRefId !== undefined) {
    const found = typeof body.interviewRefId === "string" && body.interviewRefId
      ? await prisma.interview.findFirst({ where: { id: body.interviewRefId, submissionId: existing.submissionRefId }, select: { id: true, interviewId: true } })
      : null;
    interview = { interviewRefId: found?.id ?? null, interviewCode: found?.interviewId ?? null };
  }

  await prisma.confirmation.update({ where: { id }, data: { ...parsed.data, ...interview } });
  return NextResponse.json(await listConfirmations());
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const a = await profitSession();
  if ("response" in a) return a.response;
  const { id } = await params;
  await prisma.confirmation.deleteMany({ where: { id } });
  return NextResponse.json(await listConfirmations());
}
