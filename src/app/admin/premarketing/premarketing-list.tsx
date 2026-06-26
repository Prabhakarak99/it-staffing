"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Toast, useToast } from "@/components/ui/toast";
import { Send, Trash2, CheckCircle2, XCircle } from "lucide-react";

interface PreMarketingRecord {
  id: string;
  dlAvailable: string | null;
  visaAvailable: string | null;
  ssnAvailable: string | null;
  marketingSheetReady: string | null;
  marketingSheetExplained: string | null;
  marketingSheetReverseKT: string | null;
  allTrainingSessionsCompleted: string | null;
  allTrainingAssignmentsCompleted: string | null;
  marketingEmail: string | null;
  marketingVisaStatus: string | null;
  marketingStartDate: string | null;
  marketingEndDate: string | null;
  consultant: { id: string; firstName: string; lastName: string; email: string; technology: string | null };
  recruiter: { id: string; firstName: string; lastName: string; email: string } | null;
}

interface Props {
  records: PreMarketingRecord[];
}

function YesNoBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-slate-400 text-xs">—</span>;
  return value === "Yes"
    ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    : <XCircle className="h-4 w-4 text-rose-400" />;
}

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function PreMarketingList({ records }: Props) {
  const [list, setList] = useState(records);
  const [, startTransition] = useTransition();
  const { toast, show, hide } = useToast();
  const router = useRouter();

  const deleteRecord = (id: string, name: string) => {
    if (!confirm(`Delete pre-marketing record for ${name}?`)) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/premarketing/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Delete failed");
        setList((prev) => prev.filter((r) => r.id !== id));
        show(`Record for ${name} deleted`, "success");
        router.refresh();
      } catch {
        show("Failed to delete record", "error");
      }
    });
  };

  if (list.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-slate-400">
          <Send className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm">No pre-marketing records yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5 text-indigo-600" />
          Pre-Marketing Records
          <span className="ml-auto rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
            {list.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-900 text-left">
                {["Consultant", "Technology", "Visa Status", "DL", "Visa", "SSN", "Sheet Ready", "Explained", "Rev. KT", "Sessions", "Assignments", "Start Date", "End Date", "Recruiter", ""].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900 whitespace-nowrap">
                      {r.consultant.firstName} {r.consultant.lastName}
                    </p>
                    <p className="text-xs text-slate-500 truncate max-w-[160px]">{r.consultant.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    {r.consultant.technology
                      ? <Badge variant="indigo">{r.consultant.technology}</Badge>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {r.marketingVisaStatus
                      ? <Badge variant="amber">{r.marketingVisaStatus}</Badge>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center"><YesNoBadge value={r.dlAvailable} /></td>
                  <td className="px-4 py-3 text-center"><YesNoBadge value={r.visaAvailable} /></td>
                  <td className="px-4 py-3 text-center"><YesNoBadge value={r.ssnAvailable} /></td>
                  <td className="px-4 py-3 text-center"><YesNoBadge value={r.marketingSheetReady} /></td>
                  <td className="px-4 py-3 text-center"><YesNoBadge value={r.marketingSheetExplained} /></td>
                  <td className="px-4 py-3 text-center"><YesNoBadge value={r.marketingSheetReverseKT} /></td>
                  <td className="px-4 py-3 text-center"><YesNoBadge value={r.allTrainingSessionsCompleted} /></td>
                  <td className="px-4 py-3 text-center"><YesNoBadge value={r.allTrainingAssignmentsCompleted} /></td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">{fmt(r.marketingStartDate)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">{fmt(r.marketingEndDate)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.recruiter
                      ? <span className="text-slate-700">{r.recruiter.firstName} {r.recruiter.lastName}</span>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => deleteRecord(r.id, `${r.consultant.firstName} ${r.consultant.lastName}`)}
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
