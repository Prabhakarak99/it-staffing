"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import {
  Zap, Upload, Pause, Play, Send, RefreshCw, ChevronDown, ChevronRight,
} from "lucide-react";

interface AutoJobsConfig {
  paused: boolean;
  autoSend: boolean;
  dailyCap: number;
  maxVendorsPerRun: number;
  cooldownDays: number;
}

interface RunRecord {
  id: string;
  clientName: string;
  technology: string;
  status: string;
  note: string | null;
  matchedConsultants: number;
  vendorsFound: number;
  emailsSent: number;
  applicationCount: number;
  createdAt: string;
  triggerSubmissionCode: string | null;
  triggerConsultant: string | null;
  triggerRecruiter: string | null;
}

interface ApplicationRecord {
  id: string;
  consultantName: string;
  consultantTechnology: string | null;
  vendorCompany: string;
  vendorRecruiter: string | null;
  vendorEmail: string;
  emailStatus: string;
  errorMessage: string | null;
  sentAt: string | null;
}

interface OverviewData {
  config: AutoJobsConfig;
  summary: {
    vendorContactCount: number;
    sentToday: number;
    queuedCount: number;
    repliedCount: number;
  };
  runs: RunRecord[];
}

function runStatusBadge(status: string) {
  switch (status) {
    case "completed": return <Badge variant="success">Completed</Badge>;
    case "pending": return <Badge variant="info">Pending</Badge>;
    case "no_matches": return <Badge variant="warning">No matches</Badge>;
    case "failed": return <Badge variant="danger">Failed</Badge>;
    default: return <Badge>{status}</Badge>;
  }
}

function appStatusBadge(status: string) {
  switch (status) {
    case "sent": return <Badge variant="success">Sent</Badge>;
    case "queued": return <Badge variant="info">Queued</Badge>;
    case "failed": return <Badge variant="danger">Failed</Badge>;
    case "replied": return <Badge variant="success">Replied</Badge>;
    case "skipped": return <Badge>Skipped</Badge>;
    default: return <Badge>{status}</Badge>;
  }
}

