import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchCodeVisionPracticeStatus, isCodeVisionConfigured } from "@/lib/codevision";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isCodeVisionConfigured()) {
    return NextResponse.json({ error: "CodeVision integration is not configured." }, { status: 503 });
  }

  try {
    const [practiceStatus, consultants] = await Promise.all([
      fetchCodeVisionPracticeStatus(),
      prisma.student.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          personalPhone: true,
          technology: true,
          projectStatus: true,
        },
      }),
    ]);

    const progressByStudentId = new Map(
      practiceStatus.consultants.map((consultant) => [consultant.externalStudentId, consultant]),
    );

    const rows = consultants.map((consultant) => {
      const progress = progressByStudentId.get(consultant.id) ?? null;
      return {
        id: consultant.id,
        name: `${consultant.firstName} ${consultant.lastName}`.trim(),
        email: consultant.email,
        phoneNumber: consultant.personalPhone,
        technology: consultant.technology,
        projectStatus: consultant.projectStatus,
        provisionedInCodeVision: Boolean(progress),
        overallStatus: progress?.overallStatus ?? "not_started",
        averageScore: progress?.averageScore ?? null,
        completedCount: progress?.completedCount ?? 0,
        totalSessions: progress?.totalSessions ?? 0,
        sessions: progress?.sessions ?? [],
      };
    });

    return NextResponse.json({
      generatedAt: practiceStatus.generatedAt,
      consultantCount: rows.length,
      provisionedCount: rows.filter((row) => row.provisionedInCodeVision).length,
      recordingCount: rows.reduce(
        (total, row) => total + row.sessions.filter((session) => Boolean(session.recordingUrl) || Boolean(session.recordingDriveUrl)).length,
        0,
      ),
      consultants: rows,
    });
  } catch (err) {
    console.error("Otter status fetch failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load practice status." },
      { status: 500 },
    );
  }
}
