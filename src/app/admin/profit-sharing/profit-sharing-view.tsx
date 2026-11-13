"use client";

import { useMemo, useState } from "react";
import { Calculator, CheckCircle2, Loader2, PenLine, Save, Search, Trash2, X } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { ConfirmationRow, SubmissionLookup } from "@/lib/profit-sharing/data";

type Tab = "confirmations" | "calculator";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "confirmations", label: "Confirmations", icon: CheckCircle2 },
  { id: "calculator", label: "Profit Share Calculator", icon: Calculator },
];

const fmtDay = (key: string | null) =>
  key ? new Date(`${key}T00:00:00.000Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }) : "—";

const inputCls = "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500";
const labelCls = "mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-slate-500";

/** The form: a loaded submission plus what the person types */
interface Draft {
  /** Set when editing an existing confirmation */
  id: string | null;
  lookup: SubmissionLookup;
  interviewRefId: string;
  clientName: string;
  implementationName: string;
  vendorCompany: string;
  rate: string;
  confirmationDate: string;
  startDate: string;
  endDate: string;
}

export function ProfitSharingView({ initialTab, initialRows, today }: { initialTab: Tab; initialRows: ConfirmationRow[]; today: string }) {
  const { toast, show, hide } = useToast();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [rows, setRows] = useState(initialRows);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [query, setQuery] = useState("");

  const switchTab = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", `/admin/profit-sharing?tab=${t}`);
  };

  const lookup = async (submissionCode: string) => {
    const res = await fetch(`/api/profit-sharing/lookup?submissionId=${encodeURIComponent(submissionCode)}`, { cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error ?? "Could not load the submission");
    return d as SubmissionLookup;
  };

  /** Load by the typed submission id: a new confirmation, or the existing one for that submission */
  const load = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const found = await lookup(code);
      const existing = rows.find((r) => r.id === found.existingId) ?? null;
      setDraft(toDraft(found, existing, today));
      if (existing) show(`${found.submissionCode} already has a confirmation. You can change it here.`, "success");
    } catch (err) {
      setDraft(null);
      show(err instanceof Error ? err.message : "Could not load the submission", "error");
    } finally {
      setLoading(false);
    }
  };

  const edit = async (row: ConfirmationRow) => {
    setCode(row.submissionCode);
    setLoading(true);
    try {
      setDraft(toDraft(await lookup(row.submissionCode), row, today));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not load the submission", "error");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const res = await fetch(draft.id ? `/api/profit-sharing/confirmations/${draft.id}` : "/api/profit-sharing/confirmations", {
      method: draft.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submissionRefId: draft.lookup.submissionRefId,
        interviewRefId: draft.interviewRefId || null,
        clientName: draft.clientName,
        implementationName: draft.implementationName,
        vendorCompany: draft.vendorCompany,
        rate: draft.rate,
        confirmationDate: draft.confirmationDate,
        startDate: draft.startDate || null,
        endDate: draft.endDate || null,
      }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return show(d.error ?? "Could not save the confirmation", "error");
    setRows(d);
    show(draft.id ? "Confirmation updated" : `Confirmation saved for ${draft.lookup.consultantName}`, "success");
    setDraft(null);
    setCode("");
  };

  const remove = async (row: ConfirmationRow) => {
    if (!window.confirm(`Delete the confirmation for ${row.consultantName} (${row.submissionCode})?`)) return;
    const res = await fetch(`/api/profit-sharing/confirmations/${row.id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return show(d.error ?? "Could not delete", "error");
    setRows(d);
    if (draft?.id === row.id) setDraft(null);
    show("Confirmation deleted", "success");
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.submissionCode, r.interviewCode, r.consultantName, r.clientName, r.implementationName, r.vendorCompany, r.rate].some((f) => f?.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const th = "whitespace-nowrap px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-300";

  return (
    <>
      <Header title="Profit Sharing" subtitle="Confirmed placements and the profit share calculator" />
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex w-fit gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => switchTab(t.id)}
              className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition", tab === t.id ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100")}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "calculator" ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50"><Calculator className="h-7 w-7 text-indigo-600" /></div>
            <p className="mt-4 text-[16px] font-bold text-slate-900">Profit Share Calculator</p>
            <p className="mt-1 max-w-md text-[13px] text-slate-500">Coming soon. The calculation will be added here and will use the confirmations entered on the Confirmations tab.</p>
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-3">
                <h2 className="text-[14px] font-bold text-slate-800">{draft?.id ? "Edit confirmation" : "Add a confirmation"}</h2>
                <p className="text-[12px] text-slate-500">Enter the submission id. The consultant, client, vendor, rate and interview load from that submission.</p>
              </div>
              <div className="space-y-4 p-5">
                <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); void load(); }}>
                  <label className="w-full max-w-xs">
                    <span className={labelCls}>Submission ID</span>
                    <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. Sub-012" className={inputCls} autoFocus />
                  </label>
                  <Button type="submit" disabled={loading || !code.trim()}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Load
                  </Button>
                  {draft && (
                    <Button type="button" variant="ghost" onClick={() => { setDraft(null); setCode(""); }}><X className="h-4 w-4" /> Clear</Button>
                  )}
                </form>

                {draft && (
                  <>
                    <div className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-2 lg:grid-cols-4">
                      <label>
                        <span className={labelCls}>Interview ID</span>
                        {draft.lookup.interviews.length === 0 ? (
                          <input value="No interview on this submission" disabled className={inputCls} />
                        ) : (
                          <select value={draft.interviewRefId} onChange={(e) => set("interviewRefId", e.target.value)} className={inputCls}>
                            {draft.lookup.interviews.map((i) => (
                              <option key={i.id} value={i.id}>{i.code} · {i.level} · {i.status}</option>
                            ))}
                            <option value="">None</option>
                          </select>
                        )}
                      </label>
                      <label>
                        <span className={labelCls}>Consultant name</span>
                        <input value={draft.lookup.consultantName} disabled className={inputCls} />
                      </label>
                      <label>
                        <span className={labelCls}>Client</span>
                        <input value={draft.clientName} onChange={(e) => set("clientName", e.target.value)} className={inputCls} />
                      </label>
                      <label>
                        <span className={labelCls}>Implementation</span>
                        <input value={draft.implementationName} onChange={(e) => set("implementationName", e.target.value)} className={inputCls} />
                      </label>
                      <label>
                        <span className={labelCls}>Vendor</span>
                        <input value={draft.vendorCompany} onChange={(e) => set("vendorCompany", e.target.value)} className={inputCls} />
                      </label>
                      <label>
                        <span className={labelCls}>Rate</span>
                        <input value={draft.rate} onChange={(e) => set("rate", e.target.value)} placeholder="e.g. $65/hr C2C" className={inputCls} />
                      </label>
                      <label>
                        <span className={labelCls}>Technology</span>
                        <input value={draft.lookup.technology} disabled className={inputCls} />
                      </label>
                      <label>
                        <span className={labelCls}>Recruiter</span>
                        <input value={draft.lookup.recruiterName} disabled className={inputCls} />
                      </label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label>
                        <span className={labelCls}>Confirmation date *</span>
                        <input type="date" value={draft.confirmationDate} onChange={(e) => set("confirmationDate", e.target.value)} className={inputCls} />
                      </label>
                      <label>
                        <span className={labelCls}>Start date</span>
                        <input type="date" value={draft.startDate} onChange={(e) => set("startDate", e.target.value)} className={inputCls} />
                      </label>
                      <label>
                        <span className={labelCls}>End date</span>
                        <input type="date" value={draft.endDate} min={draft.startDate || undefined} onChange={(e) => set("endDate", e.target.value)} className={inputCls} />
                      </label>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={save} disabled={saving || !draft.confirmationDate}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {draft.id ? "Save changes" : "Save confirmation"}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
                <h2 className="text-[14px] font-bold text-slate-800">Confirmations</h2>
                <span className="rounded-full bg-slate-100 px-2 text-[11px] font-bold text-slate-600">{rows.length}</span>
                <div className="relative ml-auto w-full max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search consultant, client, vendor…" className={cn(inputCls, "pl-9")} />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-slate-800">
                    <tr>
                      {["Submission ID", "Interview ID", "Consultant", "Client", "Implementation", "Vendor", "Rate", "Confirmation date", "Start date", "End date", ""].map((h, i) => (
                        <th key={i} className={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {shown.length === 0 && (
                      <tr><td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                        {rows.length === 0 ? "No confirmations yet. Enter a submission id above to add the first one." : "No confirmations match."}
                      </td></tr>
                    )}
                    {shown.map((r) => (
                      <tr key={r.id} className={cn("hover:bg-slate-50", draft?.id === r.id && "bg-indigo-50/50")}>
                        <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-indigo-700">{r.submissionCode}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{r.interviewCode ?? "—"}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-slate-800">{r.consultantName}</td>
                        <td className="px-4 py-2.5 text-slate-600">{r.clientName ?? "—"}</td>
                        <td className="px-4 py-2.5 text-slate-600">{r.implementationName ?? "—"}</td>
                        <td className="px-4 py-2.5 text-slate-600">{r.vendorCompany ?? "—"}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{r.rate ?? "—"}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{fmtDay(r.confirmationDate)}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{fmtDay(r.startDate)}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{fmtDay(r.endDate)}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right">
                          <button type="button" title="Edit" aria-label="Edit" onClick={() => void edit(r)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"><PenLine className="h-3.5 w-3.5" /></button>
                          <button type="button" title="Delete" aria-label="Delete" onClick={() => void remove(r)} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </>
  );
}

/** Form values: what's saved on the confirmation when editing, else what the submission has */
function toDraft(lookup: SubmissionLookup, existing: ConfirmationRow | null, today: string): Draft {
  const savedInterview = existing ? lookup.interviews.find((i) => i.code === existing.interviewCode)?.id ?? "" : null;
  return {
    id: existing?.id ?? null,
    lookup,
    interviewRefId: savedInterview ?? lookup.interviews[0]?.id ?? "",
    clientName: (existing ? existing.clientName : lookup.clientName) ?? "",
    implementationName: (existing ? existing.implementationName : lookup.implementationName) ?? "",
    vendorCompany: (existing ? existing.vendorCompany : lookup.vendorCompany) ?? "",
    rate: (existing ? existing.rate : lookup.rate) ?? "",
    confirmationDate: existing?.confirmationDate ?? today,
    startDate: existing?.startDate ?? "",
    endDate: existing?.endDate ?? "",
  };
}
