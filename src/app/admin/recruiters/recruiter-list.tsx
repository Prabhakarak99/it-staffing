"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { Users, Mail, Loader2, Pencil, X, ToggleLeft, ToggleRight, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { User, Role } from "@/generated/prisma/client";
import { Select } from "@/components/ui/select";

type SortDir = "asc" | "desc";
type RecruiterUser = User & { role: Role | null };

interface EditForm {
  firstName: string; lastName: string; phoneNumber: string;
  businessNumber: string; roleId: string; startDate: string; endDate: string;
}

function toDateInput(d: Date | string | null): string {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function fmtDate(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { dateStyle: "medium" });
}

export function RecruiterList({ recruiters, roles }: { recruiters: RecruiterUser[]; roles: Role[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast, show, hide } = useToast();
  const [sortCol, setSortCol] = useState("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  }

  function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return <ChevronsUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  }

  const sorted = useMemo(() => {
    return [...recruiters].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortCol) {
        case "name":   return dir * (`${a.firstName} ${a.lastName}`).localeCompare(`${b.firstName} ${b.lastName}`);
        case "email":  return dir * a.email.localeCompare(b.email);
        case "role":   return dir * (a.role?.name ?? "").localeCompare(b.role?.name ?? "");
        case "period": return dir * (new Date(a.startDate ?? 0).getTime() - new Date(b.startDate ?? 0).getTime());
        case "status": return dir * (Number(Boolean(b.isActive)) - Number(Boolean(a.isActive)));
        default: return 0;
      }
    });
  }, [recruiters, sortCol, sortDir]);

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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruiterId }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
      show(`Activation email sent to ${email}`, "success");
    } catch (err: unknown) {
      show(err instanceof Error ? err.message : "Failed to resend email", "error");
    } finally { setResendingId(null); }
  };

  const openEdit = (r: RecruiterUser) => {
    setEditingId(r.id);
    setEditForm({
      firstName: r.firstName, lastName: r.lastName,
      phoneNumber: r.phoneNumber ?? "", businessNumber: r.businessNumber ?? "",
      roleId: r.roleId ?? "", startDate: toDateInput(r.startDate), endDate: toDateInput(r.endDate),
    });
  };

  const closeEdit = () => { setEditingId(null); setEditForm(null); };

  const saveEdit = async () => {
    if (!editingId || !editForm) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/recruiters/${editingId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: editForm.firstName, lastName: editForm.lastName,
          phoneNumber: editForm.phoneNumber || null, businessNumber: editForm.businessNumber || null,
          roleId: editForm.roleId || null, startDate: editForm.startDate || null, endDate: editForm.endDate || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to update recruiter");
      show("Recruiter updated successfully", "success");
      closeEdit();
      router.refresh();
    } catch (err: unknown) {
      show(err instanceof Error ? err.message : "Update failed", "error");
    } finally { setSaving(false); }
  };

  const setField = (field: keyof EditForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setEditForm((prev) => prev ? { ...prev, [field]: e.target.value } : prev);

  const activeCount = recruiters.filter((r) => Boolean(r.isActive)).length;
  const pendingCount = recruiters.length - activeCount;

  if (recruiters.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
          <Users className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-700">No recruiters onboarded yet</p>
        <p className="text-xs text-slate-400 mt-1">Onboard your first recruiter using the button above</p>
      </div>
    );
  }

  const thCls = "px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap cursor-pointer select-none hover:bg-slate-700 transition-colors";
  const thFixed = "px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap";

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
              <Users className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">All Recruiters</h3>
              <p className="text-xs text-slate-500">{recruiters.length} total</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
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
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800 text-left">
                <th className={thCls} onClick={() => toggleSort("name")}>
                  <span className="flex items-center gap-1.5">Recruiter <SortIcon col="name" /></span>
                </th>
                <th className={thCls} onClick={() => toggleSort("email")}>
                  <span className="flex items-center gap-1.5">Contact <SortIcon col="email" /></span>
                </th>
                <th className={thCls} onClick={() => toggleSort("role")}>
                  <span className="flex items-center gap-1.5">Role <SortIcon col="role" /></span>
                </th>
                <th className={thCls} onClick={() => toggleSort("period")}>
                  <span className="flex items-center gap-1.5">Period <SortIcon col="period" /></span>
                </th>
                <th className={thCls} onClick={() => toggleSort("status")}>
                  <span className="flex items-center gap-1.5">Status <SortIcon col="status" /></span>
                </th>
                <th className={thFixed}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((r) => {
                const active = isActive(r);
                const isResending = resendingId === r.id;
                const name = `${r.firstName} ${r.lastName}`;
                return (
                  <tr key={r.id} className={cn("hover:bg-indigo-50/20 transition-colors", !active && "opacity-80")}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                          active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                        )}>
                          {initials(name)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 whitespace-nowrap">{name}</p>
                          <p className="text-xs text-slate-500 truncate max-w-[140px]">{r.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                      {r.phoneNumber && <p>{r.phoneNumber}</p>}
                      {r.businessNumber && <p className="text-slate-400">{r.businessNumber}</p>}
                      {!r.phoneNumber && !r.businessNumber && <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {r.role ? (
                        <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                          {r.role.name}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                      <p>{fmtDate(r.startDate)}</p>
                      {r.endDate && <p className="text-slate-400">→ {fmtDate(r.endDate)}</p>}
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
                        <button onClick={() => openEdit(r)} title="Edit"
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          disabled={isPending}
                          onClick={() => toggleActive(r.id, active)}
                          title={active ? "Disable" : "Enable"}
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                            active
                              ? "border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                              : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          )}>
                          {active ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                          {active ? "Disable" : "Enable"}
                        </button>
                        <div className="relative group">
                          <button
                            disabled={active || isResending}
                            onClick={() => !active && resendActivation(r.id, r.email)}
                            title={active ? "Already activated" : "Resend activation email"}
                            className={cn(
                              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                              active
                                ? "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                                : "border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                            )}>
                            {isResending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                            {isResending ? "Sending…" : "Resend"}
                          </button>
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
            </tbody>
          </table>
        </div>
        {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
      </div>

      {/* Edit Modal */}
      {editingId && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
                <Pencil className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Edit Recruiter</h2>
                <p className="text-xs text-slate-500">Update recruiter details</p>
              </div>
              <button onClick={closeEdit}
                className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input id="edit-firstName" label="First Name *" value={editForm.firstName} onChange={setField("firstName")} />
                <Input id="edit-lastName" label="Last Name *" value={editForm.lastName} onChange={setField("lastName")} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input id="edit-phone" label="Phone Number" placeholder="+1 555-000-0000" value={editForm.phoneNumber} onChange={setField("phoneNumber")} />
                <Input id="edit-business" label="Business Number" placeholder="Business phone" value={editForm.businessNumber} onChange={setField("businessNumber")} />
              </div>
              <Select id="edit-role" label="Role"
                options={roles.map((rl) => ({ value: rl.id, label: rl.name }))}
                placeholder="Select role" value={editForm.roleId} onChange={setField("roleId")} />
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Start Date</label>
                  <input type="date" value={editForm.startDate} onChange={setField("startDate")}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">End Date</label>
                  <input type="date" value={editForm.endDate} onChange={setField("endDate")}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <Button variant="outline" onClick={closeEdit} disabled={saving}>Cancel</Button>
              <Button onClick={saveEdit} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
