"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, Link2, Loader2, MailPlus, RefreshCw, Search, ShieldCheck, Unlink } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { APP_TZ } from "@/lib/tz";
import type { ConsultantMailboxRow } from "@/lib/consultant-mail/data";

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: APP_TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

type Filter = "all" | "connected" | "not";

export function ConsultantEmailsView({ rows, manager, gmailReady, result }: {
  rows: ConsultantMailboxRow[];
  manager: boolean;
  gmailReady: boolean;
  /** Back from Google: connected / denied / error */
  result: { kind: string; message: string | null; email: string | null; name: string | null } | null;
}) {
  const router = useRouter();
  const { toast, show, hide } = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);

  // Show how the Google sign-in went, then clean the address bar
  const reported = useRef(false);
  useEffect(() => {
    if (!result || reported.current) return;
    reported.current = true;
    if (result.kind === "connected") show(`Connected ${result.email ?? "Gmail"}${result.name ? ` for ${result.name}` : ""} with read and send access`, "success");
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
        {!gmailReady ? (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-[12.5px] text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p>Gmail isn&apos;t set up for the app yet. An admin needs to finish the Google setup in <Link href="/admin/mailbox" className="font-semibold underline">Mailbox</Link> first.</p>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-5 py-3 text-[12.5px] text-slate-600">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
            <div className="space-y-1">
              <p>
                Click <b>Connect Gmail</b> and sign in to Google <b>as the consultant&apos;s Gmail</b> (the marketing address), then allow access.
                The app gets <b>read and send</b> access: it reads vendor requirements from that inbox into Vendor Requirements and can send from it. It can&apos;t permanently delete mail.
              </p>
              <p className="flex items-center gap-1 text-[11.5px] text-slate-500">
                <Info className="h-3.5 w-3.5" /> If Google opens your own account, choose &quot;Use another account&quot;, or copy the link into a private window.
              </p>
            </div>
          </div>
        )}

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
                          {gmailReady && (
                            // A full page visit: Google's sign-in can't open in a fetch
                            <a
                              href={`/api/consultant-emails/${r.id}/connect`}
                              className={cn(buttonVariants({ size: "sm", variant: r.mailbox && !r.mailbox.lastError ? "outline" : "default" }), "inline-flex items-center gap-1.5")}
                            >
                              {r.mailbox ? <RefreshCw className="h-3.5 w-3.5" /> : <MailPlus className="h-3.5 w-3.5" />}
                              {r.mailbox ? "Reconnect" : "Connect Gmail"}
                            </a>
                          )}
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
          <Link2 className="h-3.5 w-3.5" /> Tokens are stored encrypted and never shown in the browser. Disconnecting also revokes the access at Google.
        </p>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </>
  );
}
