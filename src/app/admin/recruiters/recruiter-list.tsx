"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { Users, ToggleLeft, ToggleRight, Mail, Loader2 } from "lucide-react";
import type { User, Role } from "@/generated/prisma/client";

type RecruiterUser = User & { role: Role | null };

export function RecruiterList({ recruiters }: { recruiters: RecruiterUser[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [resendingId, setResendingId] = useState<string | null>(null);
  const { toast, show, hide } = useToast();

  const isActive = (r: RecruiterUser) => Boolean(r.isActive);

  const toggleActive = (id: string, active: boolean) => {
    startTransition(async () => {
      await fetch(`/api/recruiters/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !active }),
      });
      router.refresh();
    });
  };

  const resendActivation = async (recruiterId: string, email: string) => {
    setResendingId(recruiterId);
    try {
      const res = await fetch("/api/recruiters/resend-activation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruiterId }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
      show(`Activation email sent to ${email}`, "success");
    } catch (err: unknown) {
      show(err instanceof Error ? err.message : "Failed to resend email", "error");
    } finally {
      setResendingId(null);
    }
  };

  const fmt = (d: Date | string | null) =>
    d ? new Date(d).toLocaleDateString("en-US", { dateStyle: "medium" }) : "—";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-green-600" />
          All Recruiters ({recruiters.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800">
              <tr>
                {["Name", "Email", "Phone", "Business #", "Role", "Start", "End", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-slate-300 whitespace-nowrap text-xs uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recruiters.map((r) => {
                const active = isActive(r);
                const isResending = resendingId === r.id;

                return (
                  <tr key={r.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                      {r.firstName} {r.lastName}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.email}</td>
                    <td className="px-4 py-3 text-slate-600">{r.phoneNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{r.businessNumber ?? "—"}</td>
                    <td className="px-4 py-3">
                      {r.role ? <Badge variant="info">{r.role.name}</Badge> : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmt(r.startDate)}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmt(r.endDate)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={active ? "success" : "warning"}>
                        {active ? "Active" : "Pending"}
                      </Badge>
                    </td>

                    {/* Actions: Toggle + Resend Email */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => toggleActive(r.id, active)}
                          title={active ? "Disable recruiter" : "Enable recruiter"}
                        >
                          {active ? (
                            <ToggleRight className="h-4 w-4 text-green-600" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-slate-400" />
                          )}
                          {active ? "Disable" : "Enable"}
                        </Button>

                        <div className="relative group inline-block">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={active || isResending}
                            onClick={() => !active && resendActivation(r.id, r.email)}
                            title={active ? "Account already activated" : "Resend activation email"}
                            className={active ? "opacity-40 cursor-not-allowed" : "text-indigo-600 border-indigo-200 hover:bg-indigo-50"}
                          >
                            {isResending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Mail className="h-4 w-4" />
                            )}
                            {isResending ? "Sending…" : "Resend"}
                          </Button>
                          {active && (
                            <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-white whitespace-nowrap group-hover:block z-10">
                              Already activated
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {recruiters.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    No recruiters yet. Onboard one above.
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
