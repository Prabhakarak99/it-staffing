"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Globe, Plus, Upload, Play, Loader2, Trash2, AlertCircle, CheckCircle2,
  Bot, Building2, Layers, Clock, Pause, RefreshCw,
} from "lucide-react";
import { Toast, useToast } from "@/components/ui/toast";
import type { JobFeedOverview } from "@/lib/jobfeed/overview";
import { APP_TZ } from "@/lib/tz";

type Company = JobFeedOverview["companies"][number];
type Config = JobFeedOverview["config"];

const PROVIDER_STYLE: Record<string, string> = {
  greenhouse:      "bg-emerald-100 text-emerald-700 border-emerald-200",
  lever:           "bg-sky-100 text-sky-700 border-sky-200",
  ashby:           "bg-violet-100 text-violet-700 border-violet-200",
  smartrecruiters: "bg-amber-100 text-amber-700 border-amber-200",
  workday:         "bg-orange-100 text-orange-700 border-orange-200",
};

const PROVIDER_NAME: Record<string, string> = {
  greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby", smartrecruiters: "SmartRecruiters", workday: "Workday",
};

function fmtAgo(d: string | null) {
  if (!d) return "Never";
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(d).toLocaleDateString("en-US", { timeZone: APP_TZ, month: "short", day: "numeric" });
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-40",
        on ? "bg-cyan-600" : "bg-slate-300"
      )}
    >
      <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform", on ? "translate-x-4" : "translate-x-0.5")} />
    </button>
  );
}

function SettingRow({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-slate-800">{title}</p>
        <p className="text-[11px] text-slate-400">{note}</p>
      </div>
      {children}
    </div>
  );
}

