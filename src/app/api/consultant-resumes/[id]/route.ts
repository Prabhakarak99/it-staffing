import { NextResponse } from "next/server";
import { listAiResumes, resumesAccess } from "@/lib/resumes/data";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/consultant-resumes/:id — the consultant's AI resumes, each with its JD */
export async function GET(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  const access = await resumesAccess(id);
  if (!access.ok) return access.response;
  return NextResponse.json(await listAiResumes(id));
}