export default function AutoJobsPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [applications, setApplications] = useState<Record<string, ApplicationRecord[]>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast, show, hide } = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/autojobs");
      if (!res.ok) throw new Error("Failed to load AutoJobs data");
      setData(await res.json());
    } catch {
      show("Failed to load AutoJobs data", "error");
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 30_000);
    return () => clearInterval(interval);
  }, [load]);

  async function updateConfig(patch: Partial<AutoJobsConfig>) {
    setSavingConfig(true);
    try {
      const res = await fetch("/api/autojobs/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      const config = await res.json();
      setData((prev) => (prev ? { ...prev, config } : prev));
      show("Settings updated");
    } catch {
      show("Failed to update settings", "error");
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleImport(file: File) {
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/autojobs/import", { method: "POST", body: fd });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Import failed");
      show(
        `Imported ${result.inserted} contacts (${result.duplicatesSkipped} duplicates, ${result.invalidSkipped} invalid rows skipped)`
      );
      void load();
    } catch (err) {
      show(err instanceof Error ? err.message : "Import failed", "error");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function toggleRun(runId: string) {
    if (expandedRun === runId) {
      setExpandedRun(null);
      return;
    }
    setExpandedRun(runId);
    if (!applications[runId]) {
      try {
        const res = await fetch(`/api/autojobs/${runId}`);
        if (res.ok) {
          const apps = await res.json();
          setApplications((prev) => ({ ...prev, [runId]: apps }));
        }
      } catch {
        // row stays empty; user can retry by collapsing/expanding
      }
    }
  }

  const config = data?.config;
  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Zap className="h-5 w-5 text-indigo-600" />
            AutoJobs
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Automated vendor marketing — when a submission is created, other matching consultants
            are marketed to vendors serving the same client.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
            }}
          />
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            <Upload className="mr-1.5 h-4 w-4" />
            {importing ? "Importing…" : "Import Vendor CSV"}
          </Button>
          <Button variant="secondary" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          { label: "Vendor Contacts", value: summary?.vendorContactCount ?? "—" },
          { label: "Emails Sent Today", value: summary ? `${summary.sentToday} / ${config?.dailyCap ?? 0}` : "—" },
          { label: "Queued", value: summary?.queuedCount ?? "—" },
          { label: "Replies", value: summary?.repliedCount ?? "—" },
          { label: "Runs", value: data?.runs.length ?? "—" },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Engine Controls</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <Button
              variant={config?.paused ? "default" : "secondary"}
              disabled={savingConfig || !config}
              onClick={() => void updateConfig({ paused: !config?.paused })}
            >
              {config?.paused ? (
                <><Play className="mr-1.5 h-4 w-4" /> Resume Engine</>
              ) : (
                <><Pause className="mr-1.5 h-4 w-4" /> Pause Engine</>
              )}
            </Button>
            {config?.paused && <Badge variant="warning">Engine paused</Badge>}
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant={config?.autoSend ? "secondary" : "default"}
              disabled={savingConfig || !config}
              onClick={() => void updateConfig({ autoSend: !config?.autoSend })}
            >
              <Send className="mr-1.5 h-4 w-4" />
              {config?.autoSend ? "Disable Auto-Send" : "Enable Auto-Send"}
            </Button>
            {config?.autoSend ? (
              <Badge variant="success">Auto-send ON</Badge>
            ) : (
              <Badge variant="info">Dry-run — matching only, no emails</Badge>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>Daily cap</span>
            <input
              type="number"
              min={0}
              max={2000}
              defaultValue={config?.dailyCap ?? 100}
              key={`cap-${config?.dailyCap}`}
              className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm"
              onBlur={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v !== config?.dailyCap) void updateConfig({ dailyCap: v });
              }}
            />
            <span className="text-slate-400">·</span>
            <span>Max vendors/run</span>
            <input
              type="number"
              min={1}
              max={500}
              defaultValue={config?.maxVendorsPerRun ?? 25}
              key={`mv-${config?.maxVendorsPerRun}`}
              className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm"
              onBlur={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v !== config?.maxVendorsPerRun) void updateConfig({ maxVendorsPerRun: v });
              }}
            />
            <span className="text-slate-400">·</span>
            <span>Cooldown (days)</span>
            <input
              type="number"
              min={0}
              max={365}
              defaultValue={config?.cooldownDays ?? 30}
              key={`cd-${config?.cooldownDays}`}
              className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm"
              onBlur={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v !== config?.cooldownDays) void updateConfig({ cooldownDays: v });
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Runs table */}
      <Card>
        <CardHeader>
          <CardTitle>Runs</CardTitle>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {loading ? (
            <p className="px-6 py-8 text-sm text-slate-500">Loading…</p>
          ) : !data || data.runs.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm font-medium text-slate-700">No runs yet</p>
              <p className="mt-1 text-sm text-slate-500">
                A run is created automatically each time a recruiter creates a submission with a
                client name. Import your vendor CSV first so the engine has contacts to match.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 w-8"></th>
                    <th className="px-4 py-3">Trigger</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Technology</th>
                    <th className="px-4 py-3 text-right">Consultants</th>
                    <th className="px-4 py-3 text-right">Vendors</th>
                    <th className="px-4 py-3 text-right">Queued</th>
                    <th className="px-4 py-3 text-right">Sent</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {data.runs.map((run) => (
                    <RunRow
                      key={run.id}
                      run={run}
                      expanded={expandedRun === run.id}
                      applications={applications[run.id]}
                      onToggle={() => void toggleRun(run.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  );
}

function RunRow({
  run,
  expanded,
  applications,
  onToggle,
}: {
  run: RunRecord;
  expanded: boolean;
  applications?: ApplicationRecord[];
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="cursor-pointer border-b border-slate-50 transition-colors hover:bg-slate-50/70"
        onClick={onToggle}
      >
        <td className="px-4 py-3 text-slate-400">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </td>
        <td className="px-4 py-3">
          <p className="font-medium text-slate-800">{run.triggerSubmissionCode ?? "—"}</p>
          <p className="text-xs text-slate-500">
            {run.triggerConsultant ?? ""}{run.triggerRecruiter ? ` · by ${run.triggerRecruiter}` : ""}
          </p>
        </td>
        <td className="px-4 py-3 font-medium text-slate-700">{run.clientName}</td>
        <td className="px-4 py-3 text-slate-600">{run.technology}</td>
        <td className="px-4 py-3 text-right tabular-nums">{run.matchedConsultants}</td>
        <td className="px-4 py-3 text-right tabular-nums">{run.vendorsFound}</td>
        <td className="px-4 py-3 text-right tabular-nums">{run.applicationCount}</td>
        <td className="px-4 py-3 text-right tabular-nums">{run.emailsSent}</td>
        <td className="px-4 py-3">{runStatusBadge(run.status)}</td>
        <td className="px-4 py-3 whitespace-nowrap text-slate-500">
          {new Date(run.createdAt).toLocaleString()}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-slate-100 bg-slate-50/50">
          <td colSpan={10} className="px-6 py-4">
            {run.note && <p className="mb-3 text-xs text-slate-500">{run.note}</p>}
            {!applications ? (
              <p className="text-sm text-slate-500">Loading applications…</p>
            ) : applications.length === 0 ? (
              <p className="text-sm text-slate-500">No applications were queued for this run.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left font-semibold uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4">Consultant</th>
                    <th className="py-2 pr-4">Vendor</th>
                    <th className="py-2 pr-4">Vendor Contact</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2">Sent At</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => (
                    <tr key={app.id} className="border-t border-slate-100">
                      <td className="py-2 pr-4 font-medium text-slate-700">{app.consultantName}</td>
                      <td className="py-2 pr-4 text-slate-600">{app.vendorCompany}</td>
                      <td className="py-2 pr-4 text-slate-600">
                        {app.vendorRecruiter ? `${app.vendorRecruiter} · ` : ""}{app.vendorEmail}
                      </td>
                      <td className="py-2 pr-4">
                        {appStatusBadge(app.emailStatus)}
                        {app.errorMessage && (
                          <span className="ml-2 text-rose-500">{app.errorMessage}</span>
                        )}
                      </td>
                      <td className="py-2 text-slate-500">
                        {app.sentAt ? new Date(app.sentAt).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