export function SourcesView({ initial }: { initial: JobFeedOverview }) {
  const { toast, show, hide } = useToast();

  const [data, setData] = useState(initial);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { config, companies, stats, env } = data;

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/job-sources", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch { /* keep current data */ }
  }, []);

  // While a run is in progress, poll so crawl results appear as they land
  useEffect(() => {
    if (!data.running) return;
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
  }, [data.running, reload]);

  const updateConfig = async (patch: Partial<Config>) => {
    setData((d) => ({ ...d, config: { ...d.config, ...patch } }));
    const res = await fetch("/api/job-sources/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) show("Failed to save setting", "error");
    await reload();
  };

  const addBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || adding) return;
    setAdding(true);
    try {
      const res = await fetch("/api/job-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, name }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to add board");
      show(`Added ${body.company.name} (${body.postings} postings on the board)`, "success");
      setUrl("");
      setName("");
      await reload();
    } catch (err) {
      show(err instanceof Error ? err.message : "Failed to add board", "error");
    } finally {
      setAdding(false);
    }
  };

  const importCsv = async (file: File) => {
    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/job-sources/import", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Import failed");
      show(
        `Imported ${body.inserted} boards` +
          (body.duplicatesSkipped ? `, ${body.duplicatesSkipped} already listed` : "") +
          (body.unrecognisedCount ? `, ${body.unrecognisedCount} URLs not recognised` : ""),
        "success"
      );
      await reload();
    } catch (err) {
      show(err instanceof Error ? err.message : "Import failed", "error");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const toggleCompany = async (c: Company) => {
    setData((d) => ({ ...d, companies: d.companies.map((x) => (x.id === c.id ? { ...x, isActive: !c.isActive } : x)) }));
    await fetch(`/api/job-sources/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !c.isActive }),
    });
  };

  const removeCompany = async (c: Company) => {
    if (!window.confirm(`Stop crawling ${c.name}? Jobs already loaded stay until they go stale.`)) return;
    const res = await fetch(`/api/job-sources/${c.id}`, { method: "DELETE" });
    if (res.ok) {
      setData((d) => ({ ...d, companies: d.companies.filter((x) => x.id !== c.id) }));
      show(`Removed ${c.name}`, "success");
    } else {
      show("Failed to remove board", "error");
    }
  };

  const runNow = async () => {
    const res = await fetch("/api/job-sources/run", { method: "POST" });
    const body = await res.json();
    show(body.started ? "Run started — results appear below as boards finish" : body.message ?? "Already running", "success");
    await reload();
  };

  const activeCount = companies.filter((c) => c.isActive).length;
  const totalContract = Object.values(stats.contractJobs).reduce((a, b) => a + b, 0);

  const tiles = [
    { label: "Boards crawled", value: `${activeCount}/${companies.length}`, icon: Building2, color: "text-cyan-700", bg: "bg-cyan-50", border: "border-cyan-200" },
    { label: "Contract jobs (live)", value: totalContract, icon: Layers, color: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-200" },
    { label: "From company sites", value: stats.contractJobs.ats ?? 0, icon: Globe, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
    { label: "Waiting for AI", value: stats.pendingAi, icon: Bot, color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200" },
  ];

  return (
    <>
      {/* ── Header ── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 px-6 py-5">
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/admin/requirements" className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/25">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-[18px] font-bold text-white">Job Sources</h1>
              <p className="mt-0.5 text-[12px] text-white/65">
                Company career sites crawled every {config.crawlIntervalMin} min · AI sorts C2C / W2 / 1099
              </p>
            </div>
          </div>
          <button
            onClick={runNow}
            disabled={data.running}
            className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[13px] font-bold text-cyan-700 shadow-lg transition-all hover:shadow-xl disabled:opacity-60"
          >
            {data.running ? <><Loader2 className="h-4 w-4 animate-spin" /> Running…</> : <><Play className="h-4 w-4" /> Run now</>}
          </button>
        </div>
      </div>

      <div className="space-y-5 p-6">
        {/* ── Setup warnings ── */}
        {!env.aiConfigured && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-[12px] font-medium text-amber-700">
              Add <code className="rounded bg-amber-100 px-1 font-mono">ANTHROPIC_API_KEY</code> to the environment to turn on AI
              classification. Until then, jobs that only hint at being a contract stay hidden as &ldquo;Pending&rdquo;.
            </p>
          </div>
        )}

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map(({ label, value, icon: Icon, color, bg, border }) => (
            <div key={label} className={cn("rounded-2xl border p-4 shadow-sm", bg, border)}>
              <div className="mb-1.5 flex items-center gap-2">
                <Icon className={cn("h-3.5 w-3.5", color)} />
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
              </div>
              <p className={cn("text-[20px] font-bold leading-none tabular-nums", color)}>{value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          {/* ── Boards ── */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
            <div className="border-b border-slate-100 px-5 py-4">
              <p className="text-[13px] font-bold text-slate-900">Company career boards</p>
              <p className="text-[11px] text-slate-400">
                Paste a Greenhouse, Lever, Ashby, SmartRecruiters or Workday careers URL. Only US IT roles are kept.
              </p>
              <form onSubmit={addBoard} className="mt-3 flex flex-wrap gap-2">
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="e.g. https://acme.wd5.myworkdayjobs.com/External"
                  className="min-w-[240px] flex-[2] rounded-lg border border-slate-200 px-3 py-2 text-[12px] outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Company name (optional)"
                  className="min-w-[160px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-[12px] outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                />
                <button
                  type="submit"
                  disabled={adding || !url.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3.5 py-2 text-[12px] font-bold text-white hover:bg-cyan-700 disabled:opacity-50"
                >
                  {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={importing}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  title="CSV with a careers URL column and an optional name column"
                >
                  {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Import CSV
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && void importCsv(e.target.files[0])}
                />
              </form>
            </div>

            {companies.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <Globe className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                <p className="text-[13px] font-semibold text-slate-500">No boards yet</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Start with staffing firms, implementation partners and large enterprises that hire IT contractors.
                </p>
              </div>
            ) : (
              <table className="w-full table-fixed text-[12px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-2.5">Company</th>
                    <th className="w-[18%] px-2 py-2.5">Provider</th>
                    <th className="w-[13%] px-2 py-2.5 text-center">IT jobs</th>
                    <th className="w-[16%] px-2 py-2.5">Last crawl</th>
                    <th className="w-[15%] px-2 py-2.5 text-right pr-5">Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {companies.map((c) => (
                    <tr key={c.id} className={cn("hover:bg-slate-50/60", !c.isActive && "opacity-50")}>
                      <td className="px-5 py-2.5">
                        <p className="truncate font-semibold text-slate-800">{c.name}</p>
                        {c.lastError ? (
                          <p className="truncate text-[10px] text-rose-500" title={c.lastError}>{c.lastError}</p>
                        ) : (
                          <p className="truncate text-[10px] text-slate-400">
                            {c.workdayHost ? `${c.workdayHost}/${c.workdaySite}` : c.boardToken}
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-2.5">
                        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", PROVIDER_STYLE[c.provider] ?? "bg-slate-100 text-slate-600")}>
                          {PROVIDER_NAME[c.provider] ?? c.provider}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-center tabular-nums">
                        <span className="font-bold text-slate-800">{c.lastJobCount}</span>
                        {c.lastNewCount > 0 && <span className="ml-1 text-[10px] font-semibold text-emerald-600">+{c.lastNewCount}</span>}
                      </td>
                      <td className="px-2 py-2.5 text-slate-500">{fmtAgo(c.lastCrawledAt)}</td>
                      <td className="px-2 py-2.5 pr-5">
                        <div className="flex items-center justify-end gap-2">
                          <Toggle on={c.isActive} onChange={() => void toggleCompany(c)} />
                          <button
                            onClick={() => void removeCompany(c)}
                            className="flex h-6 w-6 items-center justify-center rounded-md text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                            title="Remove board"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Settings ── */}
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-2 shadow-sm">
              <p className="pt-3 text-[13px] font-bold text-slate-900">Schedule</p>
              <div className="divide-y divide-slate-100">
                <SettingRow title="Job feed running" note={config.paused ? "Paused — nothing runs automatically" : "Runs every 5 minutes in the background"}>
                  <Toggle on={!config.paused} onChange={(v) => void updateConfig({ paused: !v })} />
                </SettingRow>
                <SettingRow title="Crawl each board every" note="Minutes between visits to the same company">
                  <select
                    value={config.crawlIntervalMin}
                    onChange={(e) => void updateConfig({ crawlIntervalMin: Number(e.target.value) })}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-[12px]"
                  >
                    {[30, 60, 120, 240, 720, 1440].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} h`}</option>)}
                  </select>
                </SettingRow>
                <SettingRow title="Boards per 5-min cycle" note="Higher = faster coverage, more requests">
                  <select
                    value={config.maxCompaniesPerCycle}
                    onChange={(e) => void updateConfig({ maxCompaniesPerCycle: Number(e.target.value) })}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-[12px]"
                  >
                    {[5, 10, 20, 40, 80].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </SettingRow>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-2 shadow-sm">
              <p className="pt-3 text-[13px] font-bold text-slate-900">LinkedIn · Indeed · Google (Apify)</p>
              <div className="divide-y divide-slate-100">
                <SettingRow
                  title="Scheduled board scraping"
                  note={env.apifyConfigured ? `Uses Apify credits on every run · last ${fmtAgo(config.lastBoardScrapeAt)}` : "APIFY_TOKEN is not set"}
                >
                  <Toggle on={config.boardScrapeEnabled} disabled={!env.apifyConfigured} onChange={(v) => void updateConfig({ boardScrapeEnabled: v })} />
                </SettingRow>
                <SettingRow title="Scrape every" note="Hours between Apify runs">
                  <select
                    value={config.boardScrapeHours}
                    onChange={(e) => void updateConfig({ boardScrapeHours: Number(e.target.value) })}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-[12px]"
                  >
                    {[3, 6, 12, 24].map((h) => <option key={h} value={h}>{h} h</option>)}
                  </select>
                </SettingRow>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-2 shadow-sm">
              <p className="pt-3 text-[13px] font-bold text-slate-900">AI classification</p>
              <div className="divide-y divide-slate-100">
                <SettingRow title="Classify with Claude Haiku 5.5" note={env.aiConfigured ? "Batched at half price; reads type, rate, skills, visa" : "ANTHROPIC_API_KEY is not set"}>
                  <Toggle on={config.aiEnabled} disabled={!env.aiConfigured} onChange={(v) => void updateConfig({ aiEnabled: v })} />
                </SettingRow>
                <div className="space-y-1.5 py-3 text-[12px]">
                  <p className="flex items-center gap-2 text-slate-600">
                    {config.aiBatchId ? <RefreshCw className="h-3.5 w-3.5 animate-spin text-violet-500" /> : <Clock className="h-3.5 w-3.5 text-slate-400" />}
                    {config.aiBatchId ? `Batch in progress (sent ${fmtAgo(config.aiBatchSubmittedAt)})` : "No batch in progress"}
                  </p>
                  <p className="flex items-center gap-2 text-slate-600">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> {stats.aiClassified.toLocaleString()} jobs classified
                  </p>
                  {stats.aiErrors > 0 && (
                    <p className="flex items-center gap-2 text-rose-600">
                      <AlertCircle className="h-3.5 w-3.5" /> {stats.aiErrors} could not be classified
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] text-slate-500">
              <Pause className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Vendor requirement emails are planned for phase 2 (a shared mailbox read by the same AI step).
            </div>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </>
  );
}
