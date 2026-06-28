"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Toast, useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

type SortDir = "asc" | "desc";

const INTERVIEW_STATUSES = ["Rejected", "Moved To Next Round", "Confirmation"];

const LEVEL_VARIANT: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  Screening: "info",
  "Level 1": "default",
  "Level 2": "default",
  "Level 3": "warning",
  Final: "success",
};

function calcDuration(start: string | Date, end: string | Date): string {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (diff <= 0) return "—";
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

interface InterviewRecord {
  id: string;
  interviewId: string;
  interviewStartDate: string | Date;
  interviewEndDate: string | Date;
  interviewLevel: string;
  interviewStatus: string;
  techSupportFeedback: string | null;
  amount: string | null;
  recruiter: { firstName: string; lastName: string };
  submission: {
    submissionId: string;
    technology: string;
    vendorCompany: string;
    clientName: string | null;
    clientLocation: string | null;
    consultant: { firstName: string; lastName: string };
  };
  techSupport: { firstName: string; lastName: string } | null;
}

export function InterviewList({ interviews }: { interviews: InterviewRecord[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { toast, show, hide } = useToast();
  const [sortCol, setSortCol] = useState("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  }

  function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return <ChevronsUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  }

  const sorted = useMemo(() => {
    return [...interviews].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortCol) {
        case "interviewId":  return dir * a.interviewId.localeCompare(b.interviewId);
        case "date":         return dir * (new Date(a.interviewStartDate).getTime() - new Date(b.interviewStartDate).getTime());
        case "consultant":   return dir * (`${a.submission.consultant.firstName} ${a.submission.consultant.lastName}`).localeCompare(`${b.submission.consultant.firstName} ${b.submission.consultant.lastName}`);
        case "recruiter":    return dir * (`${a.recruiter.firstName} ${a.recruiter.lastName}`).localeCompare(`${b.recruiter.firstName} ${b.recruiter.lastName}`);
        case "submission":   return dir * a.submission.submissionId.localeCompare(b.submission.submissionId);
        case "level":        return dir * a.interviewLevel.localeCompare(b.interviewLevel);
        case "vendor":       return dir * a.submission.vendorCompany.localeCompare(b.submission.vendorCompany);
        case "client":       return dir * (a.submission.clientName ?? "").localeCompare(b.submission.clientName ?? "");
        case "techSupport":  return dir * (`${a.techSupport?.firstName ?? ""} ${a.techSupport?.lastName ?? ""}`).localeCompare(`${b.techSupport?.firstName ?? ""} ${b.techSupport?.lastName ?? ""}`);
        case "amount":       return dir * (parseFloat(a.amount ?? "0") - parseFloat(b.amount ?? "0"));
        case "status":       return dir * a.interviewStatus.localeCompare(b.interviewStatus);
        default: return 0;
      }
    });
  }, [interviews, sortCol, sortDir]);

  const fmtDate = (d: string | Date) =>
    new Date(d).toLocaleDateString("en-US", { dateStyle: "medium" });

  const updateStatus = (id: string, interviewStatus: string) => {
    setUpdatingId(id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/interviews/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interviewStatus }),
        });
        if (!res.ok) throw new Error("Failed");
        router.refresh();
      } catch {
        show("Failed to update status", "error");
      } finally {
        setUpdatingId(null);
      }
    });
  };

  const thCls = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300 whitespace-nowrap cursor-pointer select-none hover:bg-slate-700 transition-colors";
  const thFixed = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300 whitespace-nowrap";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50">
          <Calendar className="h-4 w-4 text-indigo-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">All Interviews</h3>
          <p className="text-xs text-slate-500">{interviews.length} total</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-800">
            <tr>
              <th className={thCls} onClick={() => toggleSort("interviewId")}>
                <span className="flex items-center gap-1.5">Interview ID <SortIcon col="interviewId" /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("date")}>
                <span className="flex items-center gap-1.5">Date <SortIcon col="date" /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("consultant")}>
                <span className="flex items-center gap-1.5">Consultant <SortIcon col="consultant" /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("recruiter")}>
                <span className="flex items-center gap-1.5">Recruiter <SortIcon col="recruiter" /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("submission")}>
                <span className="flex items-center gap-1.5">Submission <SortIcon col="submission" /></span>
              </th>
              <th className={thFixed}>Duration</th>
              <th className={thCls} onClick={() => toggleSort("level")}>
                <span className="flex items-center gap-1.5">Level <SortIcon col="level" /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("vendor")}>
                <span className="flex items-center gap-1.5">Vendor <SortIcon col="vendor" /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("client")}>
                <span className="flex items-center gap-1.5">Client <SortIcon col="client" /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("techSupport")}>
                <span className="flex items-center gap-1.5">Tech Support <SortIcon col="techSupport" /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("amount")}>
                <span className="flex items-center gap-1.5">Amount <SortIcon col="amount" /></span>
              </th>
              <th className={thFixed}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((iv) => (
              <tr key={iv.id} className="hover:bg-indigo-50/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap">
                  <Link
                    href={`/admin/interviews/${iv.id}`}
                    className="text-blue-700 hover:text-blue-900 hover:underline"
                  >
                    {iv.interviewId}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                  {fmtDate(iv.interviewStartDate)}
                </td>
                <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap text-xs">
                  {iv.submission.consultant.firstName} {iv.submission.consultant.lastName}
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                  {iv.recruiter.firstName} {iv.recruiter.lastName}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                  {iv.submission.submissionId}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                    {calcDuration(iv.interviewStartDate, iv.interviewEndDate)}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Badge variant={LEVEL_VARIANT[iv.interviewLevel] ?? "default"}>
                    {iv.interviewLevel}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                  {iv.submission.vendorCompany}
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                  {iv.submission.clientName ?? "—"}
                  {iv.submission.clientLocation && (
                    <span className="block text-xs text-slate-400">{iv.submission.clientLocation}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                  {iv.techSupport
                    ? `${iv.techSupport.firstName} ${iv.techSupport.lastName}`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                  {iv.amount ?? "—"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <select
                    value={iv.interviewStatus}
                    disabled={updatingId === iv.id}
                    onChange={(e) => updateStatus(iv.id, e.target.value)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 disabled:opacity-50"
                  >
                    {INTERVIEW_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {interviews.length === 0 && (
              <tr>
                <td colSpan={12} className="py-12 text-center text-slate-400">
                  No interviews yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  );
}
