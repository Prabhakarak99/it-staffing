import { prisma } from "@/lib/prisma";
import { VENDOR_SCREEN } from "@/lib/vendors/access";
import { MAILBOX_SCREEN } from "@/lib/gmail/access";
import { LEADS_SCREEN } from "@/lib/leads/access";
import { ATTENDANCE_SCREEN } from "@/lib/attendance/access";
import { EASY_SCREEN } from "@/lib/easy/data";
import { AI_SETTINGS_SCREEN } from "@/lib/ai/admin";
import { FOLLOWUPS_SCREEN } from "@/lib/followups/templates";
import { RESUMES_SCREEN } from "@/lib/resumes/data";
import { CONSULTANT_MAIL_SCREEN } from "@/lib/consultant-mail/data";
import { VENDOR_REQ_SCREEN } from "@/lib/requirements/constants";
import { ACTIVITY_SCREEN } from "@/lib/activity/log";
import { PROFIT_SCREEN } from "@/lib/profit-sharing/data";
import { INCENTIVES_SCREEN } from "@/lib/incentives/data";
import { APPRECIATION_SCREEN } from "@/lib/appreciation/data";

/**
 * Screens added after the initial seed. Created once at startup; on creation every role that can
 * already open `grantLike` gets access too, so admins only need User Roles to adjust it afterwards.
 */
const LATE_SCREENS = [
  { ...VENDOR_SCREEN, grantLike: "/admin/submissions" },
  { ...MAILBOX_SCREEN, grantLike: "/admin/submissions" },
  { ...EASY_SCREEN, grantLike: "/admin/submissions" },
  { ...FOLLOWUPS_SCREEN, grantLike: "/admin/submissions" },
  { ...RESUMES_SCREEN, grantLike: "/admin/submissions" },
  { ...CONSULTANT_MAIL_SCREEN, grantLike: "/admin/submissions" },
  { ...AI_SETTINGS_SCREEN, grantLike: "/admin/users" },
  // Sign-ins, IPs and tabs opened: admins only to start with
  { ...ACTIVITY_SCREEN, grantLike: "/admin/users" },
];

/** Screens folded into another one: roles that could open them get the new home, then they're removed */
const RETIRED_SCREENS = [
  // Signature and templates are popups in Mailbox now
  { path: "/admin/email-templates", movedTo: MAILBOX_SCREEN.path },
];

async function retireScreens() {
  for (const { path, movedTo } of RETIRED_SCREENS) {
    const old = await prisma.screen.findUnique({ where: { path }, select: { id: true } });
    if (!old) continue;
    const target = await prisma.screen.findUnique({ where: { path: movedTo }, select: { id: true } });
    if (target) {
      const roles = await prisma.roleScreen.findMany({ where: { screenId: old.id, canView: true }, select: { roleId: true } });
      await prisma.roleScreen.createMany({
        data: roles.map((r) => ({ roleId: r.roleId, screenId: target.id, canView: true })),
        skipDuplicates: true,
      });
    }
    await prisma.screen.delete({ where: { id: old.id } }); // role grants go with it (cascade)
    console.log(`[screens] retired ${path} (moved to ${movedTo})`);
  }
}

export async function ensureScreens() {
  await retireScreens();
  for (const { name, path, grantLike } of LATE_SCREENS) {
    if (await prisma.screen.findUnique({ where: { path } })) continue;
    const screen = await prisma.screen.create({ data: { name, path } });
    const roles = await prisma.roleScreen.findMany({
      where: { canView: true, screen: { path: grantLike } },
      select: { roleId: true },
    });
    if (roles.length > 0) {
      await prisma.roleScreen.createMany({
        data: roles.map((r) => ({ roleId: r.roleId, screenId: screen.id, canView: true })),
        skipDuplicates: true,
      });
    }
    console.log(`[screens] added "${name}" for ${roles.length} role(s)`);
  }
}

/**
 * One-time grants. Each runs once (recorded in AppMigration), so later changes in User Roles stick.
 * `recruiters` limits it to recruiting roles: a name with "recruit", or a role that can open Submissions.
 * `roleNameHas` limits it to roles whose name contains one of the words; `roleNameNot` leaves out
 * roles whose name contains one.
 */
const SCREEN_GRANTS: { id: string; name: string; path: string; recruiters?: boolean; roleNameHas?: string[]; roleNameNot?: string[] }[] = [
  // Every role can add leads; each person sees only their own (src/lib/leads/access.ts)
  { id: "leads-open-to-all-roles", ...LEADS_SCREEN },
  // Everyone marks attendance and requests leave; approvals are by role name (src/lib/roles.ts)
  { id: "attendance-open-to-all-roles", ...ATTENDANCE_SCREEN },
  // Requirement emails are shared between recruiters (who sees which is decided per requirement)
  { id: "vendor-requirements-open-to-recruiters", ...VENDOR_REQ_SCREEN, recruiters: true },
  // Confirmations and the profit share calculator: POC and CEO roles (Super Admin sees every screen)
  { id: "profit-sharing-for-poc-and-ceo", ...PROFIT_SCREEN, roleNameHas: ["poc", "ceo"] },
  // Recruiters' own placements and incentive; never POC roles (also enforced in src/lib/incentives/data.ts)
  { id: "incentives-for-recruiters-not-poc", ...INCENTIVES_SCREEN, recruiters: true, roleNameNot: ["poc"] },
  // Monthly top-recruiter awards: the whole recruiting team sees the winners
  { id: "appreciation-for-recruiting-roles", ...APPRECIATION_SCREEN, recruiters: true },
];

export async function grantScreensOnce() {
  for (const { id, name, path, recruiters, roleNameHas, roleNameNot } of SCREEN_GRANTS) {
    if (await prisma.appMigration.findUnique({ where: { id } })) continue;
    const screen = await prisma.screen.upsert({ where: { path }, create: { name, path }, update: {} });
    const found = await prisma.role.findMany({
      where: recruiters
        ? {
            OR: [
              { name: { contains: "recruit", mode: "insensitive" } },
              { roleScreens: { some: { canView: true, screen: { path: "/admin/submissions" } } } },
            ],
          }
        : roleNameHas
          ? { OR: roleNameHas.map((w) => ({ name: { contains: w, mode: "insensitive" as const } })) }
          : {},
      select: { id: true, name: true },
    });
    const roles = found.filter((r) => !roleNameNot?.some((w) => r.name.toLowerCase().includes(w)));
    await prisma.$transaction([
      ...roles.map((r) =>
        prisma.roleScreen.upsert({
          where: { roleId_screenId: { roleId: r.id, screenId: screen.id } },
          create: { roleId: r.id, screenId: screen.id, canView: true },
          update: { canView: true },
        }),
      ),
      prisma.appMigration.create({ data: { id } }),
    ]);
    console.log(`[screens] granted "${name}" to ${recruiters ? "recruiting" : roleNameHas ? roleNameHas.join("/") : "all"} ${roles.length} role(s)`);
  }
}
