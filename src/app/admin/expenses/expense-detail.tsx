"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DollarSign, ExternalLink, FileText, Loader2, MapPin, Pencil, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SlideFormBody, SlideFormFooter, SlideFormHeader, SlideFormSection,
  SlideFormSections, SlideFormShell,
} from "@/components/forms/compact-slide-form";
import { ExpenseForm } from "./expense-form";

type ExpenseRecord = {
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
};

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtMoney(amount: number) {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-800 break-words">{value?.trim() || "—"}</p>
    </div>
  );
}

export function ExpenseDetail({
  expenseId,
  onUpdated,
}: {
  expenseId: string;
  onUpdated?: (expense: ExpenseRecord) => void;
}) {
  const router = useRouter();
  const [expense, setExpense] = useState<ExpenseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/expenses/${expenseId}`);
      if (!res.ok) throw new Error("Failed to load expense");
      setExpense(await res.json());
    } catch {
      setError("Could not load expense details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [expenseId]);

  if (editing && expense) {
    return (
      <ExpenseForm
        existingExpense={expense}
        onCancel={() => setEditing(false)}
        onSuccess={(updated) => {
          setEditing(false);
          if (updated) {
            setExpense(updated);
            onUpdated?.(updated);
          } else {
            load();
          }
          router.refresh();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
      </div>
    );
  }

  if (error || !expense) {
    return (
      <div className="flex min-h-[280px] items-center justify-center p-8 text-center">
        <p className="text-sm font-medium text-rose-600">{error || "Expense not found"}</p>
      </div>
    );
  }

  return (
    <SlideFormShell>
      <SlideFormHeader
        icon={DollarSign}
        title={expense.expenseId}
        subtitle={`${expense.category} · ${fmtMoney(expense.amount)}`}
        tone="emerald"
        actions={
          <Button size="sm" variant="secondary" className="bg-white/15 text-white border-white/20 hover:bg-white/25" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        }
      />

      <SlideFormBody>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${
            expense.status === "Approved" ? "bg-emerald-100 text-emerald-700"
              : expense.status === "Rejected" ? "bg-rose-100 text-rose-700"
              : "bg-amber-100 text-amber-700"
          }`}>{expense.status}</span>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-700">{expense.location}</span>
        </div>

        <SlideFormSections>
          <SlideFormSection icon={DollarSign} title="Submitter & Date" color="teal">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <DetailField label="Submitted By" value={`${expense.submittedBy.firstName} ${expense.submittedBy.lastName}`} />
              <DetailField label="Submitter Email" value={expense.submittedBy.email} />
              <DetailField label="Expense Date" value={fmtDate(expense.date)} />
              <DetailField label="Consultant" value={expense.consultant ? `${expense.consultant.firstName} ${expense.consultant.lastName}` : null} />
            </div>
          </SlideFormSection>

          <SlideFormSection icon={Tag} title="Category & Amount" color="emerald">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <DetailField label="Category" value={expense.category} />
              <DetailField label="Amount" value={fmtMoney(expense.amount)} />
              <DetailField label="Status" value={expense.status} />
            </div>
          </SlideFormSection>

          <SlideFormSection icon={MapPin} title="Location" color="blue">
            <DetailField label="Location" value={expense.location} />
          </SlideFormSection>

          <SlideFormSection icon={FileText} title="Description & Notes" color="amber" className="xl:col-span-2">
            <div className="space-y-3">
              <DetailField label="Description" value={expense.description} />
              <DetailField label="Notes" value={expense.notes} />
              {expense.receiptFile ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Receipt</p>
                  <a
                    href={`/uploads/receipts/${expense.receiptFile}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
                  >
                    View receipt <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ) : null}
            </div>
          </SlideFormSection>
        </SlideFormSections>
      </SlideFormBody>

      <SlideFormFooter>
        <Button size="sm" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" />
          Edit Expense
        </Button>
      </SlideFormFooter>
    </SlideFormShell>
  );
}
