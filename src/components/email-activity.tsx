import Link from "next/link";
import { Inbox, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmailCounts } from "@/lib/gmail/stats";

/** Received / Sent × Today / This Week / This Month — used on the Mailbox page and the recruiter dashboard */
export function EmailActivityCards({ counts, connected, lastSyncAt, compact }: {
  counts: EmailCounts;
  connected: boolean;
  lastSyncAt: string | null;
  compact?: boolean;
}) {
  const rows = [
    { label: "Emails Received", icon: Inbox, values: counts.received, color: "text-sky-700", bg: "bg-sky-50", iconColor: "text-sky-600" },
    { label: "Emails Sent", icon: Send, values: counts.sent, color: "text-emerald-700", bg: "bg-emerald-50", iconColor: "text-emerald-600" },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
        <p className="text-[13px] font-bold text-slate-900">Email Activity</p>
        {connected ? (
          <p className="text-[11px] text-slate-400">
            {lastSyncAt ? `Updated ${new Date(lastSyncAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "Counting…"}
          </p>
        ) : (
          <Link href="/admin/mailbox" className="text-[12px] font-semibold text-indigo-600 hover:underline">
            Connect Gmail to see your counts →
          </Link>
        )}
      </div>
      <div className={cn("grid gap-px bg-slate-100 sm:grid-cols-2", !connected && "opacity-50")}>
        {rows.map(({ label, icon: Icon, values, color, bg, iconColor }) => (
          <div key={label} className={cn("flex items-center gap-4 bg-white px-5", compact ? "py-3" : "py-4")}>
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", bg)}>
              <Icon className={cn("h-5 w-5", iconColor)} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {([["Today", values.today], ["This Week", values.week], ["This Month", values.month]] as const).map(([k, v]) => (
                  <div key={k}>
                    <p className={cn("text-[20px] font-bold tabular-nums leading-none", color)}>{v}</p>
                    <p className="mt-0.5 text-[10.5px] text-slate-400">{k}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
