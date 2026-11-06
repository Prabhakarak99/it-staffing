import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MAX_RESUME_BYTES, extOf, saveResume } from "@/lib/files/resumes";

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/students/:id/resume (multipart "file") — replace the consultant's resume */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a resume file" }, { status: 400 });
  if (file.size > MAX_RESUME_BYTES) return NextResponse.json({ error: "Resume must be under 10 MB" }, { status: 400 });

  const ext = extOf(file.name);
  if (ext !== "pdf" && ext !== "docx") return NextResponse.json({ error: "Upload a PDF or Word (.docx) resume" }, { status: 400 });

  const student = await prisma.student.findUnique({ where: { id }, select: { id: true } });
  if (!student) return NextResponse.json({ error: "Consultant not found" }, { status: 404 });

  const stored = await saveResume(Buffer.from(await file.arrayBuffer()), ext);
  const updated = await prisma.student.update({
    where: { id },
    data: { resumeFile: stored, resumeFileName: file.name.slice(0, 200), resumeUpdatedAt: new Date() },
    select: { resumeFile: true, resumeFileName: true, resumeUpdatedAt: true },
  });
  return NextResponse.json(updated);
}
