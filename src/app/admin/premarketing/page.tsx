export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PreMarketingView } from "./premarketing-view";

export default async function PreMarketingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const records = await prisma.preMarketing.findMany({
    include: {
      consultant: { select: { id: true, firstName: true, lastName: true, email: true, technology: true } },
      recruiter: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return <PreMarketingView records={JSON.parse(JSON.stringify(records))} />;
}
