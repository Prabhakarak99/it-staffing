"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo, useTransition } from "react";
import { Toast, useToast } from "@/components/ui/toast";
import { TabSearchBar } from "@/components/ui/tab-search-bar";
import { HighlightText } from "@/components/ui/highlight-text";
import { filterBySearch, searchBlob } from "@/lib/table-search";
import { cn } from "@/lib/utils";
import {
  Users, ToggleLeft, ToggleRight, Mail, Loader2, Trash2,
  ChevronUp, ChevronDown, ChevronsUpDown, KeyRound,
} from "lucide-react";
import type { SafeUserWithRole } from "@/lib/user-safe";

type UserWithRole = SafeUserWithRole;
type SortDir = "asc" | "desc";

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function SortIcon({ col, sortCol, sortDir }: { col: string; sortCol: string; sortDir: SortDir }) {
  if (sortCol !== col) return <ChevronsUpDown className="h-3 w-3 opacity-30" />;
  return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
}

export function UserList({ users, onSelect }: { users: UserWithRole[]; onSelect?: (id: string) => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resettingAll, setResettingAll] = useState(false);
  const { toast, show, hide } = useToast();
  const [sortCol, setSortCol] = useState("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [searchQuery, setSearchQuery] = useState("");

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  }

  const filtered = useMemo(() => {
    return filterBySearch(users, searchQuery, (u) => searchBlob(
      u.firstName, u.lastName, u.email, u.phoneNumber, u.role?.name,
      u.isActive ? "Active" : "Pending",
    ));
  }, [users, searchQuery]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortCol) {
        case "name":   return dir * (`${a.firstName} ${a.lastName}`).localeCompare(`${b.firstName} ${b.lastName}`);
        case "email":  return dir * a.email.localeCompare(b.email);
        case "role":   return dir * (a.role?.name ?? "").localeCompare(b.role?.name ?? "");
        case "status": return dir * (Number(Boolean(b.isActive)) - Number(Boolean(a.isActive)));
        default: return 0;
      }
    });
  }, [filtered, sortCol, sortDir]);

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
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed to delete user");
        show(`${name} deleted`, "success");
        router.refresh();
      } catch (err: unknown) {
        show(err instanceof Error ? err.message : "Failed to delete user", "error");
      } finally { setDeletingId(null); }
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
    } finally { setResendingId(null); }
  };

  const postReset = async (body: { userId: string } | { all: true }) => {
    const res = await fetch("/api/users/send-password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
    return data as { sent: number; failed: string[] };
  };

  const sendResetLink = async (userId: string, name: string, email: string) => {
    if (!confirm(`Email a password reset link to ${name} (${email})? Their current password keeps working until they set a new one.`)) return;
    setResettingId(userId);
    try {
      await postReset({ userId });
      show(`Password reset link sent to ${email}`, "success");
    } catch (err: unknown) {
      show(err instanceof Error ? err.message : "Failed to send reset link", "error");
    } finally { setResettingId(null); }
  };

  const sendResetLinkToAll = async () => {
    const others = activeCount - 1;
    if (!confirm(`Email a password reset link to all ${others} other active users? Each link is valid for 24 hours; current passwords keep working until changed.`)) return;
    setResettingAll(true);
    try {
      const { sent, failed } = await postReset({ all: true });
      if (failed.length) show(`Sent ${sent} reset links; ${failed.length} failed (${failed.slice(0, 3).join(", ")}${failed.length > 3 ? "…" : ""})`, "error");
      else show(`Password reset links sent to ${sent} users`, "success");
    } catch (err: unknown) {
      show(err instanceof Error ? err.message : "Failed to send reset links", "error");
    } finally { setResettingAll(false); }
  };

  const activeCount = users.filter((u) => Boolean(u.isActive)).length;
  const pendingCount = users.length - activeCount;

  if (users.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
          <Users className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-700">No users yet</p>
        <p className="text-xs text-slate-400 mt-1">Add the first user using the button above</p>
      </div>
    );
  }

  const thCls = "px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap cursor-pointer select-none hover:bg-slate-700 transition-colors";
  const thFixed = "px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50">
            <Users className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">All Users</h3>
            <p className="text-xs text-slate-500">
              {searchQuery ? `${sorted.length} of ${users.length} shown` : `${users.length} total`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:ml-auto">
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-emerald-700">{activeCount} Active</span>
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span className="text-xs font-semibold text-amber-700">{pendingCount} Pending</span>
            </div>
          )}
          <button
            onClick={() => void sendResetLinkToAll()}
            disabled={resettingAll || activeCount < 2}
            title="Email every active user a link to set a new password"
            className="flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-50"
          >
            {resettingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
            {resettingAll ? "Sending…" : "Send reset link to all"}
          </button>
          <TabSearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search users…" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-left">
              <th className={thCls} onClick={() => toggleSort("name")}>
                <span className="flex items-center gap-1.5">User <SortIcon col="name" sortCol={sortCol} sortDir={sortDir} /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("email")}>
                <span className="flex items-center gap-1.5">Contact <SortIcon col="email" sortCol={sortCol} sortDir={sortDir} /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("role")}>
                <span className="flex items-center gap-1.5">Role <SortIcon col="role" sortCol={sortCol} sortDir={sortDir} /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("status")}>
                <span className="flex items-center gap-1.5">Status <SortIcon col="status" sortCol={sortCol} sortDir={sortDir} /></span>
              </th>
              <th className={thFixed}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((user) => {
              const active = isActive(user);
              const isResending = resendingId === user.id;
              const name = `${user.firstName} ${user.lastName}`;
              return (
                <tr key={user.id} className={cn("hover:bg-indigo-50/20 transition-colors", !active && "opacity-80")}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        active ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
                      )}>
                        {initials(name)}
                      </div>
                      <button
                        type="button"
                        onClick={() => onSelect?.(user.id)}
                        className="font-semibold text-slate-900 whitespace-nowrap text-left transition-colors hover:text-indigo-600 hover:underline"
                      >
                        <HighlightText text={name} query={searchQuery} />
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-xs text-slate-600 truncate max-w-[160px]">
                      <HighlightText text={user.email} query={searchQuery} />
                    </p>
                    {user.phoneNumber && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        <HighlightText text={user.phoneNumber} query={searchQuery} />
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {user.role ? (
                      <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                        <HighlightText text={user.role.name} query={searchQuery} />
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      active ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    )}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-emerald-500" : "bg-amber-500")} />
                      {active ? "Active" : "Pending"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        disabled={isPending}
                        onClick={() => toggleActive(user.id, active)}
                        title={active ? "Disable user" : "Activate user"}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                          active
                            ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        )}>
                        {active ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                        {active ? "Disable" : "Activate"}
                      </button>

                      {active ? (
                        <button
                          disabled={resettingId === user.id}
                          onClick={() => void sendResetLink(user.id, name, user.email)}
                          title="Email a password reset link"
                          className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-100 disabled:opacity-50">
                          {resettingId === user.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                          {resettingId === user.id ? "Sending…" : "Reset password"}
                        </button>
                      ) : (
                        <button
                          disabled={isResending}
                          onClick={() => resendActivation(user.id, user.email)}
                          title="Resend activation email"
                          className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-100 disabled:opacity-50">
                          {isResending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                          {isResending ? "Sending…" : "Resend"}
                        </button>
                      )}

                      <button
                        disabled={deletingId === user.id}
                        onClick={() => deleteUser(user.id, name)}
                        title="Delete user"
                        className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition-colors disabled:opacity-50">
                        {deletingId === user.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  );
}
