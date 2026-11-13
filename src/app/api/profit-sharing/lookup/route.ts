import { NextRequest, NextResponse } from "next/server";
import { lookupSubmission, profitSession } from "@/lib/profit-sharing/data";

/** GET /api/profit-sharing/lookup?submissionId=Sub-012 — the submission's details and interviews */
export async function GET(req: NextRequest) {
  const a = await profitSession();
  if ("response" in a) return a.response;
  const found = await lookupSubmission(req.nextUrl.searchParams.get("submissionId") ?? "");
  if (!found) return NextResponse.json({ error: "No submission with that id" }, { status: 404 });
  return NextResponse.json(found);
}
