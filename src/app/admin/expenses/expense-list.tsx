"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { DollarSign, Trash2, FileText, TrendingUp } from "lucide-react";

interface Expense {
  id: string; expenseId: string; date: string; category: string;
  description: string | null; amount: number; location: string;
  receiptFile: string | null; status: string; notes: string | null;
  submittedBy: { id: string; firstName: string; lastName: string; email: string };
  consultant: { id: string; firstName: string; lastName: string } | null;
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const CATEGORY_ICONS: Record<string, string> = {
  "Travel": "✈️", "Food & Meals": "🍽️", "Accommodation": "🏨",
  "Office Supplies": "📎", "Training": "📚", "Communication": "📡",
  "Software": "💻", "Other": "📦",
};

const STATUS_STYLE: Record<string, string> = {
  Approved: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-rose-100 text-rose-700",
  Pending:  "bg-amber-100 text-amber-700",
};

const LOCATION_STYLE: Record<string, string> = {
  Onsite:   "border-blue-200 bg-blue-50 text-blue-700",
  Offshore: "border-indigo-200 bg-indigo-50 text-indigo-700",
};

export function ExpenseList({ expenses }: { expenses: Expense[] }) {
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
      } catch { show("Failed to delete expense", "error"); }
    });
  };

  if (list.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
          <DollarSign className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-700">No expenses recorded yet</p>
        <p className="text-xs text-slate-400 mt-1">Submit your first expense above</p>
      </div>
    );
  }

  const total = list.reduce((sum, e) => sum + e.amount, 0);
  const approvedTotal = list.filter((e) => e.status === "Approved").reduce((sum, e) => sum + e.amount, 0);
  const pendingCount = list.filter((e) => e.status === "Pending").length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* List header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50">
            <DollarSign className="h-4 w-4 text-teal-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Expense Records</h3>
            <p className="text-xs text-slate-500">{list.length} total</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1">
              <span className="text-xs font-semibold text-amber-700">{pendingCount} Pending</span>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2">
            <TrendingUp className="h-3.5 w-3.5 text-teal-600" />
            <div>
              <p className="text-[9px] font-bold uppercase text-teal-600/70">Total</p>
              <p className="text-sm font-bold text-teal-700">${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-left">
              {["Expense ID", "Date", "Submitted By", "Consultant", "Category", "Amount", "Location", "Status", "Receipt", ""].map((h) => (
                <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((e) => (
              <tr key={e.id} className={cn("hover:bg-teal-50/20 transition-colors", e.status === "Rejected" && "opacity-70")}>
                <td className="px-5 py-3.5">
                  <span className="font-mono text-xs font-bold text-teal-700">{e.expenseId}</span>
                </td>
                <td className="px-5 py-3.5 text-xs text-slate-600 whitespace-nowrap">{fmtDate(e.date)}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">
                      {initials(`${e.submittedBy.firstName} ${e.submittedBy.lastName}`)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 whitespace-nowrap">{e.submittedBy.firstName} {e.submittedBy.lastName}</p>
                      <p className="text-[10px] text-slate-400 truncate max-w-[120px]">{e.submittedBy.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                  {e.consultant ? `${e.consultant.firstName} ${e.consultant.lastName}` : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                    <span>{CATEGORY_ICONS[e.category] ?? "📦"}</span>
                    {e.category}
                  </span>
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap">
                  <span className="text-sm font-bold text-slate-900">
                    ${e.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap">
                  <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", LOCATION_STYLE[e.location] ?? "border-slate-200 bg-slate-50 text-slate-600")}>
                    {e.location}
                  </span>
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap">
                  <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLE[e.status] ?? "bg-slate-100 text-slate-600")}>
                    {e.status}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  {e.receiptFile ? (
                    <a href={`/uploads/receipts/${e.receiptFile}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors">
                      <FileText className="h-3 w-3" /> View
                    </a>
                  ) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-5 py-3.5">
                  <button onClick={() => deleteExpense(e.id, e.expenseId)}
                    className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                    title="Delete expense">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  );
}
