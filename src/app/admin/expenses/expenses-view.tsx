"use client";

import { useEffect, useState } from "react";
import { DollarSign, Plus } from "lucide-react";
import { SlideOver } from "@/components/ui/slide-over";
import { ExpenseForm } from "./expense-form";
import { ExpenseList } from "./expense-list";
import { ExpenseDetail } from "./expense-detail";

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

export function ExpensesView({ expenses: initialExpenses }: { expenses: Expense[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expenses, setExpenses] = useState(initialExpenses);

  useEffect(() => {
    setExpenses(initialExpenses);
  }, [initialExpenses]);

  const handleExpenseUpdated = (updated: Expense) => {
    setExpenses((prev) => {
      const exists = prev.some((e) => e.id === updated.id);
      if (exists) return prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e));
      return [updated, ...prev];
    });
  };

  return (
    <>
      <div className="relative overflow-hidden bg-gradient-to-r from-teal-600 via-emerald-600 to-green-700 px-6 py-5">
        <div className="absolute -right-6 -top-6 h-36 w-36 rounded-full bg-white/[0.05]" />
        <div className="absolute left-1/2 bottom-0 h-20 w-20 rounded-full bg-white/[0.04]" />

        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-white">Expenses</h1>
              <p className="mt-0.5 text-[12px] text-white/65">
                {expenses.length} expense{expenses.length !== 1 ? "s" : ""} tracked across the team
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAdd(true)}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[13px] font-bold text-teal-700 shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
          >
            <Plus className="h-4 w-4" />
            New Expense
          </button>
        </div>
      </div>

      <div className="p-6">
        <ExpenseList expenses={expenses} onSelect={setSelectedId} />
      </div>

      <SlideOver open={!!selectedId} onClose={() => setSelectedId(null)} maxWidth="max-w-4xl">
        {selectedId && (
          <ExpenseDetail
            expenseId={selectedId}
            onUpdated={handleExpenseUpdated}
          />
        )}
      </SlideOver>

      <SlideOver open={showAdd} onClose={() => setShowAdd(false)} maxWidth="max-w-4xl">
        <ExpenseForm
          onCancel={() => setShowAdd(false)}
          onSuccess={(created) => {
            setShowAdd(false);
            if (created) handleExpenseUpdated(created);
          }}
        />
      </SlideOver>
    </>
  );
}
