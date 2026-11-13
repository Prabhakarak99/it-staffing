"use client";

import { useState } from "react";
import { Calculator, CheckCircle2 } from "lucide-react";
import { Header } from "@/components/layout/header";
import { SubmissionRecords } from "@/components/placements/submission-records";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { ConfirmationRow } from "@/lib/profit-sharing/data";

type Tab = "confirmations" | "calculator";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "confirmations", label: "Confirmations", icon: CheckCircle2 },
  { id: "calculator", label: "Profit Share Calculator", icon: Calculator },
];

export function ProfitSharingView({ initialTab, initialRows, today }: { initialTab: Tab; initialRows: ConfirmationRow[]; today: string }) {
  const { toast, show, hide } = useToast();
  const [tab, setTab] = useState<Tab>(initialTab);

  const switchTab = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", `/admin/profit-sharing?tab=${t}`);
  };

  return (
    <>
      <Header title="Profit Sharing" subtitle="Confirmed placements and the profit share calculator" />
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex w-fit gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => switchTab(t.id)}
              className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition", tab === t.id ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100")}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {/* Kept mounted so a half-entered confirmation survives a look at the other tab */}
        <div className={cn("space-y-4", tab !== "confirmations" && "hidden")}>
          <SubmissionRecords noun="confirmation" apiBase="/api/profit-sharing/confirmations" lookupUrl="/api/profit-sharing/lookup" initialRows={initialRows} today={today} notify={show} />
        </div>
        {tab === "calculator" && (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50"><Calculator className="h-7 w-7 text-indigo-600" /></div>
            <p className="mt-4 text-[16px] font-bold text-slate-900">Profit Share Calculator</p>
            <p className="mt-1 max-w-md text-[13px] text-slate-500">Coming soon. The calculation will be added here and will use the confirmations entered on the Confirmations tab.</p>
          </div>
        )}
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </>
  );
}
