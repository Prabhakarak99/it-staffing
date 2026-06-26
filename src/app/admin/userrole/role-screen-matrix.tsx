"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { Save, Loader2 } from "lucide-react";
import type { Role, Screen } from "@/generated/prisma/client";

interface Props {
  roles: Role[];
  screens: Screen[];
  initialMatrix: Record<string, Record<string, boolean>>;
}

function AllCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
    />
  );
}

export function RoleScreenMatrix({ roles, screens, initialMatrix }: Props) {
  const [matrix, setMatrix] = useState(initialMatrix);
  const [isPending, startTransition] = useTransition();
  const { toast, show, hide } = useToast();

  const toggle = (roleId: string, screenId: string) => {
    setMatrix((prev) => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        [screenId]: !prev[roleId]?.[screenId],
      },
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
    return {
      checked: checkedCount === roles.length,
      indeterminate: checkedCount > 0 && checkedCount < roles.length,
    };
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
      } catch {
        show("Failed to save permissions. Please try again.", "error");
      }
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Role → Screen Access Matrix</h2>
          <p className="text-sm text-slate-500 mt-0.5">{roles.length} roles · {screens.length} screens</p>
        </div>
        <Button onClick={save} disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Permissions
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="sticky left-0 bg-slate-50 px-6 py-3 text-left font-semibold text-slate-700 min-w-[180px]">
                Screen / Role
              </th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700 whitespace-nowrap min-w-[80px]">
                <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-1 text-xs text-purple-700">
                  All
                </span>
              </th>
              {roles.map((role) => (
                <th
                  key={role.id}
                  className="px-4 py-3 text-center font-semibold text-slate-700 whitespace-nowrap min-w-[120px]"
                >
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">
                    {role.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {screens.map((screen) => (
              <tr key={screen.id} className="hover:bg-slate-50 transition-colors">
                <td className="sticky left-0 bg-white px-6 py-3 font-medium text-slate-800 hover:bg-slate-50">
                  <div>
                    <p className="font-medium text-slate-900">{screen.name}</p>
                    <p className="text-xs text-slate-400">{screen.path}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <AllCheckbox
                    {...rowState(screen.id)}
                    onChange={() => toggleAll(screen.id)}
                  />
                </td>
                {roles.map((role) => (
                  <td key={role.id} className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={matrix[role.id]?.[screen.id] ?? false}
                      onChange={() => toggle(role.id, screen.id)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {screens.length === 0 && (
          <div className="py-12 text-center text-slate-400">
            No screens found. Run the seed script to populate.
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  );
}
