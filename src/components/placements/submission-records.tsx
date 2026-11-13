"use client";

import { useMemo, useState } from "react";
import { Loader2, PenLine, Save, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ConfirmationRow, SubmissionLookup } from "@/lib/profit-sharing/data";

const fmtDay = (key: string | null) =>
  key ? new Date(`${key}T00:00:00.000Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }) : "—";

const inputCls = "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500";
const labelCls = "mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-slate-500";

/** The form: a loaded submission plus what the person types */
interface Draft {
  /** Set when editing an existing record */
  id: string | null;
  lookup: SubmissionLookup;
  interviewRefId: string;
  clientName: string;
  implementationName: string;
  vendorCompany: string;
  rate: string;
  billRate: string;
  confirmationDate: string;
  startDate: string;
  endDate: string;
}

/**
 * Records entered by submission id (Profit Sharing → Confirmations, Incentives → Placements): type the
 * id, the submission's details load, add the dates, save. The list below can be searched and edited.
 */
export function SubmissionRecords({ noun, apiBase, lookupUrl, initialRows, today, withBillRate, showRecruiter, notify }: {
  noun: "confirmation" | "placement";
  /** Collection endpoint: GET list, POST create, /:id PATCH and DELETE (each returns the new list) */
  apiBase: string;
  lookupUrl: string;
  initialRows: ConfirmationRow[];
  today: string;
  /** Incentives: a numeric bill rate ($/hr) the calculation runs on */
  withBillRate?: boolean;
  /** Show whose placement each row is */
  showRecruiter?: boolean;
  notify: (message: string, type?: "success" | "error") => void;
}) {
  const [rows, setRows] = useState(initialRows);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [query, setQuery] = useState("");
  const Noun = noun[0].toUpperCase() + noun.slice(1);

  const lookup = async (submissionCode: string) => {
    const res = await fetch(`${lookupUrl}?submissionId=${encodeURIComponent(submissionCode)}`, { cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error ?? "Could not load the submission");
    return d as SubmissionLookup;
  };

  /** Load by the typed submission id: a new record, or the existing one for that submission */
  const load = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const found = await lookup(code);
      const existing = rows.find((r) => r.id === found.existingId) ?? null;
      setDraft(toDraft(found, existing, today));
      if (existing) notify(`${found.submissionCode} already has a ${noun}. You can change it here.`, "success");
    } catch (err) {
      setDraft(null);
      notify(err instanceof Error ? err.message : "Could not load the submission", "error");
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
      notify(err instanceof Error ? err.message : "Could not load the submission", "error");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const res = await fetch(draft.id ? `${apiBase}/${draft.id}` : apiBase, {
      method: draft.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submissionRefId: draft.lookup.submissionRefId,
        interviewRefId: draft.interviewRefId || null,
        clientName: draft.clientName,
        implementationName: draft.implementationName,
        vendorCompany: draft.vendorCompany,
        rate: draft.rate,
        ...(withBillRate ? { billRate: draft.billRate.trim() || null } : {}),
        confirmationDate: draft.confirmationDate,
        startDate: draft.startDate || null,
        endDate: draft.endDate || null,
      }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return notify(d.error ?? `Could not save the ${noun}`, "error");
    setRows(d);
    notify(draft.id ? `${Noun} updated` : `${Noun} saved for ${draft.lookup.consultantName}`, "success");
    setDraft(null);
    setCode("");
  };

  const remove = async (row: ConfirmationRow) => {
    if (!window.confirm(`Delete the ${noun} for ${row.consultantName} (${row.submissionCode})?`)) return;
    const res = await fetch(`${apiBase}/${row.id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return notify(d.error ?? "Could not delete", "error");
    setRows(d);
    if (draft?.id === row.id) setDraft(null);
    notify(`${Noun} deleted`, "success");
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.submissionCode, r.interviewCode, r.consultantName, r.clientName, r.implementationName, r.vendorCompany, r.rate, r.recruiterName].some((f) => f?.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const th = "whitespace-nowrap px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-300";
  const headers = [
    "Submission ID", "Interview ID", "Consultant", ...(showRecruiter ? ["Recruiter"] : []), "Client", "Implementation", "Vendor",
    "Rate", ...(withBillRate ? ["Bill rate"] : []), "Confirmation date", "Start date", "End date", "",
  ];

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-[14px] font-bold text-slate-800">{draft?.id ? `Edit ${noun}` : `Add a ${noun}`}</h2>
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
              <div className={cn("grid gap-3", withBillRate ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3")}>
                {withBillRate && (
                  <label>
                    <span className={labelCls}>Bill rate ($ per hour) *</span>
                    <input type="number" min="1" step="0.01" value={draft.billRate} onChange={(e) => set("billRate", e.target.value)} placeholder="e.g. 70" className={inputCls} />
                  </label>
                )}
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
              {withBillRate && (
                <p className="text-[11.5px] text-slate-400">The incentive is worked out from the bill rate and the start date, so both are needed for the Calculations page. Leave the end date empty while the project is running.</p>
              )}
              <div className="flex justify-end">
                <Button onClick={save} disabled={saving || !draft.confirmationDate}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {draft.id ? "Save changes" : `Save ${noun}`}
                </Button>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
          <h2 className="text-[14px] font-bold text-slate-800">{Noun}s</h2>
          <span className="rounded-full bg-slate-100 px-2 text-[11px] font-bold text-slate-600">{rows.length}</span>
          <div className="relative ml-auto w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search consultant, client, vendor…" className={cn(inputCls, "pl-9")} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-slate-800">
              <tr>{headers.map((h, i) => <th key={i} className={th}>{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.length === 0 && (
                <tr><td colSpan={headers.length} className="px-4 py-12 text-center text-slate-400">
                  {rows.length === 0 ? `No ${noun}s yet. Enter a submission id above to add the first one.` : `No ${noun}s match.`}
                </td></tr>
              )}
              {shown.map((r) => (
                <tr key={r.id} className={cn("hover:bg-slate-50", draft?.id === r.id && "bg-indigo-50/50")}>
                  <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-indigo-700">{r.submissionCode}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{r.interviewCode ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-slate-800">{r.consultantName}</td>
                  {showRecruiter && <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{r.recruiterName || "—"}</td>}
                  <td className="px-4 py-2.5 text-slate-600">{r.clientName ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.implementationName ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.vendorCompany ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{r.rate ?? "—"}</td>
                  {withBillRate && (
                    <td className={cn("whitespace-nowrap px-4 py-2.5 tabular-nums", r.billRate ? "font-semibold text-slate-800" : "text-amber-600")}>{r.billRate ? `$${r.billRate}/hr` : "Missing"}</td>
                  )}
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
  );
}

/** Form values: what's saved on the record when editing, else what the submission has */
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
    billRate: String((existing ? existing.billRate : lookup.rateNumber) ?? ""),
    confirmationDate: existing?.confirmationDate ?? today,
    startDate: existing?.startDate ?? "",
    endDate: existing?.endDate ?? "",
  };
}
