import { unscopedPrisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";

/** Non-secret cookie with the company's slug, so an expired session goes back to that company's login page */
export const COMPANY_HINT_COOKIE = "it-staff-company";

/** The login page for a company (or the Super Admin's plain /login) */
export const loginPath = (slug?: string | null) => (slug && slug !== "platform" ? `/login?company=${encodeURIComponent(slug)}` : "/login");

/** An active customer company by its slug (case-insensitive), or null */
export async function companyBySlug(slug: string | null | undefined) {
  const s = slug?.trim().toLowerCase();
  if (!s) return null;
  const c = await unscopedPrisma.company.findUnique({ where: { slug: s } });
  return c && c.kind === "company" ? c : null;
}

/** Screen paths the user's role may open; null = every screen (Company Admin / Super Admin) */
export async function allowedScreensFor(roleId: string | null, disabledModules: string[] = []) {
  if (!roleId) return null;
  const rows = await unscopedPrisma.roleScreen.findMany({ where: { roleId, canView: true }, include: { screen: true } });
  return rows.map((r) => r.screen.path).filter((p) => !disabledModules.includes(p));
}

/**
 * The session for a user. `platform` = signed in at the plain /login as Platform Super Admin: every
 * screen, starting in their own company (the switcher moves between companies).
 */
export async function sessionFor(
  user: { id: string; email: string; roleId: string | null; role?: { name: string } | null; companyId: string },
  company: { id: string; slug: string; name: string; disabledModules?: string[] },
  platform = false,
): Promise<SessionPayload> {
  return {
    userId: user.id,
    email: user.email,
    roleId: platform ? null : user.roleId,
    roleName: platform ? "Super Admin" : (user.role?.name ?? null),
    allowedScreens: platform ? null : await allowedScreensFor(user.roleId, company.disabledModules),
    companyId: company.id,
    companySlug: company.slug,
    companyName: company.name,
    isPlatformAdmin: platform,
    // Starts inside their own company; the header switcher turns on the All companies view
    allCompanies: false,
  };
}
