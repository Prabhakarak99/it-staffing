"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  AudioLines,
  ExternalLink,
  Loader2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Search,
  Video,
} from "lucide-react";
import { Toast, useToast } from "@/components/ui/toast";

const AUTO_REFRESH_MS = 30_000;

interface PracticeSessionRow {
  id: string;
  sessionNumber: number;
  technologyName: string;
  assignedTranscriptTitle: string | null;
  status: "not_started" | "in_progress" | "completed";
  score: number | null;
  recordingUrl: string | null;
  recordingDriveUrl: string | null;
  recordingLocalUrl: string | null;
  hasOtterAudio: boolean;
}

interface ConsultantRow {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  technology: string | null;
  projectStatus: string | null;
  provisionedInCodeVision: boolean;
  overallStatus: "not_started" | "in_progress" | "completed";
  averageScore: number | null;
  completedCount: number;
  totalSessions: number;
  sessions: PracticeSessionRow[];
}

interface OtterStatusPayload {
  generatedAt: string;
  consultantCount: number;
  provisionedCount: number;
  recordingCount: number;
  consultants: ConsultantRow[];
}

function statusLabel(status: ConsultantRow["overallStatus"]) {
  switch (status) {
    case "completed":
      return "Completed";
    case "in_progress":
      return "In progress";
    default:
      return "Not started";
  }
}

function statusClass(status: ConsultantRow["overallStatus"]) {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-700";
    case "in_progress":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function sessionStatusClass(status: PracticeSessionRow["status"]) {
  switch (status) {
    case "completed":
      return "text-emerald-700";
    case "in_progress":
      return "text-amber-700";
    default:
      return "text-slate-500";
  }
}

export function OtterStatusView() {
  const { toast, show, hide } = useToast();
  const [payload, setPayload] = useState<OtterStatusPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const loadStatus = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? hasLoadedOnceRef.current;

    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const res = await fetch("/api/otter-status", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load Otter status");
      setPayload(data);
      hasLoadedOnceRef.current = true;
    } catch (err) {
      if (!silent) {
        show(err instanceof Error ? err.message : "Failed to load Otter status", "error");
      }
    } finally {
      if (silent) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [show]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadStatus({ silent: true });
    }, AUTO_REFRESH_MS);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadStatus({ silent: true });
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [autoRefreshEnabled, loadStatus]);

  const filteredConsultants = useMemo(() => {
    const consultants = payload?.consultants ?? [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return consultants;

    return consultants.filter((consultant) =>
      [consultant.name, consultant.email, consultant.technology ?? "", consultant.projectStatus ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [payload, query]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">Practice Monitoring</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Otter Status</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Consultant practice progress and recorded session videos from CodeVision, mapped by GFT Vision consultant profile.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isRefreshing ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Syncing…
            </span>
          ) : autoRefreshEnabled ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
              Auto-refresh every 30s
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setAutoRefreshEnabled((current) => !current)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            {autoRefreshEnabled ? (
              <>
                <PauseCircle className="h-4 w-4" />
                Pause
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4" />
                Resume
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => void loadStatus()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Consultants", value: payload?.consultantCount ?? 0 },
          { label: "Provisioned in CodeVision", value: payload?.provisionedCount ?? 0 },
          { label: "Practice recordings", value: payload?.recordingCount ?? 0 },
          {
            label: "Last synced",
            value: payload?.generatedAt
              ? new Date(payload.generatedAt).toLocaleString()
              : "—",
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="relative min-w-[240px] flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search consultant, email, technology..."
              className="w-full rounded-xl border border-slate-200 py-2 pl-10 pr-3 text-sm outline-none ring-indigo-500 focus:ring-2"
            />
          </div>
          <p className="text-sm text-slate-500">{filteredConsultants.length} consultant(s)</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading practice status...
          </div>
        ) : filteredConsultants.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-slate-500">No consultants match your search.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredConsultants.map((consultant) => {
              const isExpanded = expandedId === consultant.id;
              const recordings = consultant.sessions.filter((session) => session.recordingUrl || session.recordingDriveUrl);

              return (
                <div key={consultant.id} className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : consultant.id)}
                    className="flex w-full items-start justify-between gap-4 text-left"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-slate-900">{consultant.name}</h2>
                        <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", statusClass(consultant.overallStatus))}>
                          {statusLabel(consultant.overallStatus)}
                        </span>
                        {!consultant.provisionedInCodeVision ? (
                          <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
                            Not provisioned
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {consultant.email}
                        {consultant.technology ? ` · ${consultant.technology}` : ""}
                        {consultant.phoneNumber ? ` · ${consultant.phoneNumber}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {consultant.completedCount}/{consultant.totalSessions} sessions completed
                        {consultant.averageScore !== null ? ` · Avg score ${consultant.averageScore}` : ""}
                        {recordings.length > 0 ? ` · ${recordings.length} recording${recordings.length === 1 ? "" : "s"}` : ""}
                      </p>
                    </div>
                    <AudioLines className="mt-1 h-5 w-5 shrink-0 text-indigo-500" />
                  </button>

                  {isExpanded ? (
                    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Session</th>
                            <th className="px-4 py-3">Title</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Score</th>
                            <th className="px-4 py-3">Recording</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {consultant.sessions.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                                No practice sessions yet for this consultant&apos;s technology.
                              </td>
                            </tr>
                          ) : (
                            consultant.sessions.map((session) => (
                              <tr key={session.id}>
                                <td className="px-4 py-3 font-medium text-slate-800">#{session.sessionNumber}</td>
                                <td className="px-4 py-3 text-slate-600">
                                  {session.assignedTranscriptTitle ?? session.technologyName}
                                  {session.hasOtterAudio ? (
                                    <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                                      Otter
                                    </span>
                                  ) : null}
                                </td>
                                <td className={cn("px-4 py-3 capitalize", sessionStatusClass(session.status))}>
                                  {session.status.replace("_", " ")}
                                </td>
                                <td className="px-4 py-3 text-slate-600">{session.score ?? "—"}</td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-col gap-1.5">
                                    {session.recordingUrl ? (
                                      <a
                                        href={session.recordingUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 font-semibold text-indigo-600 hover:text-indigo-800"
                                      >
                                        <Video className="h-4 w-4" />
                                        Recording
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </a>
                                    ) : null}
                                    {session.recordingDriveUrl ? (
                                      <a
                                        href={session.recordingDriveUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 font-semibold text-violet-600 hover:text-violet-800"
                                      >
                                        <AudioLines className="h-4 w-4" />
                                        Otter
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </a>
                                    ) : null}
                                    {!session.recordingUrl && !session.recordingDriveUrl ? (
                                      <span className="text-slate-400">No recording yet</span>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast ? <Toast message={toast.message} type={toast.type} onClose={hide} /> : null}
    </div>
  );
}
