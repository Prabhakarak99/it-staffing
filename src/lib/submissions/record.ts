import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

/** Next "Sub-NNN" after the highest one used (a plain count repeats numbers once a row is deleted) */
async function nextSubmissionId() {
  const rows = await prisma.$queryRaw<{ n: number | null }[]>`
    SELECT MAX(CAST(SUBSTRING("submissionId" FROM '^Sub-([0-9]+)$') AS INTEGER)) AS n FROM "Submission"`;
  return `Sub-${String((rows[0]?.n ?? 0) + 1).padStart(3, "0")}`;
}

export type SubmissionData = Omit<Prisma.SubmissionUncheckedCreateInput, "id" | "submissionId" | "submissionDate" | "createdAt" | "updatedAt"> & {
  submissionDate?: Date;
};

/** Creates a submission with the next Sub-NNN id, retrying if two are made at the same moment */
export async function createSubmission(data: SubmissionData) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.submission.create({
        data: { ...data, submissionId: await nextSubmissionId(), submissionDate: data.submissionDate ?? new Date() },
      });
    } catch (err) {
      const clash = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!clash || attempt >= 4) throw err;
    }
  }
}
