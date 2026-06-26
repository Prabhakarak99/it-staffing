"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Toast, useToast } from "@/components/ui/toast";
import { DollarSign, Trash2, FileText } from "lucide-react";

interface Expense {
  id: string;
  expenseId: string;
  date: string;
  category: string;
  description: string | null;
  amount: number;
  location: string;
  receiptFile: string | null;
  status: string;
  notes: string | null;
  submittedBy: { id: string; firstName: string; lastName: string; email: string };
  consultant: { id: string; firstName: string; lastName: string } | null;
}

interface Props {
  expenses: Expense[];
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const v = status === "Approved" ? "success" : status === "Rejected" ? "danger" : "warning";
  return <Badge variant={v}>{status}</Badge>;
}

function LocationBadge({ location }: { location: string }) {
  return <Badge variant={location === "Onsite" ? "info" : "warning"}>{location}</Badge>;
}

export function ExpenseList({ expenses }: Props) {
  const [list, setList] = useState(expenses);
  const [, startTransition] = useTransition();
  const { toast, show, hide } = useToast();
  const router = useRouter();

  const deleteExpense = (id: string, expenseId: string) => {
    if (!confirm(`Delete expense ${expenseId}?`)) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Delete failed");
        setList((prev) => prev.filter((e) => e.id !== id));
        show(`Expense ${expenseId} deleted`, "success");
        router.refresh();
      } catch {
        show("Failed to delete expense", "error");
      }
    });
  };

  if (list.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-slate-400">
          <DollarSign className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm">No expenses recorded yet.</p>
        </CardContent>
      </Card>
    );
  }

  const total = list.reduce((sum, e) => sum + e.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-indigo-600" />
          Expenses
          <span className="ml-auto flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-700">
              Total: <span className="text-indigo-600">${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </span>
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
              {list.length}
            </span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-900 text-left">
                {["Expense ID", "Date", "Submitted By", "Consultant", "Category", "Amount", "Location", "Status", "Receipt", ""].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-indigo-700">{e.expenseId}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">{fmt(e.date)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900 whitespace-nowrap">{e.submittedBy.firstName} {e.submittedBy.lastName}</p>
                    <p className="text-xs text-slate-500 truncate max-w-[140px]">{e.submittedBy.email}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                    {e.consultant ? `${e.consultant.firstName} ${e.consultant.lastName}` : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant="indigo">{e.category}</Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-900">
                    ${e.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3"><LocationBadge location={e.location} /></td>
                  <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
                  <td className="px-4 py-3">
                    {e.receiptFile
                      ? (
                        <a
                          href={`/uploads/receipts/${e.receiptFile}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-indigo-600 hover:underline text-xs"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          View
                        </a>
                      )
                      : <span className="text-slate-400 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => deleteExpense(e.id, e.expenseId)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </Card>
  );
}
