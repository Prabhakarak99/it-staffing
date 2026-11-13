// Incentive maths. No server imports: pure functions over "yyyy-mm-dd" day keys.

/** ₹ per month for each $1 of hourly bill rate ($70/hr → ₹7,000 a month) */
export const RUPEES_PER_RATE_DOLLAR = 100;
/** The incentive starts this many months after the project start date (Nov 1 → Jan 1) */
export const WAIT_MONTHS = 2;

const parts = (key: string) => key.split("-").map(Number) as [number, number, number];
const pad = (n: number) => String(n).padStart(2, "0");
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Same day of the month n months later; the last day when that month is shorter (Dec 31 → Feb 28) */
export function addMonths(key: string, n: number) {
  const [y, m, d] = parts(key);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(d, daysInMonth(ny, nm)))}`;
}

/**
 * Earned from `from` to `to`, both days included: each day earns the monthly amount divided by the
 * days in its month (30, 31, 28 or 29), so a full month always adds up to exactly the monthly amount.
 */
export function accrued(monthly: number, from: string, to: string) {
  if (!monthly || from > to) return 0;
  const [fy, fm, fd] = parts(from);
  const [ty, tm, td] = parts(to);
  let sum = 0;
  for (let y = fy, m = fm; y < ty || (y === ty && m <= tm); m === 12 ? (y++, (m = 1)) : m++) {
    const dim = daysInMonth(y, m);
    const first = y === fy && m === fm ? fd : 1;
    const last = y === ty && m === tm ? td : dim;
    sum += (monthly * (last - first + 1)) / dim;
  }
  return sum;
}

export type IncentiveState = "active" | "waiting" | "ended" | "no-start" | "no-rate";

export interface Incentive {
  /** ₹ per full month */
  monthly: number;
  /** First day that earns; null without a start date */
  eligibleFrom: string | null;
  /** Earned in the current month so far (through today) */
  thisMonth: number;
  /** Earned from the first eligible day through today (or the end date) */
  tillDate: number;
  state: IncentiveState;
}

export function incentiveFor(p: { billRate: number | null; startDate: string | null; endDate: string | null }, today: string): Incentive {
  const monthly = p.billRate && p.billRate > 0 ? p.billRate * RUPEES_PER_RATE_DOLLAR : 0;
  if (!p.startDate) return { monthly, eligibleFrom: null, thisMonth: 0, tillDate: 0, state: "no-start" };
  const eligibleFrom = addMonths(p.startDate, WAIT_MONTHS);
  if (!monthly) return { monthly, eligibleFrom, thisMonth: 0, tillDate: 0, state: "no-rate" };

  const last = p.endDate && p.endDate < today ? p.endDate : today;
  const monthStart = `${today.slice(0, 7)}-01`;
  return {
    monthly,
    eligibleFrom,
    thisMonth: accrued(monthly, eligibleFrom > monthStart ? eligibleFrom : monthStart, last),
    tillDate: accrued(monthly, eligibleFrom, last),
    state: today < eligibleFrom ? "waiting" : p.endDate && p.endDate < today ? "ended" : "active",
  };
}
