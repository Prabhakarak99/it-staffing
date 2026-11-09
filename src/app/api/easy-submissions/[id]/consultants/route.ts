import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { easyAccess } from "@/lib/easy/access";
import { consultantsFor } from "@/lib/easy/data";
import { getActiveAi } from "@/lib/ai/providers";

type RouteContext = { params: Promise<{ id: string }> };

/** GET — other consultants to submit for this requirement, plus the requirement details for the email draft */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const access = await easyAccess();
  if (!access.ok) return access.response;

  const { id } = await params;
  const [found, sub, ai] = await Promise.all([
    consultantsFor(id),
    prisma.submission.findUnique({
      where: { id },
      select: { technology: true, jobDescription: true, clientName: true, implementationName: true, clientLocation: true, payRate: true },
    }),
    getActiveAi(),
  ]);
  if (!found || !sub) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  // `technology` is what the list was matched on: the submitted consultant's profile technology
  return NextResponse.json({ consultants: found.consultants, technology: found.technology, requirement: sub, aiReady: !!ai });
}
