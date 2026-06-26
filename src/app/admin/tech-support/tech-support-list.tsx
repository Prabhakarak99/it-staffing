"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { Briefcase, Trash2, Loader2, ExternalLink } from "lucide-react";
import type { TechSupport } from "@/generated/prisma/client";

const LOCATION_VARIANT: Record<string, "success" | "info" | "default"> = {
  USA: "success",
  India: "info",
  Other: "default",
};

export function TechSupportList({ people }: { people: TechSupport[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast, show, hide } = useToast();

  const deletePerson = (id: string, name: string) => {
    if (!confirm(`Remove ${name} from tech support?`)) return;
    setDeletingId(id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/tech-support/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete");
        show(`${name} removed`, "success");
        router.refresh();
      } catch {
        show("Failed to remove tech support person", "error");
      } finally {
        setDeletingId(null);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-indigo-600" />
          Tech Support Team ({people.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800">
              <tr>
                {[
                  "Name", "Email", "Phone", "Technology",
                  "Location", "Availability (CST)", "Amount", "Calendar", "Action",
                ].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-slate-300 whitespace-nowrap text-xs uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {people.map((p) => (
                <tr key={p.id} className="hover:bg-indigo-50/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                    {p.firstName} {p.lastName}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.email}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{p.phoneNumber}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant="info">{p.technology}</Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant={LOCATION_VARIANT[p.location] ?? "default"}>
                      {p.location}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {p.availability ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {p.amount ?? "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {p.calendarLink ? (
                      <a
                        href={p.calendarLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Book
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={deletingId === p.id}
                      onClick={() => deletePerson(p.id, `${p.firstName} ${p.lastName}`)}
                      className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                    >
                      {deletingId === p.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />}
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
              {people.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No tech support added yet.
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
