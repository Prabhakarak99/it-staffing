import { NextRequest, NextResponse } from "next/server";
import { lookupSubmission } from "@/lib/profit-sharing/data";
import { incentiveSession, placementFor } from "@/lib/incentives/data";

/** GET /api/incentives/lookup?submissionId=Sub-012 — recruiters can load only their own submissions */
export async function GET(req: NextRequest) {
  const a = await incentiveSession();
  if ("response" in a) return a.response;
  const found = await lookupSubmission(req.nextUrl.searchParams.get("submissionId") ?? "", placementFor);
  if (!found) return NextResponse.json({ error: "No submission with that id" }, { status: 404 });
  if (!a.all && found.recruiterId !== a.session.userId) {
    return NextResponse.json({ error: `${found.submissionCode} is not your submission` }, { status: 403 });
  }
  return NextResponse.json(found);
}
