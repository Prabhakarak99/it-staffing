import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getAutoJobsConfig } from "@/lib/autojobs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [config, vendorContactCount, sentToday, queuedCount, repliedCount, runs] =
    await Promise.all([
      getAutoJobsConfig(),
      prisma.vendorContact.count(),
      prisma.autoJobApplication.count({
        where: { emailStatus: "sent", sentAt: { gte: startOfDay } },
      }),
      prisma.autoJobApplication.count({ where: { emailStatus: "queued" } }),
      prisma.autoJobApplication.count({ where: { emailStatus: "replied" } }),
      prisma.autoJobRun.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          _count: { select: { applications: true } },
        },
      }),
    ]);

  // Attach trigger submission context
  const submissionIds = [...new Set(runs.map((r) => r.triggerSubmissionId))];
  const submissions = await prisma.submission.findMany({
    where: { id: { in: submissionIds } },
    select: {
      id: true,
      submissionId: true,
      consultant: { select: { firstName: true, lastName: true } },
      recruiter: { select: { firstName: true, lastName: true } },
    },
  });
  const submissionMap = new Map(submissions.map((s) => [s.id, s]));

  return NextResponse.json({
    config,
    summary: { vendorContactCount, sentToday, queuedCount, repliedCount },
    runs: runs.map((run) => {
      const trigger = submissionMap.get(run.triggerSubmissionId);
      return {
        id: run.id,
        clientName: run.clientName,
        technology: run.technology,
        status: run.status,
        note: run.note,
        matchedConsultants: run.matchedConsultants,
        vendorsFound: run.vendorsFound,
        emailsSent: run.emailsSent,
        applicationCount: run._count.applications,
        createdAt: run.createdAt,
        triggerSubmissionCode: trigger?.submissionId ?? null,
        triggerConsultant: trigger
          ? `${trigger.consultant.firstName} ${trigger.consultant.lastName}`.trim()
          : null,
        triggerRecruiter: trigger
          ? `${trigger.recruiter.firstName} ${trigger.recruiter.lastName}`.trim()
          : null,
      };
    }),
  });
}
