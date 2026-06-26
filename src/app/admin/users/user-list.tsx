"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { Users, ToggleLeft, ToggleRight, Mail, Loader2, Trash2 } from "lucide-react";
import type { User, Role } from "@/generated/prisma/client";

type UserWithRole = User & { role: Role | null };

export function UserList({ users }: { users: UserWithRole[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast, show, hide } = useToast();

  // SQLite returns 0/1 integers — coerce to boolean reliably
  const isActive = (user: UserWithRole) => Boolean(user.isActive);

  const toggleActive = (id: string, active: boolean) => {
    startTransition(async () => {
      await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !active }),
      });
      router.refresh();
    });
  };

  const deleteUser = (id: string, name: string) => {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete");
        show(`${name} deleted`, "success");
        router.refresh();
      } catch {
        show("Failed to delete user", "error");
      } finally {
        setDeletingId(null);
      }
    });
  };

  const resendActivation = async (userId: string, email: string) => {
    setResendingId(userId);
    try {
      const res = await fetch("/api/users/resend-activation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-indigo-600" />
          All Users ({users.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800">
              <tr>
                {["Name", "Email", "Phone", "Role", "Status", "Toggle", "Resend Email", "Delete"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-slate-300 whitespace-nowrap text-xs uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => {
                const active = isActive(user);
                const isResending = resendingId === user.id;

                return (
                  <tr key={user.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                      {user.firstName} {user.lastName}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{user.email}</td>
                    <td className="px-4 py-3 text-slate-600">{user.phoneNumber ?? "—"}</td>
                    <td className="px-4 py-3">
                      {user.role ? (
                        <Badge variant="info">{user.role.name}</Badge>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={active ? "success" : "warning"}>
                        {active ? "Active" : "Pending"}
                      </Badge>
                    </td>

                    {/* Toggle Active / Disable */}
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => toggleActive(user.id, active)}
                        title={active ? "Disable user" : "Activate user"}
                      >
                        {active ? (
                          <ToggleRight className="h-4 w-4 text-green-600" />
                        ) : (
                          <ToggleLeft className="h-4 w-4 text-slate-400" />
                        )}
                        {active ? "Disable" : "Activate"}
                      </Button>
                    </td>

                    {/* Resend Email — always visible, disabled once activated */}
                    <td className="px-4 py-3">
                      <div className="relative group inline-block">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={active || isResending}
                          onClick={() => !active && resendActivation(user.id, user.email)}
                          title={active ? "Account already activated" : "Resend activation email"}
                          className={active ? "opacity-40 cursor-not-allowed" : ""}
                        >
                          {isResending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Mail className={`h-4 w-4 ${active ? "text-slate-400" : "text-indigo-600"}`} />
                          )}
                          {isResending ? "Sending…" : "Resend Email"}
                        </Button>

                        {/* Tooltip when disabled */}
                        {active && (
                          <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-white whitespace-nowrap group-hover:block z-10">
                            Account already activated
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Delete */}
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={deletingId === user.id}
                        onClick={() => deleteUser(user.id, `${user.firstName} ${user.lastName}`)}
                        className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                      >
                        {deletingId === user.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4" />}
                        Delete
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    No users yet. Create one above.
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
