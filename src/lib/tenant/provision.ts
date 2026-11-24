import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { unscopedPrisma } from "@/lib/prisma";
import { sendActivationEmail } from "@/lib/email";
import { validatePassword } from "@/lib/validators";
import { emailConflict } from "@/lib/tenant/user-email";

/** The company whose roles and screen access every new company starts with */
const TEMPLATE_SLUG = "genfusiontech";
const RESERVED_SLUGS = new Set(["platform", "admin", "login", "api", "www"]);

export interface NewCompany {
  name: string;
  slug: string;
  code: string;
  timezone?: string;
  attendanceTimezone?: string;
  /** password: set by the Super Admin, so the admin is active right away (no activation email) */
  admin: { firstName: string; lastName: string; email: string; password?: string };
  createdById?: string | null;
}

export class ProvisionError extends Error {}

/**
 * A password the Super Admin typed, with its re-entered copy. Both empty = none given.
 * Returns the password, or an error message to show.
 */
export function readNewPassword(body: Record<string, unknown>): { password?: string; error?: string } {
  const password = body.password;
  const confirm = body.confirmPassword;
  if ((password === undefined || password === "") && (confirm === undefined || confirm === "")) return {};
  if (typeof password !== "string") return { error: "Enter a password" };
  const err = validatePassword(password);
  if (err) return { error: `Password: ${err}` };
  if (confirm !== undefined && confirm !== password) return { error: "The passwords don't match" };
  return { password };
}

/** "GenFusion Tech" → "genfusiontech"; "Dataforce" → "DAT" */
export const suggestSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
export const suggestCode = (name: string) => name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();

async function validate(input: NewCompany) {
  const name = input.name.trim();
  const slug = input.slug.trim().toLowerCase();
  const code = input.code.trim().toUpperCase();
  const email = input.admin.email.trim().toLowerCase();
  if (!name) throw new ProvisionError("Enter the company name");
  if (!/^[a-z0-9]{3,30}$/.test(slug)) throw new ProvisionError("Login name: 3 to 30 lowercase letters or digits, no spaces");
  if (RESERVED_SLUGS.has(slug)) throw new ProvisionError(`"${slug}" is reserved; pick another login name`);
  if (!/^[A-Z]{3}$/.test(code)) throw new ProvisionError("Code: exactly 3 letters (used in submission ids, e.g. Sub-DAT-001)");
  if (!input.admin.firstName.trim() || !input.admin.lastName.trim()) throw new ProvisionError("Enter the admin's first and last name");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new ProvisionError("Enter a valid admin email");

  const [slugTaken, codeTaken, emailTaken] = await Promise.all([
    unscopedPrisma.company.findUnique({ where: { slug }, select: { id: true } }),
    unscopedPrisma.company.findUnique({ where: { code }, select: { id: true } }),
    // A brand-new company has no users yet, so only an active account elsewhere is in the way
    emailConflict(email, "", { showCompany: true }),
  ]);
  if (slugTaken) throw new ProvisionError(`The login name "${slug}" is already used by another company`);
  if (codeTaken) throw new ProvisionError(`The code ${code} is already used by another company`);
  if (emailTaken) throw new ProvisionError(emailTaken);
  return { name, slug, code, email };
}

/**
 * Creates a company ready to use: the company row, the template company's roles with the same screen
 * access, default settings rows, and its first Company Admin (no role = every screen in the company),
 * who gets an activation email that leads to the company's own login link.
 */
export async function provisionCompany(input: NewCompany) {
  const { name, slug, code, email } = await validate(input);
  const template = await unscopedPrisma.company.findUnique({
    where: { slug: TEMPLATE_SLUG },
    include: { roles: { include: { roleScreens: true } } },
  });

  const chosen = input.admin.password;
  const chosenError = chosen !== undefined ? validatePassword(chosen) : undefined;
  if (chosenError) throw new ProvisionError(`Password: ${chosenError}`);
  const activationToken = chosen ? null : randomBytes(32).toString("hex");
  // Without a chosen password: a random one nobody knows; the admin sets their own through the activation link
  const passwordHash = await bcrypt.hash(chosen ?? randomBytes(24).toString("hex"), 12);

  const { company, admin } = await unscopedPrisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name, slug, code,
        timezone: input.timezone ?? "America/Chicago",
        attendanceTimezone: input.attendanceTimezone ?? "Asia/Kolkata",
        createdById: input.createdById ?? null,
      },
    });
    for (const role of template?.roles ?? []) {
      const copy = await tx.role.create({ data: { companyId: company.id, name: role.name, description: role.description } });
      if (role.roleScreens.length) {
        await tx.roleScreen.createMany({
          data: role.roleScreens.map((rs) => ({ companyId: company.id, roleId: copy.id, screenId: rs.screenId, canView: rs.canView })),
        });
      }
    }
    // Settings rows: AutoJobs and the company's own job sources start paused
    await tx.autoJobsConfig.create({ data: { companyId: company.id, paused: true } });
    await tx.jobIngestConfig.create({ data: { companyId: company.id, paused: true } });
    const admin = await tx.user.create({
      data: {
        companyId: company.id,
        firstName: input.admin.firstName.trim(),
        lastName: input.admin.lastName.trim(),
        email,
        password: passwordHash,
        roleId: null, // Company Admin: every screen inside this company
        isActive: !!chosen,
        activationToken,
        activationExpiry: chosen ? null : new Date(Date.now() + 7 * 86_400_000),
      },
    });
    return { company, admin };
  });

  let emailError: string | null = null;
  if (activationToken) {
    try {
      await sendActivationEmail(admin.email, admin.firstName, activationToken);
    } catch (err) {
      emailError = err instanceof Error ? err.message : "Could not send the activation email";
    }
  }
  return {
    company, adminId: admin.id, loginUrl: `/login?company=${company.slug}`,
    adminActive: !activationToken, emailSent: !!activationToken && !emailError, emailError,
  };
}
