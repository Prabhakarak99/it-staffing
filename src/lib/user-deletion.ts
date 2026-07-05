import { prisma } from "@/lib/prisma";

export async function getUserRelationCounts(userId: string) {
  const [submissions, interviews, expenses, preMarketings] = await Promise.all([
    prisma.submission.count({ where: { recruiterId: userId } }),
    prisma.interview.count({ where: { recruiterId: userId } }),
    prisma.expense.count({ where: { submittedById: userId } }),
    prisma.preMarketing.count({ where: { recruiterId: userId } }),
  ]);
  return { submissions, interviews, expenses, preMarketings };
}

export function userDeleteBlockMessage(counts: Awaited<ReturnType<typeof getUserRelationCounts>>) {
  const parts: string[] = [];
  if (counts.submissions) parts.push(`${counts.submissions} submission${counts.submissions === 1 ? "" : "s"}`);
  if (counts.interviews) parts.push(`${counts.interviews} interview${counts.interviews === 1 ? "" : "s"}`);
  if (counts.expenses) parts.push(`${counts.expenses} expense${counts.expenses === 1 ? "" : "s"}`);
  if (counts.preMarketings) parts.push(`${counts.preMarketings} pre-marketing record${counts.preMarketings === 1 ? "" : "s"}`);

  if (parts.length === 0) return null;

  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
  return `Cannot delete this user because they are linked to ${list}. Disable the account instead.`;
}
