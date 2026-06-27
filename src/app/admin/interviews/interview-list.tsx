"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Toast, useToast } from "@/components/ui/toast";
import { Calendar } from "lucide-react";

const INTERVIEW_STATUSES = ["Rejected", "Moved To Next Round", "Confirmation"];

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  Rejected: "danger",
  "Moved To Next Round": "warning",
  Confirmation: "success",
};

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
  id: string;        // DB cuid — used for detail page URL
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

  const fmtDate = (d: string | Date) =>
    new Date(d).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-indigo-600" />
          All Interviews ({interviews.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800">
              <tr>
                {[
                  "Interview ID", "Submission", "Consultant", "Recruiter",
                  "Start", "Duration", "Level", "Vendor", "Client",
                  "Tech Support", "Amount", "Status",
                ].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-slate-300 whitespace-nowrap text-xs uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {interviews.map((iv) => (
                <tr key={iv.id} className="hover:bg-indigo-50/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap">
                    <Link
                      href={`/admin/interviews/${iv.id}`}
                      className="text-blue-700 hover:text-blue-900 hover:underline"
                    >
                      {iv.interviewId}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                    {iv.submission.submissionId}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                    {iv.submission.consultant.firstName} {iv.submission.consultant.lastName}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {iv.recruiter.firstName} {iv.recruiter.lastName}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                    {fmtDate(iv.interviewStartDate)}
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
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {iv.submission.vendorCompany}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {iv.submission.clientName ?? "—"}
                    {iv.submission.clientLocation && (
                      <span className="block text-xs text-slate-400">{iv.submission.clientLocation}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {iv.techSupport
                      ? `${iv.techSupport.firstName} ${iv.techSupport.lastName}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
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
                    No interviews yet. Schedule one above.
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
