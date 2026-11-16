"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Database, ExternalLink, Loader2, Play, Settings2, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { APP_TZ } from "@/lib/tz";
import { JOB_APIS, type JobApiId, type JobApiRow } from "@/lib/jobfeed/apis/catalog";

type Notify = (message: string, type: "success" | "error") => void;

interface FormState {
  id: JobApiId;
  apiKey: string;
  isEnabled: boolean;
  intervalMin: string;
  maxPerRun: string;
  keywords: string;
  contractOnly: boolean;
  extraParams: string;
  startUrls: string;
}

const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: APP_TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const areaCls = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";
const labelCls = "text-[10px] font-semibold uppercase tracking-wide text-slate-500";

const CONFIDENCE: Record<string, { label: string; cls: string }> = {
  documented: { label: "Built from full docs", cls: "bg-emerald-50 text-emerald-700" },
  "partly documented": { label: "Built from partial docs", cls: "bg-amber-50 text-amber-700" },
  unverified: { label: "Docs not available: unverified", cls: "bg-rose-50 text-rose-700" },
};

/** AI Settings: API keys and pull settings for the paid job-data providers that feed the Requirements tab */
export function JobApisSection({ initial, notify }: { initial: JobApiRow[]; notify: Notify }) {
  const [apis, setApis] = useState(initial);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const call = async (url: string, method: string, body?: unknown) => {
    const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Request failed");
    return data;
  };

  const open = (a: JobApiRow) =>
    setForm({
      id: a.id, apiKey: "", isEnabled: a.isEnabled, intervalMin: String(a.intervalMin), maxPerRun: String(a.maxPerRun),
      keywords: a.keywords.join(", "), contractOnly: a.contractOnly, extraParams: a.extraParams, startUrls: a.startUrls.join("\n"),
    });

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      setApis(await call(`/api/job-apis/${form.id}`, "PATCH", {
        apiKey: form.apiKey, isEnabled: form.isEnabled, intervalMin: Number(form.intervalMin), maxPerRun: Number(form.maxPerRun),
        keywords: form.keywords, contractOnly: form.contractOnly, extraParams: form.extraParams, startUrls: form.startUrls,
      }));
      notify(`${JOB_APIS[form.id].name} saved. Click Test to check the key.`, "success");
      setForm(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  const act = async (a: JobApiRow, kind: "test" | "run" | "toggle") => {
    const name = JOB_APIS[a.id].name;
    if (kind === "run" && !confirm(`Pull up to ${a.maxPerRun} jobs from ${name} now? This uses ${name} credits.`)) return;
    setBusy(`${a.id}-${kind}`);
    try {
      if (kind === "toggle") {
        setApis(await call(`/api/job-apis/${a.id}`, "PATCH", { isEnabled: !a.isEnabled }));
      } else {
        const d = await call(`/api/job-apis/${a.id}?action=${kind}`, "POST");
        setApis(d.apis);
        if (!d.ok) notify(`${name}: ${d.error}`, "error");
        else if (kind === "test") notify(d.sample.length ? `${name} works. Example: ${d.sample[0]}` : `${name} accepted the key, but returned no jobs for these keywords in the last 7 days.`, "success");
        else notify(`${name}: ${d.fetched} jobs fetched, ${d.created} new in Requirements`, "success");
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : "Request failed", "error");
    } finally {
      setBusy(null);
    }
  };

  const meta = form ? JOB_APIS[form.id] : null;
  const row = form ? apis.find((a) => a.id === form.id) : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-5 py-4">
        <Database className="h-5 w-5 text-emerald-600" />
        <p className="max-w-4xl text-[12.5px] text-slate-600">
          <b>Job data APIs.</b> Paid providers that can load US contract jobs into the Requirements tab. Each one is separate: its own key, schedule and limits.
          Nothing is pulled (or billed) until a provider has a key and is turned on. Existing jobs are never deleted; a job seen again is only refreshed.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {apis.map((a) => {
          const m = JOB_APIS[a.id];
          const conf = CONFIDENCE[m.confidence];
          return (
            <div key={a.id} className={cn("rounded-2xl border bg-white p-5 shadow-sm", a.isEnabled ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-200")}>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600"><Database className="h-5 w-5 text-white" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14px] font-bold text-slate-900">{m.name}</p>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", a.isEnabled ? "bg-emerald-600 text-white" : a.hasKey ? "bg-slate-200 text-slate-600" : "bg-slate-100 text-slate-400")}>
                      {a.isEnabled ? "On" : a.hasKey ? "Off" : "Not configured"}
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", conf.cls)}>{conf.label}</span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-slate-500">{m.about}</p>
                </div>
              </div>
              <dl className="mt-3 space-y-1.5 text-[12px]">
                <div><dt className="inline font-semibold text-slate-500">Pricing: </dt><dd className="inline text-slate-700">{m.pricing}</dd></div>
                <div><dt className="inline font-semibold text-slate-500">Key: </dt><dd className="inline text-slate-700">{m.access === "sales" ? "Through their sales team. " : "Self-serve. "}{a.keyPreview ? <span className="font-mono">{a.keyPreview}</span> : "None saved."}</dd></div>
                {a.hasKey && <div><dt className="inline font-semibold text-slate-500">Schedule: </dt><dd className="inline text-slate-700">every {a.intervalMin} min, up to {a.maxPerRun} jobs a run{a.contractOnly ? ", contract only" : ""}</dd></div>}
              </dl>
              {a.lastTestedAt && (
                <p className={cn("mt-2 flex items-start gap-1.5 text-[11.5px]", a.lastTestError ? "text-rose-600" : "text-emerald-700")}>
                  {a.lastTestError ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                  <span>{a.lastTestError ?? "Test passed"} · tested {fmt(a.lastTestedAt)}</span>
                </p>
              )}
              {a.lastRunAt && (
                <p className={cn("mt-1 text-[11.5px]", a.lastError ? "text-rose-600" : "text-slate-500")}>
                  Last pull {fmt(a.lastRunAt)}: {a.lastError ?? `${a.lastFetched} fetched, ${a.lastNew} new`} · {a.totalNew} added in total
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <Button size="sm" onClick={() => open(a)}><Settings2 className="h-3.5 w-3.5" /> Configure</Button>
                {a.hasKey && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => act(a, "test")} disabled={!!busy}>
                      {busy === `${a.id}-test` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Test
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => act(a, "run")} disabled={!!busy}>
                      {busy === `${a.id}-run` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Pull now
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => act(a, "toggle")} disabled={!!busy}>{a.isEnabled ? "Turn off" : "Turn on"}</Button>
                  </>
                )}
                <a href={m.docsUrl} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 self-center text-[11.5px] font-semibold text-indigo-600 hover:underline">
                  Docs <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {form && meta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
          <div className="absolute inset-0" onClick={() => setForm(null)} aria-hidden="true" />
          <div className="relative flex max-h-full w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between rounded-t-2xl bg-slate-800 px-5 py-3">
              <h2 className="text-[14px] font-semibold text-white">Configure {meta.name}</h2>
              <button onClick={() => setForm(null)} className="text-slate-300 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3 overflow-y-auto px-5 py-4">
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11.5px] text-slate-600">{meta.accessNote}</p>
              <div>
                <Input compact type="password" autoComplete="new-password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  label={row?.hasKey ? `${meta.keyLabel} (leave empty to keep the saved one)` : meta.keyLabel} placeholder={row?.keyPreview ?? "Paste the key"} />
                <a href={meta.keyUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold text-indigo-600 hover:underline">
                  {meta.access === "sales" ? "Contact their sales team" : "Get a key"} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <label className="block space-y-1">
                <span className={labelCls}>Search for (job titles, separated by commas)</span>
                <textarea rows={2} value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} className={areaCls} />
              </label>
              {meta.needsStartUrls && (
                <label className="block space-y-1">
                  <span className={labelCls}>Pages to read (one https:// link per line)</span>
                  <textarea rows={3} value={form.startUrls} onChange={(e) => setForm({ ...form, startUrls: e.target.value })} placeholder="https://careers.example.com/jobs?q=java" className={areaCls} />
                </label>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Input compact type="number" min={15} max={1440} label="Pull every (minutes)" value={form.intervalMin} onChange={(e) => setForm({ ...form, intervalMin: e.target.value })} />
                <Input compact type="number" min={1} max={1000} label="Most jobs per pull" value={form.maxPerRun} onChange={(e) => setForm({ ...form, maxPerRun: e.target.value })} />
              </div>
              <p className="text-[11px] text-slate-400">
                These two numbers cap the spend: at most {Math.round((1440 / Math.max(15, Number(form.intervalMin) || 60)) * (Number(form.maxPerRun) || 0)).toLocaleString("en-US")} jobs a day from this provider.
              </p>
              <label className="flex items-center gap-2 text-[12.5px] text-slate-700">
                <input type="checkbox" checked={form.contractOnly} onChange={(e) => setForm({ ...form, contractOnly: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
                Ask for contract jobs only
              </label>
              {meta.extraHint !== "Not used" && (
                <Input compact label="Extra settings (optional)" value={form.extraParams} onChange={(e) => setForm({ ...form, extraParams: e.target.value })} placeholder={meta.extraHint} />
              )}
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] font-semibold text-slate-800">
                <input type="checkbox" checked={form.isEnabled} onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
                Turn on: pull automatically on this schedule
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
