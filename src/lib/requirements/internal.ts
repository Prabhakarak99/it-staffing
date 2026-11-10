import { prisma } from "@/lib/prisma";
import { companyDomain, companyKey } from "@/lib/easy/data";

/**
 * Our own company: the work email domains of the app's users (e.g. genfusion-tech.com; free mail
 * like gmail.com never counts) and the company names those domains stand for ("Gen fusion Tech LLC").
 * Mail from us, or a "requirement" whose vendor is us, is internal: never a vendor requirement.
 */
export async function ourCompany() {
  const users = await prisma.user.findMany({ select: { email: true } });
  const domains = new Set(users.map((u) => companyDomain(u.email)).filter((d): d is string => !!d));
  const names = new Set([...domains].map((d) => companyKey(d.split(".")[0])).filter((k): k is string => !!k));
  const isOurs = (email: string | null | undefined, company?: string | null) => {
    const d = companyDomain(email);
    if (d && domains.has(d)) return true;
    const k = companyKey(company);
    return !!k && names.has(k);
  };
  return { domains: [...domains], isOurs };
}
