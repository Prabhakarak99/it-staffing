import { prisma } from "@/lib/prisma";

const UNDO_ID = "undo-requirement-send-submissions";
/** The deploy that made resume sends create Submissions (and the one-time fill-in) went live after this */
const AUTO_FROM = new Date("2026-11-11T23:20:00Z");

/**
 * One time: Submissions are only what recruiters enter. Deletes the ones the app made by itself from
 * Vendor Requirements resume sends: the fill-in (dated exactly when the resume was sent) and any made
 * by a send since (saved within a minute after it). Each must match a send's consultant, recruiter and
 * vendor email. Ones someone already added an interview, follow-up or resume to are kept.
 */
export async function undoRequirementSubmissionsOnce() {
  if (await prisma.appMigration.findUnique({ where: { id: UNDO_ID } })) return;
  const [subs, sends] = await Promise.all([
    prisma.submission.findMany({
      where: { createdAt: { gte: AUTO_FROM } },
      select: {
        id: true, submissionId: true, consultantId: true, recruiterId: true, vendorRecruiterEmail: true, submissionDate: true, createdAt: true,
        _count: { select: { interviews: true, followUps: true, easySends: true, tailoredResumes: true } },
      },
    }),
    prisma.emailRequirementSend.findMany({ where: { status: "sent" }, select: { consultantId: true, senderId: true, toEmail: true, createdAt: true } }),
  ]);
  const key = (consultant: string, user: string, email: string) => `${consultant}|${user}|${email.trim().toLowerCase()}`;
  const sendTimes = new Map<string, number[]>();
  for (const s of sends) {
    const k = key(s.consultantId, s.senderId, s.toEmail);
    sendTimes.set(k, [...(sendTimes.get(k) ?? []), s.createdAt.getTime()]);
  }
  const auto = subs.filter((s) => {
    const times = sendTimes.get(key(s.consultantId, s.recruiterId, s.vendorRecruiterEmail)) ?? [];
    const filledIn = times.includes(s.submissionDate.getTime());
    const madeBySend = times.some((t) => s.createdAt.getTime() >= t && s.createdAt.getTime() - t <= 60_000);
    return filledIn || madeBySend;
  });
  const used = auto.filter((s) => Object.values(s._count).some((n) => n > 0));
  const remove = auto.filter((s) => !used.includes(s));
  await prisma.$transaction([
    prisma.submission.deleteMany({ where: { id: { in: remove.map((s) => s.id) } } }),
    prisma.appMigration.create({ data: { id: UNDO_ID } }),
  ]);
  console.log(
    `[requirements] removed ${remove.length} automatic submission(s)` +
      (used.length ? `; kept ${used.length} already in use: ${used.map((s) => s.submissionId).join(", ")}` : ""),
  );
}
