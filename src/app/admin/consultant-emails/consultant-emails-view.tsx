"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, CheckCircle2, ExternalLink, Eye, EyeOff, KeyRound, Link2, Loader2, MailPlus, RefreshCw, Search, ShieldCheck, Unlink, X,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { APP_TZ } from "@/lib/tz";
import type { ConsultantMailboxRow } from "@/lib/consultant-mail/data";

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: APP_TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

type Filter = "all" | "connected" | "not";

export function ConsultantEmailsView({ rows, manager, result }: {
  rows: ConsultantMailboxRow[];
  manager: boolean;
  /** Back from an older Google sign-in connection: connected / denied / error */
  result: { kind: string; message: string | null; email: string | null; name: string | null } | null;
}) {
  const router = useRouter();
  const { toast, show, hide } = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<ConsultantMailboxRow | null>(null);

  const reported = useRef(false);
  useEffect(() => {
    if (!result || reported.current) return;
    reported.current = true;
    if (result.kind === "connected") show(`Connected ${result.email ?? "Gmail"}${result.name ? ` for ${result.name}` : ""}`, "success");
    else if (result.kind === "denied") show("Access wasn't allowed in Google, so nothing was connected", "error");
    else show(result.message ?? "Could not connect Gmail", "error");
    router.replace("/admin/consultant-emails");
  }, [result, router, show]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "connected" && !r.mailbox) return false;
      if (filter === "not" && r.mailbox) return false;
      return !q || [r.name, r.technology, r.marketingEmail, r.personalEmail, r.mailbox?.email, r.recruiterName].some((f) => f?.toLowerCase().includes(q));
    });
  }, [rows, query, filter]);

  const disconnect = async (r: ConsultantMailboxRow) => {
    if (!window.confirm(`Disconnect ${r.mailbox?.email} from ${r.name}? The app will stop reading and sending from it.`)) return;
    setBusy(r.id);
    const res = await fetch(`/api/consultant-emails/${r.id}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) return show("Could not disconnect", "error");
    show(`Disconnected ${r.name}'s Gmail`, "success");
    router.refresh();
  };

  const connected = rows.filter((r) => r.mailbox && !r.mailbox.lastError).length;
  const needAttention = rows.filter((r) => r.mailbox?.lastError).length;

  return (
    <>
      <Header title="Consultant Email Configuration" subtitle={manager ? "Every consultant's Gmail, connected with read and send access" : "Connect the Gmail you market each of your consultants from"} />
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-5 py-3 text-[12.5px] text-slate-600">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
          <p>
            Click <b>Connect Gmail</b>, then enter the consultant&apos;s Gmail address and a <b>Google App Password</b> (16 letters, made once in their Google account; the steps are in the popup).
            The app can then <b>read</b> the inbox (vendor requirements go to Vendor Requirements) and <b>send</b> from it. The real Gmail password is never asked for or stored.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Consultants", value: rows.length, color: "text-slate-800" },
            { label: "Connected", value: connected, color: "text-emerald-700" },
            { label: "Need reconnect", value: needAttention, color: needAttention ? "text-rose-600" : "text-slate-400" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{s.label}</p>
              <p className={cn("mt-1 text-2xl font-bold tabular-nums", s.color)}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search consultant, email, technology…"
              className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[13px] shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
          </div>
          <div className="flex gap-0.5 rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
            {([["all", "All"], ["connected", "Connected"], ["not", "Not connected"]] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setFilter(id)}
                className={cn("rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition", filter === id ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-slate-800">
                <tr>
                  {["Consultant", "Marketing email", "Connected Gmail", "Status", ...(manager ? ["Recruiter"] : []), ""].map((h, i) => (
                    <th key={i} className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-300">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.length === 0 && (
                  <tr><td colSpan={manager ? 6 : 5} className="px-4 py-12 text-center text-slate-400">
                    {rows.length === 0 ? "No consultants are assigned to you yet." : "No consultants match."}
                  </td></tr>
                )}
                {shown.map((r) => {
                  const mismatch = r.mailbox && r.marketingEmail && r.mailbox.email.toLowerCase() !== r.marketingEmail.toLowerCase();
                  return (
                    <tr key={r.id} className="align-top hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{r.name}</p>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {r.technology && <span className="rounded bg-indigo-50 px-1.5 text-[10.5px] font-semibold text-indigo-700">{r.technology}</span>}
                          {r.status && <span className="rounded bg-slate-100 px-1.5 text-[10.5px] text-slate-500">{r.status}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {r.marketingEmail ?? <span className="text-slate-400">Not set</span>}
                        {!r.marketingEmail && r.personalEmail && <p className="text-[11px] text-slate-400">Personal: {r.personalEmail}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {r.mailbox ? (
                          <>
                            <p className="font-medium text-slate-800">{r.mailbox.email}</p>
                            <p className="text-[11px] text-slate-400">
                              Connected {fmtWhen(r.mailbox.connectedAt)}{r.mailbox.connectedBy ? ` by ${r.mailbox.connectedBy}` : ""}
                            </p>
                            {mismatch && <p className="text-[11px] font-medium text-amber-700">Not the marketing email on file</p>}
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {!r.mailbox ? (
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">Not connected</span>
                        ) : r.mailbox.lastError ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700" title={r.mailbox.lastError}>
                            <AlertTriangle className="h-3 w-3" /> Reconnect needed
                          </span>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" /> Read &amp; send
                            </span>
                            {r.mailbox.scannedAt && <p className="mt-1 text-[11px] text-slate-400">Inbox read {fmtWhen(r.mailbox.scannedAt)}</p>}
                          </>
                        )}
                      </td>
                      {manager && <td className="whitespace-nowrap px-4 py-3 text-slate-600">{r.recruiterName ?? "—"}</td>}
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant={r.mailbox && !r.mailbox.lastError ? "outline" : "default"} onClick={() => setConnecting(r)}>
                            {r.mailbox ? <RefreshCw className="h-3.5 w-3.5" /> : <MailPlus className="h-3.5 w-3.5" />}
                            {r.mailbox ? "Reconnect" : "Connect Gmail"}
                          </Button>
                          {r.mailbox && (
                            <Button size="sm" variant="ghost" onClick={() => disconnect(r)} disabled={busy === r.id} title="Disconnect">
                              {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-[11.5px] text-slate-400">
          <Link2 className="h-3.5 w-3.5" /> App Passwords are stored encrypted and never shown again. To cut access, disconnect here or delete the App Password in the consultant&apos;s Google account.
        </p>
      </div>

      {connecting && (
        <ConnectDialog
          row={connecting}
          onClose={() => setConnecting(null)}
          onConnected={(email) => {
            show(`Connected ${email} for ${connecting.name}: read and send`, "success");
            setConnecting(null);
            router.refresh();
          }}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </>
  );
}

function ConnectDialog({ row, onClose, onConnected }: { row: ConsultantMailboxRow; onClose: () => void; onConnected: (email: string) => void }) {
  const [email, setEmail] = useState(row.mailbox?.email ?? row.marketingEmail ?? "");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const letters = password.replace(/\s+/g, "").length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch(`/api/consultant-emails/${row.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, appPassword: password }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(d.error ?? "Could not connect");
    onConnected(d.email ?? email);
  };

  const field = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-6">
      <div className="absolute inset-0" onClick={() => !saving && onClose()} aria-hidden="true" />
      <form onSubmit={save} className="relative flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-slate-800 px-5 py-3">
          <div>
            <h2 className="text-[14px] font-semibold text-white">Connect {row.name}&apos;s Gmail</h2>
            <p className="text-[11px] text-slate-400">Read and send access with a Google App Password</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="text-slate-300 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-[12.5px] text-slate-600">
            <p className="mb-1.5 flex items-center gap-1.5 font-semibold text-slate-800"><KeyRound className="h-4 w-4 text-indigo-600" /> Get the App Password (once per consultant)</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Sign in to the consultant&apos;s Gmail in your browser.</li>
              <li>
                Turn on <b>2-Step Verification</b>:{" "}
                <a href="https://myaccount.google.com/signinoptions/twosv" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-indigo-600 hover:underline">
                  open <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                Open{" "}
                <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-indigo-600 hover:underline">
                  App passwords <ExternalLink className="h-3 w-3" />
                </a>
                , type the name <b>GFT Vision</b> and click <b>Create</b>.
              </li>
              <li>Copy the 16-letter password Google shows and paste it below.</li>
            </ol>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Consultant&apos;s Gmail address</span>
            <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@gmail.com" className={field} autoComplete="off" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">App Password</span>
            <div className="relative">
              <input
                type={reveal ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="abcd efgh ijkl mnop"
                className={cn(field, "pr-10 font-mono tracking-wider")}
                autoComplete="new-password"
                spellCheck={false}
              />
              <button type="button" onClick={() => setReveal((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700" aria-label={reveal ? "Hide" : "Show"}>
                {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <span className={cn("text-[11px]", letters === 16 ? "text-emerald-600" : "text-slate-400")}>
              {letters}/16 letters{letters > 0 && letters !== 16 ? " (this isn't the normal Gmail password)" : ""}
            </span>
          </label>

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving || !email.trim() || letters !== 16}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} {saving ? "Checking with Google…" : "Connect"}
          </Button>
        </div>
      </form>
    </div>
  );
}
