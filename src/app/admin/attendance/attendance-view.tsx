"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarCheck, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Download, Loader2, Palmtree, Plus, ShieldCheck, Users2, X,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { fmtDayKey, fmtMonth, shiftMonth, weekday } from "@/lib/attendance/dates";
import type { LeaveBalance } from "@/lib/attendance/leave";
import { isEditableDay } from "@/lib/attendance/cells";
import type { DayCell, DayStatus, MonthSummary, MonthView } from "@/lib/attendance/month";
import type { TeamMonthRow } from "@/lib/attendance/team";

export interface LeaveRow {
  id: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  paidDays: number;
  unpaidDays: number;
  reason: string | null;
  status: string;
  reviewNote: string | null;
  reviewedBy: string | null;
  createdAt: string;
}

export interface ApprovalData {
  attendance: { id: string; day: string; name: string; email: string; markedAt: string; note: string | null }[];
  leave: (LeaveRow & { userId: string; name: string; email: string; available: number })[];
}

type Tab = "my" | "approvals" | "team";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const CELL: Record<DayStatus, { label: string; box: string; badge?: string }> = {
  present: { label: "Present", box: "border-emerald-200 bg-emerald-50", badge: "bg-emerald-500 text-white" },
  absent: { label: "Absent", box: "border-rose-200 bg-rose-50", badge: "bg-rose-500 text-white" },
  pending: { label: "Awaiting approval", box: "border-amber-200 bg-amber-50", badge: "bg-amber-400 text-white" },
  leave: { label: "Paid leave", box: "border-sky-200 bg-sky-50", badge: "bg-sky-500 text-white" },
  unpaid: { label: "Unpaid leave", box: "border-orange-200 bg-orange-50", badge: "bg-orange-500 text-white" },
  "leave-pending": { label: "Leave requested", box: "border-violet-200 bg-violet-50", badge: "bg-violet-400 text-white" },
  weekend: { label: "Weekend", box: "border-slate-100 bg-slate-50" },
  today: { label: "Not marked yet", box: "border-indigo-300 bg-white ring-2 ring-indigo-200" },
  future: { label: "", box: "border-slate-100 bg-white" },
  none: { label: "", box: "border-slate-100 bg-white" },
};

function DayBadge({ status }: { status: DayStatus }) {
  const cls = "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold";
  switch (status) {
    case "present": return <span className={cn(cls, CELL.present.badge)}><Check className="h-4 w-4" /></span>;
    case "absent": return <span className={cn(cls, CELL.absent.badge)}>0</span>;
    case "pending": return <span className={cn(cls, CELL.pending.badge)}><Clock className="h-3.5 w-3.5" /></span>;
    case "leave": return <span className={cn(cls, CELL.leave.badge)}>L</span>;
    case "unpaid": return <span className={cn(cls, CELL.unpaid.badge, "text-[9px]")}>LOP</span>;
    case "leave-pending": return <span className={cn(cls, CELL["leave-pending"].badge)}>L?</span>;
    default: return null;
  }
}

const STATUS_PILL: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};

const range = (l: { startDate: string; endDate: string }) =>
  l.startDate === l.endDate ? fmtDayKey(l.startDate) : `${fmtDayKey(l.startDate)} – ${fmtDayKey(l.endDate)}`;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Weeks Monday → Sunday, padded with nulls on either side */
