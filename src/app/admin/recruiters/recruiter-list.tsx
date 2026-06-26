"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Toast, useToast } from "@/components/ui/toast";
import { Users, ToggleLeft, ToggleRight, Mail, Loader2, Pencil, X } from "lucide-react";
import type { User, Role } from "@/generated/prisma/client";

type RecruiterUser = User & { role: Role | null };

interface EditForm {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  businessNumber: string;
  roleId: string;
  startDate: string;
  endDate: string;
}

function toDateInput(d: Date | string | null): string {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

export function RecruiterList({
  recruiters,
  roles,
}: {
  recruiters: RecruiterUser[];
  roles: Role[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
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

  const openEdit = (r: RecruiterUser) => {
    setEditingId(r.id);
    setEditForm({
      firstName: r.firstName,
      lastName: r.lastName,
      phoneNumber: r.phoneNumber ?? "",
      businessNumber: r.businessNumber ?? "",
      roleId: r.roleId ?? "",
      startDate: toDateInput(r.startDate),
      endDate: toDateInput(r.endDate),
    });
  };

  const closeEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const saveEdit = async () => {
    if (!editingId || !editForm) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/recruiters/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          phoneNumber: editForm.phoneNumber || null,
          businessNumber: editForm.businessNumber || null,
          roleId: editForm.roleId || null,
          startDate: editForm.startDate || null,
          endDate: editForm.endDate || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to update recruiter");
      show("Recruiter updated successfully", "success");
      closeEdit();
      router.refresh();
    } catch (err: unknown) {
      show(err instanceof Error ? err.message : "Update failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const setField = (field: keyof EditForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setEditForm((prev) => prev ? { ...prev, [field]: e.target.value } : prev);

  const fmt = (d: Date | string | null) =>
    d ? new Date(d).toLocaleDateString("en-US", { dateStyle: "medium" }) : "—";

  return (
    <>
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

                      {/* Actions: Edit + Toggle + Resend Email */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(r)}
                            title="Edit recruiter"
                            className="text-slate-600 border-slate-200 hover:bg-slate-50"
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>

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

      {/* Edit Modal */}
      {editingId && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">Edit Recruiter</h2>
              <button
                onClick={closeEdit}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  id="edit-firstName"
                  label="First Name *"
                  value={editForm.firstName}
                  onChange={setField("firstName")}
                />
                <Input
                  id="edit-lastName"
                  label="Last Name *"
                  value={editForm.lastName}
                  onChange={setField("lastName")}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  id="edit-phone"
                  label="Phone Number"
                  placeholder="+1 555-000-0000"
                  value={editForm.phoneNumber}
                  onChange={setField("phoneNumber")}
                />
                <Input
                  id="edit-business"
                  label="Business Number"
                  placeholder="Business phone"
                  value={editForm.businessNumber}
                  onChange={setField("businessNumber")}
                />
              </div>
              <Select
                id="edit-role"
                label="Role"
                options={roles.map((rl) => ({ value: rl.id, label: rl.name }))}
                placeholder="Select role"
                value={editForm.roleId}
                onChange={setField("roleId")}
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Start Date</label>
                  <input
                    type="date"
                    value={editForm.startDate}
                    onChange={setField("startDate")}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">End Date</label>
                  <input
                    type="date"
                    value={editForm.endDate}
                    onChange={setField("endDate")}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <Button variant="outline" onClick={closeEdit} disabled={saving}>
                Cancel
              </Button>
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
