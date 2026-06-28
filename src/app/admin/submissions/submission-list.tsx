"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Toast, useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { FileText, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

type SortDir = "asc" | "desc";

const STATUSES = [
  "Submission Submitted", "In Review", "Rejected",
  "Moved to Client", "Confirmation",
];

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  "Submission Submitted": "info",
  "In Review": "warning",
  "Rejected": "danger",
  "Moved to Client": "default",
  "Confirmation": "success",
};

interface SubmissionRecord {
  id: string;
  submissionId: string;
  submissionDate: string | Date;
  technology: string;
  payRate: string | null;
  vendorCompany: string;
  vendorRecruiterName: string;
  clientName: string | null;
  clientLocation: string | null;
  status: string;
  recruiter: { firstName: string; lastName: string };
  consultant: { firstName: string; lastName: string; technology: string | null };
}

export function SubmissionList({ submissions }: { submissions: SubmissionRecord[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { toast, show, hide } = useToast();
  const [sortCol, setSortCol] = useState("submissionDate");
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
    return [...submissions].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortCol) {
        case "submissionId":   return dir * a.submissionId.localeCompare(b.submissionId);
        case "submissionDate": return dir * (new Date(a.submissionDate).getTime() - new Date(b.submissionDate).getTime());
        case "recruiter":      return dir * (`${a.recruiter.firstName} ${a.recruiter.lastName}`).localeCompare(`${b.recruiter.firstName} ${b.recruiter.lastName}`);
        case "consultant":     return dir * (`${a.consultant.firstName} ${a.consultant.lastName}`).localeCompare(`${b.consultant.firstName} ${b.consultant.lastName}`);
        case "technology":     return dir * a.technology.localeCompare(b.technology);
        case "vendorCompany":  return dir * a.vendorCompany.localeCompare(b.vendorCompany);
        case "clientName":     return dir * (a.clientName ?? "").localeCompare(b.clientName ?? "");
        case "payRate":        return dir * (parseFloat(a.payRate ?? "0") - parseFloat(b.payRate ?? "0"));
        case "status":         return dir * a.status.localeCompare(b.status);
        default: return 0;
      }
    });
  }, [submissions, sortCol, sortDir]);

  const fmt = (d: Date | string) =>
    new Date(d).toLocaleDateString("en-US", { dateStyle: "medium" });

  const updateStatus = (id: string, status: string) => {
    setUpdatingId(id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/submissions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) throw new Error("Failed to update status");
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
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50">
          <FileText className="h-4 w-4 text-sky-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">All Submissions</h3>
          <p className="text-xs text-slate-500">{submissions.length} total</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-800">
            <tr>
              <th className={thCls} onClick={() => toggleSort("submissionId")}>
                <span className="flex items-center gap-1.5">Sub ID <SortIcon col="submissionId" /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("submissionDate")}>
                <span className="flex items-center gap-1.5">Date <SortIcon col="submissionDate" /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("recruiter")}>
                <span className="flex items-center gap-1.5">Recruiter <SortIcon col="recruiter" /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("consultant")}>
                <span className="flex items-center gap-1.5">Consultant <SortIcon col="consultant" /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("technology")}>
                <span className="flex items-center gap-1.5">Technology <SortIcon col="technology" /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("vendorCompany")}>
                <span className="flex items-center gap-1.5">Vendor <SortIcon col="vendorCompany" /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("clientName")}>
                <span className="flex items-center gap-1.5">Client <SortIcon col="clientName" /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("payRate")}>
                <span className="flex items-center gap-1.5">Pay Rate <SortIcon col="payRate" /></span>
              </th>
              <th className={thFixed}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((s) => (
              <tr key={s.id} className="hover:bg-sky-50/20 transition-colors">
                <td className="px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap">
                  <Link
                    href={`/admin/submissions/${s.id}`}
                    className="text-blue-700 hover:text-blue-900 hover:underline"
                  >
                    {s.submissionId}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                  {fmt(s.submissionDate)}
                </td>
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap text-xs">
                  {s.recruiter.firstName} {s.recruiter.lastName}
                </td>
                <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap text-xs">
                  {s.consultant.firstName} {s.consultant.lastName}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Badge variant="info">{s.technology}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                  {s.vendorCompany}
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                  {s.clientName ?? "—"}
                  {s.clientLocation && (
                    <span className="block text-xs text-slate-400">{s.clientLocation}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                  {s.payRate ?? "—"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <select
                    value={s.status}
                    disabled={updatingId === s.id}
                    onChange={(e) => updateStatus(s.id, e.target.value)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 disabled:opacity-50"
                  >
                    {STATUSES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {submissions.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  No submissions yet.
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
