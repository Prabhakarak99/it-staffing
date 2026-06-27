"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Toast, useToast } from "@/components/ui/toast";
import { FileText } from "lucide-react";

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

  const fmt = (d: Date | string) =>
    new Date(d).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-600" />
          All Submissions ({submissions.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800">
              <tr>
                {[
                  "Sub ID", "Date", "Recruiter", "Consultant",
                  "Technology", "Vendor", "Client", "Pay Rate", "Status",
                ].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-slate-300 whitespace-nowrap text-xs uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {submissions.map((s) => (
                <tr key={s.id} className="hover:bg-indigo-50/30 transition-colors">
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
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    {s.recruiter.firstName} {s.recruiter.lastName}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                    {s.consultant.firstName} {s.consultant.lastName}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant="info">{s.technology}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {s.vendorCompany}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {s.clientName ?? "—"}
                    {s.clientLocation && (
                      <span className="block text-xs text-slate-400">{s.clientLocation}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
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
                    No submissions yet. Create one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </Card>
  );
}
