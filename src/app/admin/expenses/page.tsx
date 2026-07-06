export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ExpensesView } from "./expenses-view";

export default async function ExpensesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const expenses = await prisma.expense.findMany({
    include: {
      submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      consultant: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <ExpensesView expenses={JSON.parse(JSON.stringify(expenses))} />
  );
}
