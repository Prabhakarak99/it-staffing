import { prisma } from "@/lib/prisma";
import { PLATFORM_COMPANY_ID } from "@/lib/tenant/context";

/** The Google app (OAuth client) for Gmail: the company's own if it set one up, else the platform's shared one */
export async function gmailAppSettings() {
  const rows = await prisma.gmailSettings.findMany(); // the company's row and the platform's
  return rows.find((r) => r.companyId !== PLATFORM_COMPANY_ID) ?? rows.find((r) => r.companyId === PLATFORM_COMPANY_ID) ?? null;
}
