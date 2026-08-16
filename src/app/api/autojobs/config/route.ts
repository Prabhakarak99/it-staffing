import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getAutoJobsConfig } from "@/lib/autojobs";

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  await getAutoJobsConfig(); // ensure singleton row exists

  const data: Record<string, unknown> = {};
  if (typeof body.paused === "boolean") data.paused = body.paused;
  if (typeof body.autoSend === "boolean") data.autoSend = body.autoSend;
  if (Number.isInteger(body.dailyCap) && body.dailyCap >= 0 && body.dailyCap <= 2000) {
    data.dailyCap = body.dailyCap;
  }
  if (
    Number.isInteger(body.maxVendorsPerRun) &&
    body.maxVendorsPerRun > 0 &&
    body.maxVendorsPerRun <= 500
  ) {
    data.maxVendorsPerRun = body.maxVendorsPerRun;
  }
  if (Number.isInteger(body.cooldownDays) && body.cooldownDays >= 0 && body.cooldownDays <= 365) {
    data.cooldownDays = body.cooldownDays;
  }

  const config = await prisma.autoJobsConfig.update({
    where: { id: "singleton" },
    data,
  });

  return NextResponse.json(config);
}
