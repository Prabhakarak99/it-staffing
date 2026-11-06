// The whole app runs on US Central time (CST / CDT, daylight saving handled by Intl):
// day / week / month boundaries, attendance days, and how times are shown and entered.
// No server imports: client components use these too.

export const APP_TZ = "America/Chicago";
export const APP_TZ_LABEL = "CT";

const keyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const wallFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TZ, hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
});

/** "yyyy-mm-dd" of an instant in Central time */
export const dayKeyOf = (d: Date = new Date()) => keyFormat.format(d);

/** Central wall-clock parts of an instant */
function wall(d: Date) {
  const p = Object.fromEntries(wallFormat.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

/** Central's offset from UTC (ms) at an instant: -6h in winter, -5h in summer */
function offsetAt(t: number) {
  const w = wall(new Date(t));
  return Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s) - Math.floor(t / 1000) * 1000;
}

/** The instant of a Central wall-clock time */
export function zonedInstant(y: number, m: number, d: number, h = 0, mi = 0) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const first = guess - offsetAt(guess);
  return new Date(guess - offsetAt(first)); // second pass settles the DST switch days
}

/** Midnight Central at the start of a "yyyy-mm-dd" day */
export function dayStart(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return zonedInstant(y, m, d);
}

/** "yyyy-mm-ddThh:mm" in Central, for <input type="datetime-local"> */
export function toWallInput(value: string | Date) {
  const w = wall(new Date(value));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${w.y}-${pad(w.m)}-${pad(w.d)}T${pad(w.h)}:${pad(w.mi)}`;
}

/** A datetime-local value read as Central time */
export function fromWallInput(value: string) {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return new Date(value);
  return zonedInstant(+m[1], +m[2], +m[3], +m[4], +m[5]);
}

/** Formats an instant (a timestamp, not a date-only field) in Central time */
export const fmtCentral = (value: string | Date, opts: Intl.DateTimeFormatOptions) =>
  new Date(value).toLocaleString("en-US", { ...opts, timeZone: APP_TZ });

/** "yyyy-mm-dd" plus n calendar days */
export function addKeyDays(key: string, n: number) {
  const d = new Date(`${key}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Central today / Monday-based week / calendar month starts, as instants (and as day keys) */
export function centralPeriods(now = new Date()) {
  const todayKey = dayKeyOf(now);
  const dow = new Date(`${todayKey}T00:00:00.000Z`).getUTCDay(); // 0 = Sunday
  const weekKey = addKeyDays(todayKey, -((dow + 6) % 7));
  const monthKey = `${todayKey.slice(0, 7)}-01`;
  const today = dayStart(todayKey);
  const week = dayStart(weekKey);
  const month = dayStart(monthKey);
  return { today, week, month, earliest: week < month ? week : month, todayKey, earliestKey: weekKey < monthKey ? weekKey : monthKey };
}

/** Hour of the day (0–23) in Central time */
export const centralHour = (now = new Date()) => wall(now).h;
