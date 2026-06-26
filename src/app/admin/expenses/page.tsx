import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ExpenseForm } from "./expense-form";
import { ExpenseList } from "./expense-list";

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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Expenses</h1>
        <p className="mt-1 text-sm text-slate-500">
          Track and manage expense submissions with receipts.
        </p>
      </div>
      <ExpenseForm />
      <ExpenseList expenses={JSON.parse(JSON.stringify(expenses))} />
    </div>
  );
}
