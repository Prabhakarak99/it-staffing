"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gift, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BONUS_REASONS, type BonusReason } from "@/lib/appreciation/bonus";

export interface BonusOptions {
  employees: { id: string; name: string; role: string | null }[];
  consultants: { id: string; name: string; technology: string | null }[];
}

const inputCls = "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";
const labelCls = "mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-slate-500";

/** Super Admin: the "Additional Bonus" button and its popup */
export function AdditionalBonusButton({ options }: { options: BonusOptions }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState<BonusReason | "">("");
  const [otherReason, setOtherReason] = useState("");
  const [consultantId, setConsultantId] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setUserId(""); setReason(""); setOtherReason(""); setConsultantId(""); setAmount(""); setError(null);
  };

  const ready = !!userId && !!reason && Number(amount) > 0 && (reason !== "other" || !!otherReason.trim()) && (reason !== "placement" || !!consultantId);

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/appreciation/bonuses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, reason, otherReason, consultantId: reason === "placement" ? consultantId : null, amount }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(d.error ?? "Could not add the bonus");
    close();
    router.refresh();
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}><Gift className="h-4 w-4" /> Additional Bonus</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-6" onClick={close}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-slate-800 px-5 py-3">
              <h2 className="text-[14px] font-semibold text-white">Additional Bonus</h2>
              <button type="button" onClick={close} className="text-slate-300 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3 p-5">
              <label className="block">
                <span className={labelCls}>Employee who gets the bonus</span>
                <select value={userId} onChange={(e) => setUserId(e.target.value)} className={inputCls} autoFocus>
                  <option value="">Select…</option>
                  {options.employees.map((u) => <option key={u.id} value={u.id}>{u.name}{u.role ? ` (${u.role})` : ""}</option>)}
                </select>
              </label>
              <label className="block">
                <span className={labelCls}>Incentive reason</span>
                <select value={reason} onChange={(e) => setReason(e.target.value as BonusReason | "")} className={inputCls}>
                  <option value="">Select…</option>
                  {BONUS_REASONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </label>
              {reason === "placement" && (
                <label className="block">
                  <span className={labelCls}>Consultant placed</span>
                  <select value={consultantId} onChange={(e) => setConsultantId(e.target.value)} className={inputCls}>
                    <option value="">Select…</option>
                    {options.consultants.map((c) => <option key={c.id} value={c.id}>{c.name}{c.technology ? ` · ${c.technology}` : ""}</option>)}
                  </select>
                </label>
              )}
              {reason === "other" && (
                <label className="block">
                  <span className={labelCls}>What is it for?</span>
                  <input value={otherReason} onChange={(e) => setOtherReason(e.target.value)} maxLength={200} placeholder="e.g. Festival bonus" className={inputCls} />
                </label>
              )}
              <label className="block">
                <span className={labelCls}>Amount (₹)</span>
                <input type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 5000" className={inputCls} />
              </label>
              {error && <p className="text-[12px] font-medium text-rose-600">{error}</p>}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <Button variant="ghost" onClick={close}>Cancel</Button>
              <Button onClick={save} disabled={saving || !ready}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />} Add Bonus
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Super Admin: remove a bonus added by mistake */
export function DeleteBonusButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    if (!window.confirm(`Remove the bonus for ${label}?`)) return;
    setBusy(true);
    const res = await fetch(`/api/appreciation/bonuses/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return window.alert("Could not remove the bonus");
    router.refresh();
  };
  return (
    <button type="button" title="Remove" aria-label="Remove" onClick={remove} disabled={busy} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
    </button>
  );
}
