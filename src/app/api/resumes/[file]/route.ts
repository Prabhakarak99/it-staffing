import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RESUME_TYPES, extOf, isStoredName, readResume } from "@/lib/files/resumes";

type RouteContext = { params: Promise<{ file: string }> };

/** GET /api/resumes/:file — signed-in users only; downloads under the original / generated file name */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { file } = await params;
  if (!isStoredName(file)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [student, tailored] = await Promise.all([
    prisma.student.findFirst({ where: { resumeFile: file }, select: { resumeFileName: true } }),
    prisma.tailoredResume.findFirst({ where: { file }, select: { fileName: true } }),
  ]);
  const downloadName = student?.resumeFileName ?? tailored?.fileName;
  if (!downloadName) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const bytes = await readResume(file);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": RESUME_TYPES[extOf(file)] ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${downloadName.replace(/[^\w.\- ]/g, "_")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "File is missing" }, { status: 404 });
  }
}
