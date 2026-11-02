import { NextResponse } from "next/server";
import { requireRequirementsAccess } from "@/lib/jobfeed/access";
import { isJobFeedRunning, processJobFeed } from "@/lib/jobfeed/worker";

// POST /api/job-sources/run — start a worker cycle now (runs in the background)
export async function POST() {
  const denied = await requireRequirementsAccess();
  if (denied) return denied;
  if (isJobFeedRunning()) return NextResponse.json({ started: false, message: "A run is already in progress." });
  void processJobFeed({ force: true });
  return NextResponse.json({ started: true }, { status: 202 });
}
