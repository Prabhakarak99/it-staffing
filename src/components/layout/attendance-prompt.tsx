"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Quote, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AttendancePromptData } from "@/lib/attendance/prompt";

/**
 * First login of the day: confirm "I'm in" before using the app. It can't be closed or skipped; the
 * mark then waits for a POC / Manager to approve it.
 */
export function AttendancePrompt({ data, onDone }: { data: AttendancePromptData; onDone: () => void }) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setSaving(true);
    setError("");
    const res = await fetch("/api/attendance/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return setError(data.error ?? "Could not mark attendance. Please try again.");
    }
    setDone(true);
  };

  const close = () => {
    onDone();
    router.refresh();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Mark today's attendance">
      <div className="relative max-h-[95vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl">

        <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-6 pb-6 pt-7 text-white">
          <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-white/75">
            <Sun className="h-4 w-4" /> {data.dayLabel}
          </div>
          <p className="mt-2 text-[22px] font-extrabold leading-tight">
            {data.firstName ? `Welcome, ${data.firstName}!` : "Welcome!"}
          </p>
          {data.quote && (
            <div className="mt-4 rounded-xl bg-white/10 p-4">
              <Quote className="h-4 w-4 text-white/60" />
              <p className="mt-1 text-[14px] font-medium leading-relaxed">{data.quote.text}</p>
              {data.quote.author && <p className="mt-1.5 text-[12px] text-white/70">— {data.quote.author}</p>}
            </div>
          )}
        </div>

        <div className="space-y-4 px-6 py-5">
          {done ? (
            <div className="flex flex-col items-center py-2 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="mt-2 text-[15px] font-bold text-slate-900">Attendance marked</p>
              <p className="mt-1 text-[12.5px] text-slate-500">It has been sent to your POC / Manager for approval. Have a great day!</p>
              <Button className="mt-4" onClick={close}>Let&apos;s go</Button>
            </div>
          ) : (
            <>
              <div>
                <p className="text-[15px] font-bold text-slate-900">Mark today&apos;s attendance</p>
                <p className="text-[12.5px] text-slate-500">Please confirm to continue. Your POC / Manager will approve it.</p>
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:border-indigo-300 hover:bg-indigo-50/40">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-indigo-600"
                />
                <span className="text-[13px] text-slate-700">
                  <b>Yes, I am in</b> and this is a valid login from my side.
                </span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Note for your manager (optional)"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">{error}</p>}
              <Button className="w-full" onClick={submit} disabled={!confirmed || saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {saving ? "Marking…" : "Mark Attendance"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
