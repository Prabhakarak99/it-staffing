"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { GraduationCap, Trash2, Loader2, FileText } from "lucide-react";

type Consultant = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  personalPhone?: string | null;
  technology?: string | null;
  visaStatus?: string | null;
  projectStatus?: string | null;
  offerLetterType?: string | null;
  workMode?: string | null;
  city?: string | null;
  state?: string | null;
  createdAt: string;
};

const STATUS_VARIANT: Record<string, "success" | "info" | "warning" | "default" | "danger"> = {
  "Project Started": "success",
  "Project Completed": "info",
  "Verbal Confirmation": "warning",
  "Confirmation": "warning",
  "In Market": "default",
};

export function ConsultantList({ consultants }: { consultants: Consultant[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast, show, hide } = useToast();

  const deleteConsultant = (id: string, name: string) => {
    if (!confirm(`Remove consultant ${name}? This cannot be undone.`)) return;
    setDeletingId(id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/students/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete");
        show(`${name} removed`, "success");
        router.refresh();
      } catch {
        show("Failed to remove consultant", "error");
      } finally {
        setDeletingId(null);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-indigo-600" />
          Consultants ({consultants.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800">
              <tr>
                {[
                  "Name", "Email", "Phone", "Technology",
                  "Visa", "Project Status", "Work Mode", "Location", "Action",
                ].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-slate-300 whitespace-nowrap text-xs uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {consultants.map((c) => (
                <tr key={c.id} className="hover:bg-indigo-50/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                    {c.firstName} {c.lastName}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.email}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {c.personalPhone ?? "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.technology ? <Badge variant="info">{c.technology}</Badge> : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.visaStatus ? <Badge variant="default">{c.visaStatus}</Badge> : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.projectStatus
                      ? <Badge variant={STATUS_VARIANT[c.projectStatus] ?? "default"}>{c.projectStatus}</Badge>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.workMode ? <Badge variant="default">{c.workMode}</Badge> : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {c.city && c.state ? `${c.city}, ${c.state}` : c.city ?? c.state ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={deletingId === c.id}
                      onClick={() => deleteConsultant(c.id, `${c.firstName} ${c.lastName}`)}
                      className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                    >
                      {deletingId === c.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />}
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
              {consultants.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <FileText className="h-8 w-8" />
                      <p>No consultants onboarded yet.</p>
                    </div>
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
