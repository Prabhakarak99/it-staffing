import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRequirementsAccess } from "@/lib/jobfeed/access";
import { getJobIngestConfig } from "@/lib/jobfeed/worker";

const BOOL_FIELDS = ["paused", "boardScrapeEnabled", "aiEnabled"] as const;
const INT_FIELDS = {
  crawlIntervalMin: [15, 1440],
  maxCompaniesPerCycle: [1, 100],
  boardScrapeHours: [1, 168],
} as const;

// PATCH /api/job-sources/config — update job feed settings
export async function PATCH(req: NextRequest) {
  const denied = await requireRequirementsAccess();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));

  const data: Record<string, boolean | number> = {};
  for (const f of BOOL_FIELDS) if (typeof body[f] === "boolean") data[f] = body[f];
  for (const [f, [min, max]] of Object.entries(INT_FIELDS)) {
    const v = Number(body[f]);
    if (body[f] !== undefined && Number.isInteger(v)) data[f] = Math.min(max, Math.max(min, v));
  }

  await getJobIngestConfig();
  const config = await prisma.jobIngestConfig.update({ where: { id: "singleton" }, data });
  return NextResponse.json({ config });
}
