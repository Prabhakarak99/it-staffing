"use client";

import { useState, useCallback, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Search, Briefcase, Loader2, RefreshCw, ChevronLeft, ChevronRight,
  Layers, Wifi, DollarSign, Clock, BarChart3, CheckCircle2, AlertCircle,
  Server,
} from "lucide-react";
import { JobCard } from "./job-card";
import { JobFilters, EMPTY_FILTERS, type Filters } from "./job-filters";
import { JobDetailModal, type JobResult } from "./job-detail-modal";
import { Toast, useToast } from "@/components/ui/toast";

interface Props {
  initialJobs: JobResult[];
  initialTotal: number;
  todayCount: number;
  remoteCount: number;
  c2cCount: number;
  avgRate: number | null;
  lastScraped: string | null;
}

function fmtTime(d: string | null) {
  if (!d) return "Never";
  const date = new Date(d);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function RequirementsView({
  initialJobs,
  initialTotal,
  todayCount,
  remoteCount,
  c2cCount,
  avgRate,
  lastScraped,
}: Props) {
  const router = useRouter();
  const { toast, show, hide } = useToast();
  const [, startTransition] = useTransition();

  const [jobs, setJobs] = useState<JobResult[]>(initialJobs);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedJob, setSelectedJob] = useState<JobResult | null>(null);
  const [lastScrapedTime, setLastScrapedTime] = useState(lastScraped);
  const [liveStats, setLiveStats] = useState({ todayCount, remoteCount, c2cCount, avgRate, total: initialTotal });
  const [scrapeLog, setScrapeLog] = useState<string | null>(null);

  const LIMIT = 20;
  const pages = Math.ceil(total / LIMIT);

  const fetchJobs = useCallback(async (f: Filters, p: number) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      Object.entries(f).forEach(([k, v]) => { if (v) params.set(k, v); });
      const res = await fetch(`/api/job-search?${params}`);
      if (!res.ok) throw new Error("Failed to load jobs");
      const data = await res.json();
      setJobs(data.jobs);
      setTotal(data.total);
    } catch {
      show("Failed to load jobs", "error");
    } finally {
      setIsLoading(false);
    }
  }, [show]);

  const refreshStats = useCallback(async () => {
    try {
      const res = await fetch("/api/job-search/stats");
      if (res.ok) {
        const s = await res.json();
        setLiveStats({ todayCount: s.todayCount, remoteCount: s.remoteCount, c2cCount: s.c2cCount, avgRate: s.avgRate, total: s.total });
        setLastScrapedTime(s.lastScraped);
      }
    } catch { /* ignore */ }
  }, []);

  // Debounce filter changes
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchJobs(filters, 1); }, 350);
    return () => clearTimeout(t);
  }, [filters, fetchJobs]);

  const handlePageChange = (p: number) => {
    setPage(p);
    fetchJobs(filters, p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/job-search/${id}`, { method: "DELETE" });
      setJobs((prev) => prev.filter((j) => j.id !== id));
      setTotal((t) => t - 1);
      if (selectedJob?.id === id) setSelectedJob(null);
      show("Job removed", "success");
      startTransition(() => router.refresh());
    } catch {
      show("Failed to remove job", "error");
    }
  };

  const handleScrape = async () => {
    if (!process.env.NEXT_PUBLIC_APIFY_CONFIGURED && isScraping) return;
    setIsScraping(true);
    setScrapeLog(null);
    try {
      const res = await fetch("/api/job-search/scrape", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scraping failed");
      const { total: t, saved, skipped, errors, sources } = data;
      const sourceStr = Object.entries(sources as Record<string, number>).map(([k, v]) => `${k}: ${v}`).join(", ");
      setScrapeLog(`Found ${t} jobs (${saved} saved, ${skipped} skipped) — ${sourceStr}${errors.length ? ` | Errors: ${errors.join("; ")}` : ""}`);
      show(`Scrape complete: ${saved} new jobs saved!`, "success");
      await refreshStats();
      fetchJobs(filters, 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scraping failed";
      show(msg, "error");
    } finally {
      setIsScraping(false);
    }
  };

  const stats = [
    { label: "Total Jobs",    value: liveStats.total,       icon: Layers,    color: "text-cyan-700",    bg: "bg-cyan-50",    border: "border-cyan-200" },
    { label: "Added Today",   value: liveStats.todayCount,  icon: Clock,     color: "text-indigo-700",  bg: "bg-indigo-50",  border: "border-indigo-200" },
    { label: "Remote",        value: liveStats.remoteCount, icon: Wifi,      color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
    { label: "C2C Openings",  value: liveStats.c2cCount,    icon: Briefcase, color: "text-violet-700",  bg: "bg-violet-50",  border: "border-violet-200" },
    { label: "Avg Rate",      value: liveStats.avgRate ? `$${liveStats.avgRate}/hr` : "—", icon: DollarSign, color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
    { label: "Last Scraped",  value: fmtTime(lastScrapedTime), icon: BarChart3, color: "text-slate-700", bg: "bg-slate-100", border: "border-slate-200" },
  ] as const;

  return (
    <>
      {/* ── Page header ── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 px-6 py-5">
        <div className="absolute -right-6 -top-6 h-36 w-36 rounded-full bg-white/[0.05]" />
        <div className="absolute left-1/2 bottom-0 h-20 w-20 rounded-full bg-white/[0.04]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <Search className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-white">Requirements</h1>
              <p className="mt-0.5 text-[12px] text-white/65">
                {liveStats.total} C2C contract jobs · Apify-powered scraping
              </p>
            </div>
          </div>
          <button
            onClick={handleScrape}
            disabled={isScraping}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[13px] font-bold text-cyan-700 shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isScraping
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Scraping…</>
              : <><RefreshCw className="h-4 w-4" /> Scrape Now</>
            }
          </button>
        </div>
      </div>

      {/* Scrape result log */}
      {scrapeLog && (
        <div className="mx-6 mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
          <p className="text-[12px] text-emerald-700 font-medium">{scrapeLog}</p>
        </div>
      )}

      {/* APIFY_TOKEN warning */}
      {!process.env.NEXT_PUBLIC_APIFY_CONFIGURED && (
        <div className="mx-6 mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <p className="text-[12px] text-amber-700 font-medium">
            Add <code className="rounded bg-amber-100 px-1 font-mono">APIFY_TOKEN</code> to your environment variables and redeploy to enable live scraping. Jobs shown are from the database.
          </p>
        </div>
      )}

      {/* ── Stats bar ── */}
      <div className="px-6 pt-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map(({ label, value, icon: Icon, color, bg, border }) => (
            <div key={label} className={cn("rounded-2xl border p-4 shadow-sm", bg, border)}>
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className={cn("h-3.5 w-3.5", color)} />
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
              </div>
              <p className={cn("text-[20px] font-bold tabular-nums leading-none", color)}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Source legend ── */}
      <div className="px-6 pt-3 flex flex-wrap items-center gap-3">
        {[
          { label: "LinkedIn", color: "bg-blue-500" },
          { label: "Indeed",   color: "bg-indigo-500" },
          { label: "Google",   color: "bg-red-500" },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", color)} />
            <span className="text-[11px] font-medium text-slate-500">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <Server className="h-3 w-3 text-slate-400" />
          <span className="text-[11px] text-slate-400">Powered by Apify</span>
        </div>
      </div>

      {/* ── Main content: sidebar + job list ── */}
      <div className="flex gap-5 px-6 py-5">
        {/* Filter sidebar */}
        <div className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-4">
            <JobFilters filters={filters} onChange={(f) => { setFilters(f); setPage(1); }} />
          </div>
        </div>

        {/* Job list */}
        <div className="flex-1 min-w-0">
          {/* Result count + mobile filter hint */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-[13px] font-semibold text-slate-600">
              {isLoading ? "Loading…" : `${total.toLocaleString()} job${total !== 1 ? "s" : ""} found`}
            </p>
            <div className="flex items-center gap-2">
              {Object.values(filters).some((v) => v) && (
                <button
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  className="text-[11px] font-semibold text-rose-500 hover:text-rose-600"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Mobile filters (collapsed) */}
          <details className="mb-4 lg:hidden">
            <summary className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-semibold text-slate-700 shadow-sm">
              Filters {Object.values(filters).some((v) => v) ? "●" : ""}
            </summary>
            <div className="mt-2">
              <JobFilters filters={filters} onChange={(f) => { setFilters(f); setPage(1); }} />
            </div>
          </details>

          {/* Loading state */}
          {isLoading && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-52 rounded-2xl border border-slate-200 bg-white shadow-sm animate-pulse" />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && jobs.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
              <Search className="mx-auto mb-4 h-10 w-10 text-slate-300" />
              <p className="text-[14px] font-semibold text-slate-600">No jobs found</p>
              <p className="mt-1 text-[12px] text-slate-400">
                {Object.values(filters).some((v) => v) ? "Try adjusting your filters" : "Click \"Scrape Now\" to fetch the latest C2C jobs from LinkedIn, Indeed, and Google"}
              </p>
              {!Object.values(filters).some((v) => v) && (
                <button
                  onClick={handleScrape}
                  disabled={isScraping}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-[13px] font-bold text-white hover:bg-cyan-700 transition-colors disabled:opacity-50"
                >
                  {isScraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {isScraping ? "Scraping…" : "Scrape Now"}
                </button>
              )}
            </div>
          )}

          {/* Job grid */}
          {!isLoading && jobs.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onClick={() => setSelectedJob(job)}
                  onDelete={() => handleDelete(job.id)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && !isLoading && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => handlePageChange(page - 1)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(7, pages) }, (_, i) => {
                let p = i + 1;
                if (pages > 7) {
                  if (page <= 4) p = i + 1;
                  else if (page >= pages - 3) p = pages - 6 + i;
                  else p = page - 3 + i;
                }
                return (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl border text-[13px] font-semibold transition-colors",
                      p === page
                        ? "border-cyan-500 bg-cyan-500 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    )}
                  >{p}</button>
                );
              })}
              <button
                disabled={page === pages}
                onClick={() => handlePageChange(page + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <span className="ml-2 text-[12px] text-slate-400">
                Page {page} of {pages} ({total.toLocaleString()} jobs)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Job detail modal */}
      {selectedJob && (
        <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </>
  );
}
