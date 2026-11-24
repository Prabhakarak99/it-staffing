import { unscopedPrisma } from "@/lib/prisma";

/**
 * The email rule for staff accounts:
 * - inside one company an email belongs to one account;
 * - the same person may also have an account in another company (each keeps its own history),
 *   but only one of those accounts may be active at a time.
 *
 * Returns why the email can't be used for an (active) account in `companyId`, or null when it can.
 * `exceptUserId`: the account being edited or activated. `showCompany`: name the other company in the
 * message (Super Admin only; a Company Admin doesn't learn which other company has the person).
 */
export async function emailConflict(
  email: string,
  companyId: string,
  opts: { exceptUserId?: string; activating?: boolean; showCompany?: boolean } = {},
): Promise<string | null> {
  const others = await unscopedPrisma.user.findMany({
    where: { email: { equals: email.trim(), mode: "insensitive" }, ...(opts.exceptUserId ? { id: { not: opts.exceptUserId } } : {}) },
    select: { companyId: true, isActive: true, company: { select: { name: true } } },
  });
  if (others.some((o) => o.companyId === companyId)) return "A user with this email already exists in this company";
  if (opts.activating === false) return null;
  const active = others.find((o) => o.isActive);
  if (active) {
    const where = opts.showCompany ? active.company.name : "another company";
    return `This email has an active account in ${where}. Deactivate it there first, or ask the Super Admin to transfer the user.`;
  }
  return null;
}
