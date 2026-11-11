import { prisma } from "@/lib/prisma";

export const ACTIVITY_SCREEN = { name: "Activity", path: "/admin/activity" };

export type ActivityKind = "login" | "login_failed" | "logout" | "page";

/** Logs are kept this long; older rows are deleted now and then */
const KEEP_DAYS = 180;

/**
 * The visitor's IP. On Fly the edge puts the real one in Fly-Client-IP; elsewhere the first
 * X-Forwarded-For hop, then X-Real-IP.
 */
export function clientIp(headers: Headers) {
  const ip =
    headers.get("fly-client-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0] ||
    headers.get("x-real-ip") ||
    "";
  return ip.trim().replace(/^::ffff:/, "") || null;
}

/** Tab names: the Screens table (what User Roles shows), longest matching path wins */
async function tabName(path: string) {
  if (path === "/admin" || path === "/admin/") return "Dashboard";
  const screens = await prisma.screen.findMany({ select: { name: true, path: true } });
  const hit = screens
    .filter((s) => s.path !== "/admin" && (path === s.path || path.startsWith(s.path + "/")))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (hit) return hit.name;
  const last = path.split("/").filter(Boolean).pop() ?? path;
  return last.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Records one event. Never throws: activity logging must not break sign-in or navigation. */
export async function logActivity(
  e: { kind: ActivityKind; userId?: string | null; email: string; path?: string | null },
  headers: Headers,
) {
  try {
    const path = e.path ? e.path.slice(0, 300) : null;
    await prisma.activityLog.create({
      data: {
        kind: e.kind,
        userId: e.userId ?? null,
        email: e.email.slice(0, 200),
        path,
        tab: path ? await tabName(path) : null,
        ip: clientIp(headers),
        userAgent: headers.get("user-agent")?.slice(0, 400) ?? null,
      },
    });
    if (e.kind === "login" && Math.random() < 0.1) {
      await prisma.activityLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_DAYS * 86_400_000) } } });
    }
  } catch (err) {
    console.error("[activity] could not log:", err);
  }
}
