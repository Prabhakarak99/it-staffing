export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { TechSupportView } from "./tech-support-view";

export default async function TechSupportPage() {
  const people = await prisma.techSupport.findMany({
    orderBy: { createdAt: "desc" },
  });

  return <TechSupportView people={people} />;
}
