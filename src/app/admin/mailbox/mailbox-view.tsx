"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, KeyRound, Mail, RefreshCw, Unplug, Users2 } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { EmailActivityCards } from "@/components/email-activity";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { EmailActivity } from "@/lib/gmail/activity";
import type { GmailSetup } from "@/lib/gmail/setup";
import { MailClient } from "./mail-client";
import { GmailSetupPanel } from "./gmail-setup";

const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

export function MailboxView({ configured: initialConfigured, setup, activity: initialActivity, banner }: {
  configured: boolean;
  /** Only for admins, who can enter the Google keys */
  setup: GmailSetup | null;
  activity: EmailActivity;
  banner: { type: "success" | "error"; text: string } | null;
}) {
  const { toast, show, hide } = useToast();
  const [activity, setActivity] = useState(initialActivity);
  const [refreshing, setRefreshing] = useState(false);
  // Set when a Gmail call says the token is gone, without waiting for a page reload
  const [lostAccess, setLostAccess] = useState(false);
  const [configured, setConfigured] = useState(initialConfigured);
  const [showSetup, setShowSetup] = useState(false);

  const account = lostAccess ? null : activity.account;
  const needsReconnect = !!activity.account?.lastError?.toLowerCase().includes("reconnect") || lostAccess;

  const refresh = async () => {
    setRefreshing(true);
    const res = await fetch("/api/gmail/stats?refresh=1");
    const data = await res.json();
    setRefreshing(false);
    if (res.ok) setActivity(data);
    else show(data.error ?? "Could not refresh counts", "error");
  };

  const disconnect = async () => {
    if (!confirm("Disconnect your Gmail from GFT Vision? Your past counts are kept.")) return;
    const res = await fetch("/api/gmail/disconnect", { method: "POST" });
    if (!res.ok) return show("Could not disconnect", "error");
    window.location.href = "/admin/mailbox";
  };

  return (
    <>
      <Header title="Mailbox" subtitle={account ? `Connected as ${account.email}` : "Your Gmail inside GFT Vision"} />
      <div className="space-y-5 p-6">

        {banner && (
          <div className={cn(
            "flex items-center gap-2 rounded-xl border px-4 py-3 text-[13px] font-medium",
            banner.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800",
          )}>
            {banner.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {banner.text}
          </div>
        )}

        {setup && configured && (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setShowSetup((v) => !v)}>
              <KeyRound className="h-3.5 w-3.5" /> {showSetup ? "Hide Gmail setup" : "Gmail setup"}
            </Button>
          </div>
        )}

        {setup && (!configured || showSetup) && (
          <GmailSetupPanel
            setup={setup}
            notify={show}
            onSaved={(next) => {
              setConfigured(next.configured);
              if (next.configured) setShowSetup(false);
            }}
          />
        )}

        {!configured ? (
          !setup && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <p className="text-[14px] font-bold text-amber-900">Gmail isn&apos;t set up yet</p>
              <p className="mt-1 text-[13px] text-amber-800">
                An administrator needs to complete the one-time Gmail setup on this page. Once that&apos;s done you can connect your own Gmail here.
              </p>
            </div>
          )
        ) : !account || needsReconnect ? (
          <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50">
              <Mail className="h-7 w-7 text-indigo-600" />
            </div>
            <p className="mt-4 text-[16px] font-bold text-slate-900">
              {needsReconnect ? "Reconnect your Gmail" : "Connect your Gmail"}
            </p>
            <p className="mt-1 max-w-md text-[13px] text-slate-500">
              {needsReconnect
                ? "Google no longer accepts the saved access (it was revoked or expired). Connect again to keep using your mailbox here."
                : "Sign in with your company Google account to read, reply to and manage your email here, and to see how many emails you receive and send."}
            </p>
            <a href="/api/gmail/connect" className="mt-5">
              <Button><Mail className="h-4 w-4" /> {needsReconnect ? "Reconnect Gmail" : "Connect Gmail"}</Button>
            </a>
            <p className="mt-3 text-[11px] text-slate-400">Only you can see your mailbox. You can disconnect at any time.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {account.lastError && (
                <p className="mr-auto flex items-center gap-1.5 text-[12px] text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" /> Last count failed: {account.lastError}
                </p>
              )}
              <Button size="sm" variant="outline" onClick={refresh} disabled={refreshing}>
                <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /> {refreshing ? "Counting…" : "Refresh counts"}
              </Button>
              <Button size="sm" variant="ghost" onClick={disconnect}>
                <Unplug className="h-3.5 w-3.5" /> Disconnect
              </Button>
            </div>
            <EmailActivityCards counts={activity.counts} connected lastSyncAt={account.lastSyncAt} />
            <MailClient ownEmail={account.email} onLostAccess={() => setLostAccess(true)} notify={show} />
          </>
        )}

        {/* ── Admins: everyone's counts ── */}
        {activity.team && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
                <Users2 className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-slate-900">Team Email Activity</p>
                <p className="text-[11px] text-slate-400">Emails received and sent in each person&apos;s Gmail. Updated about every 15 minutes.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-slate-800">
                  <tr>
                    <th rowSpan={2} className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-300">Name</th>
                    <th rowSpan={2} className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-300">Gmail</th>
                    <th colSpan={3} className="border-l border-slate-700 px-4 pt-2 text-center text-[10px] font-semibold uppercase tracking-wider text-sky-300">Received</th>
                    <th colSpan={3} className="border-l border-slate-700 px-4 pt-2 text-center text-[10px] font-semibold uppercase tracking-wider text-emerald-300">Sent</th>
                    <th rowSpan={2} className="border-l border-slate-700 px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-300">Updated</th>
                  </tr>
                  <tr>
                    {["Today", "Week", "Month", "Today", "Week", "Month"].map((h, i) => (
                      <th key={i} className={cn("px-3 pb-2 pt-1 text-right text-[10px] font-medium text-slate-400", i % 3 === 0 && "border-l border-slate-700")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activity.team.map((t) => (
                    <tr key={t.userId} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <p className="font-semibold text-slate-800">{t.name}</p>
                        <p className="text-[10.5px] text-slate-400">{t.roleName ?? "Super Admin"}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        {t.account ? (
                          <span className={cn("text-[11.5px]", t.account.lastError ? "text-amber-700" : "text-slate-600")} title={t.account.lastError ?? undefined}>
                            {t.account.email}{t.account.lastError && " ⚠"}
                          </span>
                        ) : (
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] text-slate-500">Not connected</span>
                        )}
                      </td>
                      {[t.counts.received, t.counts.sent].flatMap((c, gi) =>
                        [c.today, c.week, c.month].map((v, i) => (
                          <td key={`${gi}-${i}`} className={cn("px-3 py-2.5 text-right tabular-nums", i === 0 && "border-l border-slate-100", v ? "font-semibold text-slate-800" : "text-slate-300")}>
                            {v}
                          </td>
                        )),
                      )}
                      <td className="whitespace-nowrap border-l border-slate-100 px-4 py-2.5 text-slate-400">{fmtTime(t.account?.lastSyncAt ?? null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </>
  );
}
