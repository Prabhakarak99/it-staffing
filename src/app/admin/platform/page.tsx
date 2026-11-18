import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { unscopedPrisma } from "@/lib/prisma";
import { listCompanies } from "@/lib/tenant/platform";
import { CompaniesView } from "./companies-view";

export const dynamic = "force-dynamic";

/** The Super Admin console: every company, its usage, admins and settings */
export default async function PlatformPage() {
  const session = await getSession();
  if (!session) redirect("/admin");
  // Company Admins also see every screen; only the Platform Super Admin gets this one
  if (!session.isPlatformAdmin) redirect("/admin");

  const [companies, screens] = await Promise.all([
    listCompanies(),
    unscopedPrisma.screen.findMany({ select: { name: true, path: true }, orderBy: { name: "asc" } }),
  ]);
  return <CompaniesView initial={companies} screens={screens.filter((s) => s.path !== "/admin")} />;
}
