import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { easyAccess } from "@/lib/easy/access";
import { consultantsFor } from "@/lib/easy/data";
import { getActiveAi } from "@/lib/ai/providers";

type RouteContext = { params: Promise<{ id: string }> };

/** GET — consultants to submit for this requirement, plus the requirement details for the email draft */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const access = await easyAccess();
  if (!access.ok) return access.response;

  const { id } = await params;
  const [consultants, sub, ai] = await Promise.all([
    consultantsFor(id),
    prisma.submission.findUnique({
      where: { id },
      select: { technology: true, jobDescription: true, clientName: true, implementationName: true, clientLocation: true, payRate: true },
    }),
    getActiveAi(),
  ]);
  if (!consultants || !sub) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  return NextResponse.json({ consultants, requirement: sub, aiReady: !!ai });
}
