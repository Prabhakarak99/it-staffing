import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";
import { dayKeyOf, dayStart } from "@/lib/tz";
import { bonusReasonLabel } from "./bonus";

export const APPRECIATION_SCREEN = { name: "Appreciation", path: "/admin/appreciation" };

/** ₹ for the month's top recruiter in each category; people tied for first share it equally */
export const PRIZE = 5000;
/** The first month that earns awards (handed out on Dec 1, 2026) */
const FIRST_MONTH = "2026-11";

export const CATEGORIES = ["submissions", "interviews"] as const;
export type Category = (typeof CATEGORIES)[number];

const fullName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`.replace(/\s+/g, " ").trim();

const nextMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};
const prevMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};

/**
 * Submissions and interviews per person in a Central-time month, counted the way Reports does:
 * submissions by submission date, interviews once their start time has passed, people who have left
 * (deactivated or past their end date) not counted.
 */
async function counts(month: string, now: Date): Promise<Record<Category, Map<string, number>>> {
  const range = { gte: dayStart(`${month}-01`), lt: dayStart(`${nextMonth(month)}-01`) };
  const active = { isActive: true, OR: [{ endDate: null }, { endDate: { gt: now } }] };
  const [subs, ivs] = await Promise.all([
    prisma.submission.groupBy({ by: ["recruiterId"], where: { submissionDate: range, recruiter: active }, _count: { _all: true } }),
    prisma.interview.groupBy({
      by: ["recruiterId"],
      where: { AND: [{ interviewStartDate: range }, { interviewStartDate: { lte: now } }], recruiter: active },
      _count: { _all: true },
    }),
  ]);
  return {
    submissions: new Map(subs.map((s) => [s.recruiterId, s._count._all])),
    interviews: new Map(ivs.map((s) => [s.recruiterId, s._count._all])),
  };
}

/** Everyone tied on the highest count (none when nobody has any) */
function winners(byUser: Map<string, number>) {
  const top = Math.max(0, ...byUser.values());
  return top === 0 ? [] : [...byUser.entries()].filter(([, n]) => n === top).map(([userId, count]) => ({ userId, count }));
}

let running = false;

/**
 * Hands out last month's awards (and any earlier month missed while the app was down). Each month is
 * settled once, on or after the 1st of the next month, and never recounted afterwards.
 */
export async function ensureAppreciationAwards(now = new Date()) {
  if (running) return;
  running = true;
  try {
    const last = prevMonth(dayKeyOf(now).slice(0, 7));
    for (let month = FIRST_MONTH; month <= last; month = nextMonth(month)) {
      const marker = `appreciation-${month}`;
      if (await prisma.appMigration.findUnique({ where: { id: marker } })) continue;
      const byCategory = await counts(month, now);
      const awards = CATEGORIES.flatMap((category) => {
        const first = winners(byCategory[category]);
        return first.map((w) => ({ month, category, userId: w.userId, count: w.count, amount: Math.round((PRIZE / first.length) * 100) / 100 }));
      });
      await prisma.$transaction([
        prisma.appreciationAward.createMany({ data: awards, skipDuplicates: true }),
        prisma.appMigration.create({ data: { id: marker } }),
      ]);
      console.log(`[appreciation] ${month}: ${awards.length} award(s)`);
    }
  } catch (err) {
    console.error("[appreciation] could not settle awards:", err);
  } finally {
    running = false;
  }
}

/** Super Admin's Additional Bonus popup: current employees and consultants to choose from */
export async function bonusOptions(now = new Date()) {
  const [employees, consultants] = await Promise.all([
    prisma.user.findMany({
      where: { roleId: { not: null }, isActive: true, OR: [{ endDate: null }, { endDate: { gt: now } }] },
      select: { id: true, firstName: true, lastName: true, role: { select: { name: true } } },
    }),
    prisma.student.findMany({
      where: { OR: [{ projectStatus: null }, { projectStatus: { notIn: ["Exit", "ProjectCompleted-Exit"] } }] },
      select: { id: true, firstName: true, lastName: true, technology: true },
    }),
  ]);
  return {
    employees: employees.map((u) => ({ id: u.id, name: fullName(u), role: u.role?.name ?? null })).sort((a, b) => a.name.localeCompare(b.name)),
    consultants: consultants.map((c) => ({ id: c.id, name: fullName(c), technology: c.technology })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export interface AwardRow { id: string; month: string; category: Category; userId: string; name: string; count: number; amount: number }
export interface Standing { userId: string; name: string; count: number }

export interface BonusRow { id: string; userId: string; name: string; reason: string; amount: number; addedBy: string; at: string }

export interface AppreciationBoard {
  awards: AwardRow[];
  /** Additional bonuses a Super Admin added, newest first */
  bonuses: BonusRow[];
  /** Total per person (awards + bonuses), highest first; `wins` counts monthly awards only */
  accounts: { userId: string; name: string; wins: number; bonus: number; total: number }[];
  myTotal: number;
  /** The running month so far: top five in each category */
  current: { month: string; standings: Record<Category, Standing[]> };
}

export async function appreciationBoard(session: SessionPayload, now = new Date()): Promise<AppreciationBoard> {
  const month = dayKeyOf(now).slice(0, 7);
  const [awards, bonuses, live, users] = await Promise.all([
    prisma.appreciationAward.findMany({ orderBy: [{ month: "desc" }, { category: "desc" }] }),
    prisma.appreciationBonus.findMany({ orderBy: { createdAt: "desc" } }),
    counts(month, now),
    prisma.user.findMany({ select: { id: true, firstName: true, lastName: true } }),
  ]);
  const nameOf = new Map(users.map((u) => [u.id, fullName(u)]));
  const name = (id: string) => nameOf.get(id) ?? "Former employee";

  const accounts = new Map<string, { userId: string; name: string; wins: number; bonus: number; total: number }>();
  const account = (userId: string) => {
    let acc = accounts.get(userId);
    if (!acc) accounts.set(userId, (acc = { userId, name: name(userId), wins: 0, bonus: 0, total: 0 }));
    return acc;
  };
  for (const a of awards) {
    const acc = account(a.userId);
    acc.wins++;
    acc.total += a.amount;
  }
  for (const b of bonuses) {
    const acc = account(b.userId);
    acc.bonus += b.amount;
    acc.total += b.amount;
  }
  const top5 = (byUser: Map<string, number>): Standing[] =>
    [...byUser.entries()].map(([userId, count]) => ({ userId, name: name(userId), count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 5);

  return {
    awards: awards.map((a) => ({ id: a.id, month: a.month, category: a.category as Category, userId: a.userId, name: name(a.userId), count: a.count, amount: a.amount })),
    bonuses: bonuses.map((b) => ({
      id: b.id, userId: b.userId, name: name(b.userId), reason: bonusReasonLabel(b), amount: b.amount,
      addedBy: nameOf.get(b.createdById) ?? "Super Admin", at: b.createdAt.toISOString(),
    })),
    accounts: [...accounts.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
    myTotal: accounts.get(session.userId)?.total ?? 0,
    current: { month, standings: { submissions: top5(live.submissions), interviews: top5(live.interviews) } },
  };
}
