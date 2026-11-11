import { prisma } from "@/lib/prisma";
import { addKeyDays, dayKeyOf, dayStart } from "@/lib/tz";
import type { Prisma } from "@/generated/prisma/client";

export const PAGE_SIZE = 100;

export interface ActivityFilters {
  userId: string | null;
  kind: string | null;
  /** "yyyy-mm-dd", Central */
  from: string;
  to: string;
  q: string;
  page: number;
}

export interface ActivityRow {
  id: string;
  at: string;
  kind: string;
  userId: string | null;
  name: string;
  email: string;
  tab: string | null;
  path: string | null;
  ip: string | null;
  device: string | null;
}

export interface ActivityUserSummary {
  userId: string;
  name: string;
  email: string;
  role: string | null;
  lastLogin: string | null;
  lastIp: string | null;
  lastSeen: string | null;
  lastTab: string | null;
  logins: number;
  pages: number;
  failed: number;
  ips: string[];
}

/** "Chrome on Windows" from a user agent */
export function deviceOf(ua: string | null) {
  if (!ua) return null;
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android"
    : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : null;
  return os ? `${browser} on ${os}` : browser;
}

export function readFilters(sp: Record<string, string | undefined>): ActivityFilters {
  const today = dayKeyOf();
  const day = (v: string | undefined, d: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : d);
  return {
    userId: sp.user || null,
    kind: sp.kind && ["login", "login_failed", "logout", "page"].includes(sp.kind) ? sp.kind : null,
    from: day(sp.from, today),
    to: day(sp.to, today),
    q: (sp.q ?? "").trim().slice(0, 100),
    page: Math.max(1, Number(sp.page) || 1),
  };
}

export async function loadActivity(f: ActivityFilters) {
  const range = { gte: dayStart(f.from), lt: dayStart(addKeyDays(f.to, 1)) };
  const where: Prisma.ActivityLogWhereInput = {
    createdAt: range,
    ...(f.userId ? { userId: f.userId } : {}),
    ...(f.kind ? { kind: f.kind } : {}),
    ...(f.q
      ? { OR: [{ email: { contains: f.q, mode: "insensitive" } }, { ip: { contains: f.q } }, { tab: { contains: f.q, mode: "insensitive" } }, { path: { contains: f.q, mode: "insensitive" } }] }
      : {}),
  };

  const [rows, total, users, inRange] = await Promise.all([
    prisma.activityLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (f.page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.activityLog.count({ where }),
    prisma.user.findMany({ select: { id: true, firstName: true, lastName: true, email: true, isActive: true, role: { select: { name: true } } } }),
    // Per-user summary for the same dates (and person), regardless of the event / search filters
    prisma.activityLog.findMany({
      where: { createdAt: range, userId: f.userId ?? { not: null } },
      orderBy: { createdAt: "desc" },
      select: { userId: true, kind: true, ip: true, tab: true, createdAt: true },
    }),
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));
  const nameOf = (id: string | null) => {
    const u = id ? userById.get(id) : null;
    return u ? `${u.firstName} ${u.lastName}`.trim() : "";
  };

  const summary = new Map<string, ActivityUserSummary>();
  for (const e of inRange) {
    const u = e.userId ? userById.get(e.userId) : null;
    if (!u) continue;
    let s = summary.get(u.id);
    if (!s) {
      s = { userId: u.id, name: nameOf(u.id), email: u.email, role: u.role?.name ?? null, lastLogin: null, lastIp: null, lastSeen: null, lastTab: null, logins: 0, pages: 0, failed: 0, ips: [] };
      summary.set(u.id, s);
    }
    // rows are newest first, so the first of each kind is the latest
    s.lastSeen ??= e.createdAt.toISOString();
    if (e.kind === "page") {
      s.pages++;
      s.lastTab ??= e.tab;
    } else if (e.kind === "login") {
      s.logins++;
      s.lastLogin ??= e.createdAt.toISOString();
      s.lastIp ??= e.ip;
    } else if (e.kind === "login_failed") s.failed++;
    if (e.ip && !s.ips.includes(e.ip)) s.ips.push(e.ip);
  }

  return {
    rows: rows.map<ActivityRow>((r) => ({
      id: r.id,
      at: r.createdAt.toISOString(),
      kind: r.kind,
      userId: r.userId,
      name: nameOf(r.userId),
      email: r.email,
      tab: r.tab,
      path: r.path,
      ip: r.ip,
      device: deviceOf(r.userAgent),
    })),
    total,
    summary: [...summary.values()].sort((a, b) => (b.lastSeen ?? "").localeCompare(a.lastSeen ?? "")),
    users: users
      .filter((u) => u.isActive || summary.has(u.id))
      .map((u) => ({ id: u.id, name: nameOf(u.id) || u.email }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
