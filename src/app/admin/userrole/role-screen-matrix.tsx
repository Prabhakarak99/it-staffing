"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { Save, Loader2, Shield, CheckCircle2, XCircle } from "lucide-react";
import type { Role, Screen } from "@/generated/prisma/client";

interface Props {
  roles: Role[];
  screens: Screen[];
  initialMatrix: Record<string, Record<string, boolean>>;
}

function AllCheckbox({ checked, indeterminate, onChange }: {
  checked: boolean; indeterminate: boolean; onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input ref={ref} type="checkbox" checked={checked} onChange={onChange}
      className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer" />
  );
}

export function RoleScreenMatrix({ roles, screens, initialMatrix }: Props) {
  const [matrix, setMatrix] = useState(initialMatrix);
  const [isPending, startTransition] = useTransition();
  const { toast, show, hide } = useToast();

  const toggle = (roleId: string, screenId: string) => {
    setMatrix((prev) => ({
      ...prev,
      [roleId]: { ...prev[roleId], [screenId]: !prev[roleId]?.[screenId] },
    }));
  };

  const toggleAll = (screenId: string) => {
    const allChecked = roles.every((r) => matrix[r.id]?.[screenId]);
    setMatrix((prev) => {
      const next = { ...prev };
      for (const role of roles) {
        next[role.id] = { ...next[role.id], [screenId]: !allChecked };
      }
      return next;
    });
  };

  const rowState = (screenId: string) => {
    const checkedCount = roles.filter((r) => matrix[r.id]?.[screenId]).length;
    return { checked: checkedCount === roles.length, indeterminate: checkedCount > 0 && checkedCount < roles.length };
  };

  const save = () => {
    startTransition(async () => {
      try {
        const assignments: { roleId: string; screenId: string; canView: boolean }[] = [];
        for (const roleId of Object.keys(matrix)) {
          for (const screenId of Object.keys(matrix[roleId])) {
            assignments.push({ roleId, screenId, canView: matrix[roleId][screenId] });
          }
        }
        const res = await fetch("/api/role-screens", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignments }),
        });
        if (!res.ok) throw new Error("Failed to save");
        show("Access permissions saved successfully!", "success");
      } catch { show("Failed to save permissions. Please try again.", "error"); }
    });
  };

  const totalPermissions = Object.values(matrix).reduce((sum, rolePerms) =>
    sum + Object.values(rolePerms).filter(Boolean).length, 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Gradient header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 to-violet-700 px-6 py-5">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute -left-4 bottom-0 h-16 w-16 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm shadow-inner">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Role → Screen Access Matrix</h2>
            <p className="text-sm text-white/70">{roles.length} roles · {screens.length} screens · {totalPermissions} permissions assigned</p>
          </div>
          <div className="ml-auto">
            <button
              onClick={save}
              disabled={isPending}
              className="flex items-center gap-2 rounded-xl bg-white/15 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/25 transition-all disabled:opacity-60 backdrop-blur-sm shadow-sm"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isPending ? "Saving…" : "Save Permissions"}
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 border-b border-slate-100 bg-slate-50 px-6 py-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Legend:</span>
        <div className="flex items-center gap-1.5">
          <div className="flex h-4 w-4 items-center justify-center rounded bg-indigo-600">
            <CheckCircle2 className="h-3 w-3 text-white" />
          </div>
          <span className="text-xs text-slate-600">Has Access</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex h-4 w-4 items-center justify-center rounded bg-slate-200">
            <XCircle className="h-3 w-3 text-slate-400" />
          </div>
          <span className="text-xs text-slate-600">No Access</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex h-4 w-4 items-center justify-center rounded bg-purple-100">
            <CheckCircle2 className="h-3 w-3 text-purple-600" />
          </div>
          <span className="text-xs text-slate-600">Toggle All</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800">
              <th className="sticky left-0 bg-slate-800 px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-300 min-w-[200px] z-10">
                Screen / Page
              </th>
              <th className="px-4 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-300 min-w-[80px]">
                <div className="flex flex-col items-center gap-1">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-500/30">
                    <Shield className="h-3 w-3 text-purple-300" />
                  </div>
                  <span className="text-[10px]">All Roles</span>
                </div>
              </th>
              {roles.map((role) => (
                <th key={role.id} className="px-4 py-4 text-center min-w-[120px]">
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/30 text-[10px] font-bold text-indigo-300">
                      {role.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-[10px] font-semibold text-slate-300 whitespace-nowrap">{role.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {screens.map((screen, si) => {
              const { checked, indeterminate } = rowState(screen.id);
              const assignedCount = roles.filter((r) => matrix[r.id]?.[screen.id]).length;
              return (
                <tr key={screen.id} className={cn(
                  "transition-colors group",
                  si % 2 === 0 ? "bg-white" : "bg-slate-50/50",
                  "hover:bg-indigo-50/30"
                )}>
                  <td className={cn(
                    "sticky left-0 px-6 py-4 z-10",
                    si % 2 === 0 ? "bg-white group-hover:bg-indigo-50/30" : "bg-slate-50/50 group-hover:bg-indigo-50/30"
                  )}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                        <Shield className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 whitespace-nowrap">{screen.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{screen.path}</p>
                        <div className="mt-1 flex items-center gap-1">
                          <div className="h-1 rounded-full bg-slate-100 flex-1 max-w-[60px]">
                            <div className="h-full rounded-full bg-indigo-400 transition-all"
                              style={{ width: `${roles.length > 0 ? (assignedCount / roles.length) * 100 : 0}%` }} />
                          </div>
                          <span className="text-[9px] text-slate-400">{assignedCount}/{roles.length}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex justify-center">
                      <AllCheckbox checked={checked} indeterminate={indeterminate} onChange={() => toggleAll(screen.id)} />
                    </div>
                  </td>
                  {roles.map((role) => {
                    const has = matrix[role.id]?.[screen.id] ?? false;
                    return (
                      <td key={role.id} className="px-4 py-4 text-center">
                        <div className="flex justify-center">
                          <button type="button" onClick={() => toggle(role.id, screen.id)}
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-lg transition-all",
                              has
                                ? "bg-indigo-600 shadow-sm hover:bg-indigo-700"
                                : "bg-slate-100 hover:bg-slate-200"
                            )}>
                            {has
                              ? <CheckCircle2 className="h-4 w-4 text-white" />
                              : <XCircle className="h-4 w-4 text-slate-300" />}
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        {screens.length === 0 && (
          <div className="py-16 text-center text-slate-400">
            <Shield className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">No screens found.</p>
            <p className="text-xs mt-1">Run the seed script to populate screens.</p>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  );
}
