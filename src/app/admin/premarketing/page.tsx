export const dynamic = "force-dynamic";

import { Header } from "@/components/layout/header";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PreMarketingForm } from "./premarketing-form";
import { PreMarketingList } from "./premarketing-list";

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

  return (
    <>
      <Header title="Pre-Marketing" />
      <div className="p-6 space-y-6">
        <PreMarketingForm />
        <PreMarketingList records={JSON.parse(JSON.stringify(records))} />
      </div>
    </>
  );
}
