import { NextResponse } from "next/server";
import { aiAdminSession } from "@/lib/ai/admin";
import { listJobApis } from "@/lib/jobfeed/apis";

/** GET /api/job-apis — the six job-data providers with their settings and last-run status (admins) */
export async function GET() {
  const { response } = await aiAdminSession();
  if (response) return response;
  return NextResponse.json(await listJobApis());
}