function weeks(days: DayCell[]) {
  const lead = (weekday(days[0].day) + 6) % 7;
  const cells: (DayCell | null)[] = [...Array(lead).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

export function AttendanceView(props: {
  tab: Tab;
  month: string;
  today: string;
  approver: boolean;
  /** Admin: can switch any day between present and absent */
  canEdit: boolean;
  /** Super Admin has no attendance of their own */
  hasOwnCalendar: boolean;
  canRequestLeave: boolean;
  viewing: { id: string; name: string; email: string } | null;
  monthView: MonthView;
  balance: LeaveBalance;
  leaves: LeaveRow[];
  approvals: ApprovalData | null;
  team: TeamMonthRow[] | null;
}) {
  const { tab, month, approver, viewing, monthView, balance, leaves } = props;
  const router = useRouter();
  const { toast, show, hide } = useToast();
  const [requesting, setRequesting] = useState(false);
  const [openEmployee, setOpenEmployee] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ userId: string; name: string; cell: DayCell } | null>(null);

  /** Admin correction: asks first, then sets the day present or absent */
  const setDay = (userId: string, cell: DayCell) => {
    if (!isEditableDay(cell, props.today)) return;
    const name = props.team?.find((t) => t.userId === userId)?.name ?? (viewing?.id === userId ? viewing.name : "");
    setConfirming({ userId, name, cell });
  };

  const applyDay = async (status: "present" | "absent") => {
    if (!confirming) return;
    const { userId, cell } = confirming;
    setSaving(`${userId}|${cell.day}`);
    const res = await fetch("/api/attendance/set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, day: cell.day, status }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(null);
    if (!res.ok) return show(data.error ?? "Could not change attendance", "error");
    setConfirming(null);
    show(`${confirming.name ? `${confirming.name}: ` : ""}${fmtDayKey(cell.day)} set to ${status}`, "success");
    router.refresh();
  };

  const employee = props.team?.find((t) => t.userId === openEmployee) ?? null;

  const href = (next: { tab?: Tab; month?: string; user?: string | null }) => {
    const p = new URLSearchParams();
    const t = next.tab ?? tab;
    if (t !== "my") p.set("tab", t);
    p.set("month", next.month ?? month);
    const user = next.user === undefined ? viewing?.id : next.user;
    if (user && t === "my") p.set("user", user);
    return `/admin/attendance?${p}`;
  };

  const tabs: { id: Tab; label: string; icon: typeof CalendarDays; count?: number }[] = [
    ...(props.hasOwnCalendar || viewing ? [{ id: "my" as const, label: viewing ? viewing.name : "My Attendance", icon: CalendarDays }] : []),
    ...(approver
      ? [
          { id: "approvals" as const, label: "Approvals", icon: ShieldCheck, count: props.approvals ? props.approvals.attendance.length + props.approvals.leave.length : undefined },
          { id: "team" as const, label: "Team", icon: Users2 },
        ]
      : []),
  ];

  return (
    <>
      <Header title="Attendance" subtitle="Daily attendance, monthly calendar and leave" />
      <div className="space-y-5 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {tabs.map((t) => (
              <Link
                key={t.id}
                href={href({ tab: t.id, user: t.id === "my" ? viewing?.id ?? null : null })}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors",
                  tab === t.id ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100",
                )}
              >
                <t.icon className="h-3.5 w-3.5" /> {t.label}
                {!!t.count && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] text-white">{t.count}</span>}
              </Link>
            ))}
          </div>
          {viewing && (
            <Link href={props.hasOwnCalendar ? href({ tab: "my", user: null }) : href({ tab: "team", user: null })} className="text-[12px] font-semibold text-indigo-600 hover:underline">
              {props.hasOwnCalendar ? "← Back to my attendance" : "← Back to team"}
            </Link>
          )}
          {tab !== "approvals" && (
            <div className="ml-auto flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              <Link href={href({ month: shiftMonth(month, -1) })} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <span className="min-w-[130px] text-center text-[13px] font-bold text-slate-800">{fmtMonth(month)}</span>
              <Link href={href({ month: shiftMonth(month, 1) })} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>

        {tab === "my" && (
          <>
            <LeaveBalanceBar balance={balance} canRequest={props.canRequestLeave} onRequest={() => setRequesting(true)} viewing={viewing} />
            <SummaryCards summary={monthView.summary} />
            <CalendarGrid
              view={monthView}
              today={props.today}
              onEditDay={props.canEdit && viewing ? (cell) => setDay(viewing.id, cell) : undefined}
            />
            <LeaveHistory leaves={leaves} canCancel={props.canRequestLeave} notify={show} onChange={() => router.refresh()} />
          </>
        )}

        {tab === "approvals" && props.approvals && <Approvals data={props.approvals} notify={show} onChange={() => router.refresh()} />}

        {tab === "team" && props.team && (
          <TeamGrid
            team={props.team}
            month={month}
            today={props.today}
            canEdit={props.canEdit}
            onEditDay={setDay}
            onOpen={setOpenEmployee}
          />
        )}
      </div>

      {employee && (
        <EmployeeDialog
          row={employee}
          month={month}
          today={props.today}
          canEdit={props.canEdit}
          saving={saving}
          onEditDay={(cell) => setDay(employee.userId, cell)}
          onClose={() => setOpenEmployee(null)}
        />
      )}
      {confirming && (
        <ConfirmDayDialog
          name={confirming.name}
          cell={confirming.cell}
          saving={!!saving}
          onPick={applyDay}
          onClose={() => setConfirming(null)}
        />
      )}
      {requesting && (
        <LeaveRequestDialog
          today={props.today}
          onClose={() => setRequesting(false)}
          onSaved={() => { setRequesting(false); show("Leave request sent for approval", "success"); router.refresh(); }}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </>
  );
}

/** Admin: confirm a day's change before it's saved */
function ConfirmDayDialog({ name, cell, saving, onPick, onClose }: {
  name: string;
  cell: DayCell;
  saving: boolean;
  onPick: (status: "present" | "absent") => void;
  onClose: () => void;
}) {
  const current = CELL[cell.status].label || "Not marked";
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Change attendance">
      <div className="absolute inset-0" onClick={saving ? undefined : onClose} aria-hidden="true" />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <button onClick={onClose} disabled={saving} className="absolute right-3 top-3 text-slate-400 hover:text-slate-700" aria-label="Cancel">
          <X className="h-4 w-4" />
        </button>
        <p className="text-[15px] font-bold text-slate-900">Change attendance?</p>
        <p className="mt-1 text-[12.5px] text-slate-500">
          {name && <b className="text-slate-700">{name}</b>}{name && " · "}{fmtDayKey(cell.day, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
        <p className="mt-3 text-[12.5px] text-slate-600">
          Currently: <span className={cn("rounded px-1.5 py-0.5 text-[11.5px] font-semibold", CELL[cell.status].badge ?? "bg-slate-100 text-slate-600")}>{current}</span>
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button onClick={() => onPick("present")} disabled={saving || cell.status === "present"} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Mark Present
          </Button>
          <Button onClick={() => onPick("absent")} disabled={saving || cell.status === "absent"} className="bg-rose-600 hover:bg-rose-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Mark Absent
          </Button>
        </div>
        <button onClick={onClose} disabled={saving} className="mt-2 w-full rounded-lg py-1.5 text-[12.5px] font-semibold text-slate-500 hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </div>
  );
}

function LeaveBalanceBar({ balance, canRequest, onRequest, viewing }: {
  balance: LeaveBalance;
  canRequest: boolean;
  onRequest: () => void;
  viewing: { name: string } | null;
}) {
  const items = [
    { label: "Earned", value: balance.accrued, hint: "1 paid leave every month" },
    { label: "Used", value: balance.used },
    { label: "Pending", value: balance.pending, hint: "In requests waiting for approval" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-white px-5 py-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500">
          <Palmtree className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">{viewing ? `${viewing.name}'s paid leave` : "Paid leave available"}</p>
          <p className="text-[26px] font-extrabold leading-none text-slate-900 tabular-nums">{balance.available}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-5 border-l border-sky-100 pl-5">
        {items.map((i) => (
          <div key={i.label} title={i.hint}>
            <p className="text-[18px] font-bold tabular-nums text-slate-800">{i.value}</p>
            <p className="text-[11px] text-slate-500">{i.label}</p>
          </div>
        ))}
      </div>
      <p className="text-[11.5px] text-slate-500">Every employee earns 1 paid leave each month. Leave beyond the balance is unpaid (LOP).</p>
      {canRequest && (
        <Button className="ml-auto" onClick={onRequest}>
          <Plus className="h-4 w-4" /> Request Leave
        </Button>
      )}
    </div>
  );
}

function SummaryCards({ summary }: { summary: MonthSummary }) {
  const cards = [
    { label: "Calendar Days", value: summary.calendarDays, color: "text-slate-800" },
    { label: "Working Days (Mon–Fri)", value: summary.workingDays, color: "text-slate-800" },
    { label: "Present", value: summary.present, color: "text-emerald-600" },
    { label: "Absent", value: summary.absent, color: "text-rose-600" },
    { label: "Paid Leave", value: summary.paidLeave, color: "text-sky-600" },
    { label: "Unpaid Leave", value: summary.unpaidLeave, color: "text-orange-600" },
    { label: "Pending", value: summary.pending, color: "text-amber-600" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className={cn("text-[24px] font-extrabold tabular-nums leading-none", c.color)}>{c.value}</p>
          <p className="mt-1 text-[11px] font-medium text-slate-500">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

function CalendarGrid({ view, today, onEditDay, flat }: {
  view: Pick<MonthView, "month" | "days">;
  today: string;
  onEditDay?: (cell: DayCell) => void;
  /** Inside a dialog: no card chrome */
  flat?: boolean;
}) {
  return (
    <div className={cn(!flat && "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm")}>
      {!flat && (
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
            <CalendarCheck className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-slate-900">{fmtMonth(view.month)}</p>
            <p className="text-[11px] text-slate-400">
              One row per week, Monday to Sunday. India time.{onEditDay ? " Click a day to mark it present or absent (you confirm first)." : ""}
            </p>
          </div>
        </div>
      )}
      <div className={cn("overflow-x-auto", flat ? "py-2" : "p-4")}>
        <div className="grid min-w-[640px] grid-cols-7 gap-2">
          {WEEKDAYS.map((d, i) => (
            <p key={d} className={cn("pb-1 text-center text-[11px] font-semibold uppercase tracking-wide", i >= 5 ? "text-slate-400" : "text-slate-600")}>{d}</p>
          ))}
          {weeks(view.days).flat().map((cell, i) =>
            cell ? (
              <div
                key={cell.day}
                title={onEditDay && isEditableDay(cell, today) ? `${CELL[cell.status].label} · click to change` : CELL[cell.status].label}
                onClick={onEditDay && isEditableDay(cell, today) ? () => onEditDay(cell) : undefined}
                className={cn(
                  "flex h-[78px] flex-col justify-between rounded-xl border p-2",
                  CELL[cell.status].box,
                  onEditDay && isEditableDay(cell, today) && "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md",
                )}
              >
                <div className="flex items-start justify-between">
                  <span className="text-[13px] font-bold text-slate-700">{Number(cell.day.slice(8))}</span>
                  <DayBadge status={cell.status} />
                </div>
                <span className={cn("truncate text-[10px] font-medium", cell.status === "weekend" ? "text-slate-400" : "text-slate-500")}>
                  {cell.sandwich ? "Sandwich" : CELL[cell.status].label}
                </span>
              </div>
            ) : (
              <div key={`pad-${i}`} />
            ),
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-slate-500">
          {(["present", "absent", "pending", "leave", "unpaid", "leave-pending"] as DayStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5"><DayBadge status={s} /> {CELL[s].label}</span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">Sandwich</span>
            Weekend counted because Friday and Monday were both off
          </span>
        </div>
      </div>
    </div>
  );
}

function LeaveHistory({ leaves, canCancel, notify, onChange }: {
  leaves: LeaveRow[];
  canCancel: boolean;
  notify: (m: string, t: "success" | "error") => void;
  onChange: () => void;
}) {
  const cancel = async (id: string) => {
    if (!confirm("Cancel this leave request?")) return;
    const res = await fetch(`/api/leave/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return notify(data.error ?? "Could not cancel", "error");
    notify("Leave request cancelled", "success");
    onChange();
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50">
          <Palmtree className="h-4 w-4 text-sky-600" />
        </div>
        <p className="text-[13px] font-bold text-slate-900">Leave Requests</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead className="bg-slate-800">
            <tr>
              {["Dates", "Days", "Paid / Unpaid", "Reason", "Status", ""].map((h, i) => (
                <th key={i} className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-300">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leaves.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No leave requests yet</td></tr>
            ) : (
              leaves.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-800">{range(l)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{l.totalDays}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                    {l.status === "approved" ? `${l.paidDays} paid${l.unpaidDays ? ` · ${l.unpaidDays} unpaid` : ""}` : "—"}
                  </td>
                  <td className="max-w-[280px] px-4 py-2.5 text-slate-600">
                    <p className="truncate" title={l.reason ?? ""}>{l.reason || "—"}</p>
                    {l.reviewNote && <p className="truncate text-[11px] text-slate-400" title={l.reviewNote}>Note: {l.reviewNote}</p>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span className={cn("rounded-md border px-1.5 py-0.5 text-[11px] font-semibold capitalize", STATUS_PILL[l.status])}>{l.status}</span>
                    {l.reviewedBy && <span className="ml-1.5 text-[11px] text-slate-400">by {l.reviewedBy}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {canCancel && l.status === "pending" && (
                      <button onClick={() => cancel(l.id)} className="text-[12px] font-semibold text-rose-600 hover:underline">Cancel</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface Preview { key: string; totalDays?: number; paid?: number; unpaid?: number; days?: string[]; error?: string }

function LeaveRequestDialog({ today, onClose, onSaved }: { today: string; onClose: () => void; onSaved: () => void }) {
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const key = `${start}|${end}`;
  const loadPreview = (s: string, e: string) => {
    if (!s || !e) return;
    const k = `${s}|${e}`;
    fetch(`/api/leave/preview?start=${s}&end=${e}`)
      .then((r) => r.json())
      .then((d) => setPreview({ key: k, ...d }))
      .catch(() => setPreview({ key: k, error: "Could not check these dates" }));
  };

  const setDates = (s: string, e: string) => {
    const fixedEnd = e < s ? s : e;
    setStart(s);
    setEnd(fixedEnd);
    loadPreview(s, fixedEnd);
  };

  const current = preview?.key === key ? preview : null;
  const sandwich = current?.days?.filter((d) => [0, 6].includes(weekday(d))).length ?? 0;

  const submit = async () => {
    setError("");
    setSaving(true);
    const res = await fetch("/api/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: start, endDate: end, reason }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(data.error ?? "Could not send the request");
    onSaved();
  };

  const input = "h-9 w-full rounded-lg border border-slate-200 px-3 text-[13px] focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between rounded-t-2xl bg-slate-800 px-5 py-3">
          <h2 className="text-[14px] font-semibold text-white">Request Leave</h2>
          <button onClick={onClose} className="text-slate-300 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">From</span>
              <input type="date" value={start} onChange={(e) => setDates(e.target.value, end)} className={input} />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">To</span>
              <input type="date" value={end} min={start} onChange={(e) => setDates(start, e.target.value)} className={input} />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Reason</span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={1000} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" placeholder="e.g. Personal work, sick leave…" />
          </label>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12.5px]">
            {!current ? (
              <button type="button" onClick={() => loadPreview(start, end)} className="font-semibold text-indigo-600 hover:underline">Check how many days this is</button>
            ) : current.error ? (
              <p className="font-medium text-rose-600">{current.error}</p>
            ) : (
              <>
                <p className="font-semibold text-slate-800">{plural(current.totalDays ?? 0, "day")} of leave</p>
                {sandwich > 0 && <p className="text-[11.5px] text-slate-500">Includes {plural(sandwich, "weekend day")} (sandwich rule: Friday and Monday off)</p>}
                <p className="mt-1 text-slate-600">
                  <span className="font-semibold text-sky-700">{current.paid} paid</span>
                  {!!current.unpaid && <> · <span className="font-semibold text-orange-600">{current.unpaid} unpaid (LOP)</span></>}
                  <span className="text-slate-400"> (if approved with today&apos;s balance)</span>
                </p>
              </>
            )}
          </div>

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !reason.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Palmtree className="h-4 w-4" />} Send for Approval
          </Button>
        </div>
      </div>
    </div>
  );
}

function Approvals({ data, notify, onChange }: { data: ApprovalData; notify: (m: string, t: "success" | "error") => void; onChange: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const reviewAttendance = async (ids: string[], action: "approve" | "reject") => {
    if (ids.length === 0) return;
    let note: string | null = null;
    if (action === "reject") {
      note = prompt("Reason for rejecting (optional)");
      if (note === null) return;
    }
    setBusy(`att-${action}`);
    const res = await fetch("/api/attendance/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, action, note }) });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return notify(d.error ?? "Could not update attendance", "error");
    notify(`${plural(d.updated, "attendance")} ${action === "approve" ? "approved" : "rejected"}`, "success");
    setSelected(new Set());
    onChange();
  };

  const reviewLeave = async (id: string, action: "approve" | "reject") => {
    let note: string | null = null;
    if (action === "reject") {
      note = prompt("Reason for rejecting (optional)");
      if (note === null) return;
    }
    setBusy(`leave-${id}`);
    const res = await fetch(`/api/leave/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note }) });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return notify(d.error ?? "Could not update the leave", "error");
    notify(action === "approve" ? `Leave approved (${d.paidDays} paid${d.unpaidDays ? `, ${d.unpaidDays} unpaid` : ""})` : "Leave rejected", "success");
    onChange();
  };

  const allIds = data.attendance.map((a) => a.id);
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50"><CalendarCheck className="h-4 w-4 text-emerald-600" /></div>
          <div className="mr-auto">
            <p className="text-[13px] font-bold text-slate-900">Attendance waiting for approval</p>
            <p className="text-[11px] text-slate-400">{plural(data.attendance.length, "request")}. Your own attendance is approved by another POC / Manager.</p>
          </div>
          <Button size="sm" variant="outline" disabled={!selected.size || !!busy} onClick={() => reviewAttendance([...selected], "reject")}>
            <X className="h-3.5 w-3.5" /> Reject selected
          </Button>
          <Button size="sm" disabled={!selected.size || !!busy} onClick={() => reviewAttendance([...selected], "approve")}>
            {busy === "att-approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve selected ({selected.size})
          </Button>
        </div>
        <div className="max-h-[460px] overflow-auto">
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 bg-slate-800">
              <tr>
                <th className="w-10 px-4 py-2.5">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-indigo-500"
                    checked={allIds.length > 0 && selected.size === allIds.length}
                    onChange={(e) => setSelected(e.target.checked ? new Set(allIds) : new Set())}
                  />
                </th>
                {["Date", "Employee", "Marked at", "Note", ""].map((h, i) => (
                  <th key={i} className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-300">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.attendance.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Nothing waiting. All caught up!</td></tr>
              ) : (
                data.attendance.map((a) => (
                  <tr key={a.id} className={cn("hover:bg-slate-50", selected.has(a.id) && "bg-indigo-50/40")}>
                    <td className="px-4 py-2.5"><input type="checkbox" className="h-3.5 w-3.5 accent-indigo-600" checked={selected.has(a.id)} onChange={() => toggle(a.id)} /></td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-800">{fmtDayKey(a.day)}</td>
                    <td className="px-4 py-2.5"><p className="font-semibold text-slate-800">{a.name}</p><p className="text-[11px] text-slate-400">{a.email}</p></td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">
                      {new Date(a.markedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })} IST
                    </td>
                    <td className="max-w-[260px] truncate px-4 py-2.5 text-slate-500" title={a.note ?? ""}>{a.note || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      <button onClick={() => reviewAttendance([a.id], "reject")} disabled={!!busy} className="mr-3 text-[12px] font-semibold text-rose-600 hover:underline">Reject</button>
                      <button onClick={() => reviewAttendance([a.id], "approve")} disabled={!!busy} className="text-[12px] font-semibold text-emerald-700 hover:underline">Approve</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50"><Palmtree className="h-4 w-4 text-sky-600" /></div>
          <div>
            <p className="text-[13px] font-bold text-slate-900">Leave waiting for approval</p>
            <p className="text-[11px] text-slate-400">Approved days are taken from the employee&apos;s paid leave first; the rest is unpaid (LOP).</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-slate-800">
              <tr>
                {["Employee", "Dates", "Days", "Balance", "Reason", ""].map((h, i) => (
                  <th key={i} className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-300">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.leave.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No leave requests waiting</td></tr>
              ) : (
                data.leave.map((l) => {
                  const paid = Math.min(l.totalDays, l.available);
                  return (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5"><p className="font-semibold text-slate-800">{l.name}</p><p className="text-[11px] text-slate-400">{l.email}</p></td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{range(l)}</td>
                      <td className="px-4 py-2.5 tabular-nums">{l.totalDays}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                        {l.available} available
                        <p className="text-[11px] text-slate-400">→ {paid} paid{l.totalDays - paid ? `, ${l.totalDays - paid} unpaid` : ""}</p>
                      </td>
                      <td className="max-w-[260px] px-4 py-2.5 text-slate-600"><p className="truncate" title={l.reason ?? ""}>{l.reason || "—"}</p></td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right">
                        {busy === `leave-${l.id}` ? (
                          <Loader2 className="ml-auto h-4 w-4 animate-spin text-slate-400" />
                        ) : (
                          <>
                            <button onClick={() => reviewLeave(l.id, "reject")} disabled={!!busy} className="mr-3 text-[12px] font-semibold text-rose-600 hover:underline">Reject</button>
                            <button onClick={() => reviewLeave(l.id, "approve")} disabled={!!busy} className="text-[12px] font-semibold text-emerald-700 hover:underline">Approve</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const TOTALS: { label: string; get: (r: TeamMonthRow) => number; color: string }[] = [
  { label: "Present", get: (r) => r.summary.present, color: "text-emerald-700" },
  { label: "Absent", get: (r) => r.summary.absent, color: "text-rose-600" },
  { label: "Leave", get: (r) => r.summary.paidLeave, color: "text-sky-700" },
  { label: "LOP", get: (r) => r.summary.unpaidLeave, color: "text-orange-600" },
  { label: "Pending", get: (r) => r.summary.pending, color: "text-amber-600" },
  { label: "Balance", get: (r) => r.balance.available, color: "text-slate-800" },
];

/** Small day marker for the team grid */
function MiniCell({ cell }: { cell: DayCell }) {
  const base = "mx-auto flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold";
  switch (cell.status) {
    case "present": return <span className={cn(base, "bg-emerald-500 text-white")}><Check className="h-3.5 w-3.5" /></span>;
    case "absent": return <span className={cn(base, "bg-rose-500 text-white", cell.sandwich && "ring-2 ring-rose-200")}>0</span>;
    case "pending": return <span className={cn(base, "bg-amber-400 text-white")}><Clock className="h-3 w-3" /></span>;
    case "leave": return <span className={cn(base, "bg-sky-500 text-white")}>L</span>;
    case "unpaid": return <span className={cn(base, "bg-orange-500 text-[8px] text-white")}>LOP</span>;
    case "leave-pending": return <span className={cn(base, "bg-violet-400 text-white")}>L?</span>;
    case "weekend": return <span className={cn(base, "text-slate-300")}>·</span>;
    case "today": return <span className={cn(base, "border border-dashed border-indigo-300")} />;
    default: return <span className={base} />;
  }
}

function TeamGrid({ team, month, today, canEdit, onEditDay, onOpen }: {
  team: TeamMonthRow[];
  month: string;
  today: string;
  canEdit: boolean;
  onEditDay: (userId: string, cell: DayCell) => void;
  onOpen: (userId: string) => void;
}) {
  const days = team[0]?.days ?? [];
  const first = team[0]?.summary;
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50"><Users2 className="h-4 w-4 text-indigo-600" /></div>
        <div className="mr-auto">
          <p className="text-[13px] font-bold text-slate-900">All Employees · {fmtMonth(month)}</p>
          <p className="text-[11px] text-slate-400">
            {first ? `${first.calendarDays} calendar days · ${first.workingDays} working days (Mon–Fri). ` : ""}
            Click a name to open their attendance.{canEdit ? " Click a day to mark it present or absent (you confirm first)." : ""}
          </p>
        </div>
        <a href={`/api/attendance/export?month=${month}`}>
          <Button size="sm" variant="outline"><Download className="h-3.5 w-3.5" /> Download Excel</Button>
        </a>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[12px]">
          <thead>
            <tr className="bg-slate-800">
              <th className="sticky left-0 z-10 min-w-[180px] bg-slate-800 px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-300">Employee</th>
              {days.map((d) => (
                <th key={d.day} className={cn("min-w-[30px] px-0.5 py-1.5 text-center font-semibold", [0, 6].includes(weekday(d.day)) ? "text-slate-500" : "text-slate-200", d.day === today && "bg-indigo-600 text-white")}>
                  <span className="block text-[11px]">{Number(d.day.slice(8))}</span>
                  <span className="block text-[9px] font-normal">{"SMTWTFS"[weekday(d.day)]}</span>
                </th>
              ))}
              {TOTALS.map((t) => (
                <th key={t.label} className="whitespace-nowrap border-l border-slate-700 px-2.5 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-300">{t.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {team.length === 0 ? (
              <tr><td colSpan={days.length + TOTALS.length + 1} className="px-4 py-8 text-center text-slate-400">No active employees with a role</td></tr>
            ) : (
              team.map((r) => (
                <tr key={r.userId} className="group">
                  <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-4 py-2 group-hover:bg-slate-50">
                    <button onClick={() => onOpen(r.userId)} className="text-left font-semibold text-indigo-700 hover:underline">{r.name}</button>
                    <p className="truncate text-[10.5px] text-slate-400">{r.roleName ?? "—"}</p>
                  </td>
                  {r.days.map((cell) => {
                    const editable = canEdit && isEditableDay(cell, today);
                    return (
                      <td
                        key={cell.day}
                        onClick={editable ? () => onEditDay(r.userId, cell) : undefined}
                        title={`${fmtDayKey(cell.day)}: ${CELL[cell.status].label || "—"}${cell.sandwich ? " (sandwich)" : ""}${editable ? ` · click to change` : ""}`}
                        className={cn("border-b border-slate-100 px-0.5 py-1.5 group-hover:bg-slate-50", editable && "cursor-pointer hover:!bg-indigo-50")}
                      >
                        <MiniCell cell={cell} />
                      </td>
                    );
                  })}
                  {TOTALS.map((t) => {
                    const v = t.get(r);
                    return (
                      <td key={t.label} className={cn("border-b border-l border-slate-100 px-2.5 py-2 text-right tabular-nums group-hover:bg-slate-50", v ? cn("font-semibold", t.color) : "text-slate-300")}>{v}</td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmployeeDialog({ row, month, today, canEdit, saving, onEditDay, onClose }: {
  row: TeamMonthRow;
  month: string;
  today: string;
  canEdit: boolean;
  saving: string | null;
  onEditDay: (cell: DayCell) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-slate-800 px-5 py-3">
          <div>
            <h2 className="text-[15px] font-semibold text-white">{row.name}</h2>
            <p className="text-[11.5px] text-slate-400">{row.roleName ?? "—"} · {row.email} · {fmtMonth(month)}</p>
          </div>
          <div className="flex items-center gap-3">
            {saving?.startsWith(`${row.userId}|`) && <Loader2 className="h-4 w-4 animate-spin text-slate-300" />}
            <button onClick={onClose} className="text-slate-300 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <SummaryCards summary={row.summary} />
          <p className="text-[12px] text-slate-500">
            Paid leave: <b className="text-slate-800">{row.balance.available}</b> available · {row.balance.accrued} earned · {row.balance.used} used
            {row.balance.pending ? ` · ${row.balance.pending} pending` : ""}
            {canEdit && <span className="ml-2 text-indigo-600">Click a day to mark it present or absent (you confirm first).</span>}
          </p>
          <CalendarGrid view={{ month, days: row.days }} today={today} onEditDay={canEdit ? onEditDay : undefined} flat />
        </div>
      </div>
    </div>
  );
}
