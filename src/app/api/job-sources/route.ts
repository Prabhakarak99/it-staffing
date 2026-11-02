import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRequirementsAccess } from "@/lib/jobfeed/access";
import { parseCareersUrl, probeBoard } from "@/lib/jobfeed/ats";
import { getJobFeedOverview } from "@/lib/jobfeed/overview";

// GET /api/job-sources — boards, settings and pipeline counts for the Sources page
export async function GET() {
  const denied = await requireRequirementsAccess();
  if (denied) return denied;
  return NextResponse.json(await getJobFeedOverview());
}

// POST /api/job-sources { url, name? } — add one careers board after checking it exists
export async function POST(req: NextRequest) {
  const denied = await requireRequirementsAccess();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const parsed = parseCareersUrl(String(body.url ?? ""));
  if (!parsed) {
    return NextResponse.json(
      { error: "Unrecognised careers URL. Supported: Greenhouse, Lever, Ashby, SmartRecruiters and Workday career pages." },
      { status: 400 },
    );
  }

  const exists = await prisma.atsCompany.findUnique({
    where: { provider_boardToken_workdaySite: { provider: parsed.provider, boardToken: parsed.boardToken, workdaySite: parsed.workdaySite } },
  });
  if (exists) return NextResponse.json({ error: `${exists.name} is already in the list.` }, { status: 409 });

  let postings: number;
  try {
    postings = await probeBoard(parsed);
  } catch (err) {
    return NextResponse.json(
      { error: `Could not read that board (${err instanceof Error ? err.message : "request failed"}). Check the URL.` },
      { status: 400 },
    );
  }

  // SmartRecruiters answers any company id with an empty list instead of a 404
  if (parsed.provider === "smartrecruiters" && postings === 0) {
    return NextResponse.json(
      { error: "SmartRecruiters returned no postings for that company ID. Check the spelling (it is case-sensitive)." },
      { status: 400 },
    );
  }

  const company = await prisma.atsCompany.create({
    data: {
      name: String(body.name ?? "").trim() || parsed.suggestedName,
      provider: parsed.provider,
      boardToken: parsed.boardToken,
      workdayHost: parsed.workdayHost,
      workdaySite: parsed.workdaySite,
    },
  });
  return NextResponse.json({ company, postings }, { status: 201 });
}
