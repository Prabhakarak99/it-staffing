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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pre-Marketing</h1>
        <p className="mt-1 text-sm text-slate-500">
          Track consultant marketing readiness, documents, and recruiter assignments.
        </p>
      </div>
      <PreMarketingForm />
      <PreMarketingList records={JSON.parse(JSON.stringify(records))} />
    </div>
  );
}
