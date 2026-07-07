import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isCodeVisionConfigured, resendCodeVisionActivation } from "@/lib/codevision";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isCodeVisionConfigured()) {
    return NextResponse.json({ error: "CodeVision integration is not configured." }, { status: 503 });
  }

  try {
    const body = await req.json();
    const studentId = String(body?.studentId ?? "").trim();

    if (!studentId) {
      return NextResponse.json({ error: "studentId is required." }, { status: 400 });
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    const result = await resendCodeVisionActivation(student.id);

    return NextResponse.json({
      emailSent: true,
      message: "CodeVision practice activation email resent.",
      ...result,
    });
  } catch (err) {
    console.error("Resend CodeVision activation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to resend CodeVision activation email." },
      { status: 500 },
    );
  }
}
