import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { unscopedPrisma } from "@/lib/prisma";
import { sendActivationEmail } from "@/lib/email";

/** The company whose roles and screen access every new company starts with */
const TEMPLATE_SLUG = "genfusiontech";
const RESERVED_SLUGS = new Set(["platform", "admin", "login", "api", "www"]);

export interface NewCompany {
  name: string;
  slug: string;
  code: string;
  timezone?: string;
  attendanceTimezone?: string;
  admin: { firstName: string; lastName: string; email: string };
  createdById?: string | null;
}

export class ProvisionError extends Error {}

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
    unscopedPrisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } }),
  ]);
  if (slugTaken) throw new ProvisionError(`The login name "${slug}" is already used by another company`);
  if (codeTaken) throw new ProvisionError(`The code ${code} is already used by another company`);
  if (emailTaken) throw new ProvisionError("That admin email already has an account");
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

  const activationToken = randomBytes(32).toString("hex");
  // A random password nobody knows: the admin sets their own through the activation link
  const placeholder = await bcrypt.hash(randomBytes(24).toString("hex"), 12);

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
        password: placeholder,
        roleId: null, // Company Admin: every screen inside this company
        isActive: false,
        activationToken,
        activationExpiry: new Date(Date.now() + 7 * 86_400_000),
      },
    });
    return { company, admin };
  });

  let emailError: string | null = null;
  try {
    await sendActivationEmail(admin.email, admin.firstName, activationToken);
  } catch (err) {
    emailError = err instanceof Error ? err.message : "Could not send the activation email";
  }
  return { company, adminId: admin.id, loginUrl: `/login?company=${company.slug}`, emailSent: !emailError, emailError };
}
