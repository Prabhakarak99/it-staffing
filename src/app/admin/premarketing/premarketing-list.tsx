"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { Send, Trash2, CheckCircle2, XCircle, Minus, CalendarRange, Users } from "lucide-react";

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

const BOOL_FIELDS: (keyof PreMarketingRecord)[] = [
  "dlAvailable", "visaAvailable", "ssnAvailable",
  "marketingSheetReady", "marketingSheetExplained", "marketingSheetReverseKT",
  "allTrainingSessionsCompleted", "allTrainingAssignmentsCompleted",
];

function readinessScore(r: PreMarketingRecord) {
  return BOOL_FIELDS.filter((f) => r[f] === "Yes").length;
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function CheckDot({ value, label }: { value: string | null; label: string }) {
  return (
    <div title={`${label}: ${value ?? "—"}`} className="flex flex-col items-center gap-0.5">
      {value === "Yes" ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      ) : value === "No" ? (
        <XCircle className="h-4 w-4 text-rose-400" />
      ) : (
        <Minus className="h-4 w-4 text-slate-300" />
      )}
      <span className="text-[9px] text-slate-400 font-medium">{label}</span>
    </div>
  );
}

function ReadinessBar({ score, total = 8 }: { score: number; total?: number }) {
  const pct = Math.round((score / total) * 100);
  const color =
    pct >= 80 ? "bg-emerald-500" :
    pct >= 50 ? "bg-amber-400" :
    "bg-rose-400";
  const textColor =
    pct >= 80 ? "text-emerald-700" :
    pct >= 50 ? "text-amber-700" :
    "text-rose-600";

  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold tabular-nums ${textColor}`}>{score}/{total}</span>
    </div>
  );
}

function StatusPill({ score }: { score: number }) {
  if (score === 8) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
      <CheckCircle2 className="h-3 w-3" /> Ready
    </span>
  );
  if (score >= 5) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
      In Progress
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
      Pending
    </span>
  );
}

export function PreMarketingList({ records }: { records: PreMarketingRecord[] }) {
  const [list, setList] = useState(records);
  const [, startTransition] = useTransition();
  const { toast, show, hide } = useToast();
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteRecord = (id: string, name: string) => {
    if (!confirm(`Delete pre-marketing record for ${name}?`)) return;
    setDeletingId(id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/premarketing/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Delete failed");
        setList((prev) => prev.filter((r) => r.id !== id));
        show(`Record for ${name} deleted`, "success");
        router.refresh();
      } catch {
        show("Failed to delete record", "error");
      } finally {
        setDeletingId(null);
      }
    });
  };

  const readyCount = list.filter((r) => readinessScore(r) === 8).length;
  const inProgressCount = list.filter((r) => { const s = readinessScore(r); return s >= 5 && s < 8; }).length;

  if (list.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
          <Send className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-700">No pre-marketing records yet</p>
        <p className="text-xs text-slate-400 mt-1">Create one above to start tracking consultant readiness</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* List header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50">
            <Send className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Pre-Marketing Records</h3>
            <p className="text-xs text-slate-500">{list.length} consultant{list.length !== 1 ? "s" : ""} tracked</p>
          </div>
        </div>
        {/* Summary chips */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs font-semibold text-emerald-700">{readyCount} Ready</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1">
            <Users className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs font-semibold text-amber-700">{inProgressCount} In Progress</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-left">
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap">Consultant</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap">Status</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap">Readiness</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap text-center">Documents</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap text-center">Mkt Sheet</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap text-center">Training</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap">Visa</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap">
                <div className="flex items-center gap-1"><CalendarRange className="h-3.5 w-3.5" /> Period</div>
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap">Recruiter</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((r) => {
              const score = readinessScore(r);
              const startDate = fmtDate(r.marketingStartDate);
              const endDate = fmtDate(r.marketingEndDate);

              return (
                <tr
                  key={r.id}
                  className={cn(
                    "transition-colors hover:bg-indigo-50/30",
                    score === 8 && "bg-emerald-50/20",
                  )}
                >
                  {/* Consultant */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                        {initials(`${r.consultant.firstName} ${r.consultant.lastName}`)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 whitespace-nowrap text-sm">
                          {r.consultant.firstName} {r.consultant.lastName}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {r.consultant.technology && (
                            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                              {r.consultant.technology}
                            </span>
                          )}
                          {r.marketingEmail && (
                            <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{r.marketingEmail}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <StatusPill score={score} />
                  </td>

                  {/* Readiness bar */}
                  <td className="px-4 py-3.5">
                    <ReadinessBar score={score} />
                  </td>

                  {/* Documents: DL | Visa | SSN */}
                  <td className="px-4 py-3.5">
                    <div className="flex justify-center gap-3">
                      <CheckDot value={r.dlAvailable} label="DL" />
                      <CheckDot value={r.visaAvailable} label="Visa" />
                      <CheckDot value={r.ssnAvailable} label="SSN" />
                    </div>
                  </td>

                  {/* Marketing Sheet: Ready | Explained | Rev KT */}
                  <td className="px-4 py-3.5">
                    <div className="flex justify-center gap-3">
                      <CheckDot value={r.marketingSheetReady} label="Ready" />
                      <CheckDot value={r.marketingSheetExplained} label="Expl." />
                      <CheckDot value={r.marketingSheetReverseKT} label="KT" />
                    </div>
                  </td>

                  {/* Training: Sessions | Assignments */}
                  <td className="px-4 py-3.5">
                    <div className="flex justify-center gap-3">
                      <CheckDot value={r.allTrainingSessionsCompleted} label="Sess." />
                      <CheckDot value={r.allTrainingAssignmentsCompleted} label="Asgn." />
                    </div>
                  </td>

                  {/* Visa status */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {r.marketingVisaStatus ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                        {r.marketingVisaStatus === "H4Ead" ? "H4 EAD" : r.marketingVisaStatus}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>

                  {/* Period */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {startDate ? (
                      <div className="text-xs text-slate-700">
                        <p className="font-medium">{startDate}</p>
                        {endDate && <p className="text-slate-400">→ {endDate}</p>}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>

                  {/* Recruiter */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {r.recruiter ? (
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-[10px] font-bold text-rose-700">
                          {initials(`${r.recruiter.firstName} ${r.recruiter.lastName}`)}
                        </div>
                        <span className="text-xs font-medium text-slate-700">
                          {r.recruiter.firstName} {r.recruiter.lastName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>

                  {/* Delete */}
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => deleteRecord(r.id, `${r.consultant.firstName} ${r.consultant.lastName}`)}
                      disabled={deletingId === r.id}
                      className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-colors disabled:opacity-40"
                      title="Delete record"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  );
}
