import { prisma, unscopedPrisma } from "@/lib/prisma";
import { currentCompanyId } from "@/lib/tenant/context";
import { Prisma } from "@/generated/prisma/client";

/** The company's 3-letter code (GEN, DAT, ...) used in submission ids */
export async function companyCode() {
  const id = await currentCompanyId();
  const c = await unscopedPrisma.company.findUnique({ where: { id }, select: { code: true } });
  if (!c) throw new Error("Company not found");
  return c.code;
}

/**
 * Next "Sub-<code>-NNN" for this company, after its highest one (a plain count repeats numbers once a
 * row is deleted). Raw SQL is not covered by the company filter, so it names the company itself.
 */
export async function nextSubmissionId() {
  const companyId = await currentCompanyId();
  const code = await companyCode();
  const pattern = `^Sub-${code}-([0-9]+)$`;
  const rows = await prisma.$queryRaw<{ n: number | null }[]>`
    SELECT MAX(CAST(SUBSTRING("submissionId" FROM ${pattern}) AS INTEGER)) AS n FROM "Submission" WHERE "companyId" = ${companyId}`;
  return `Sub-${code}-${String((rows[0]?.n ?? 0) + 1).padStart(3, "0")}`;
}

export type SubmissionData = Omit<Prisma.SubmissionUncheckedCreateInput, "id" | "submissionId" | "submissionDate" | "createdAt" | "updatedAt"> & {
  submissionDate?: Date;
};

/** Creates a submission with the next Sub-<code>-NNN id, retrying if two are made at the same moment */
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
