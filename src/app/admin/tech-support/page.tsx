import { Header } from "@/components/layout/header";
import { prisma } from "@/lib/prisma";
import { TechSupportForm } from "./tech-support-form";
import { TechSupportList } from "./tech-support-list";

export default async function TechSupportPage() {
  const people = await prisma.techSupport.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <Header title="Onboard TechSupport" />
      <div className="p-6 space-y-6">
        <TechSupportForm />
        <TechSupportList people={people} />
      </div>
    </>
  );
}
