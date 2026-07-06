"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  PREMARKETING_CHECKLIST_ITEMS,
  CHECKLIST_RATINGS,
  CHECKLIST_RATING_COLORS,
  type PreMarketingChecklist,
  type PreMarketingChecklistKey,
  type ChecklistRating,
  checklistProgress,
  normalizeChecklist,
} from "@/lib/premarketing-checklist";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Loader2, Save, Send } from "lucide-react";
import { TabSearchBar } from "@/components/ui/tab-search-bar";
import { HighlightText } from "@/components/ui/highlight-text";
import { filterBySearch, searchBlob } from "@/lib/table-search";
import { PreMarketingCompleteModal } from "./premarketing-complete-modal";

export interface PreMarketingBoardRecord {
  consultant: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    technology: string | null;
    originalVisaStatus: string | null;
    projectStatus: string | null;
  };
  consultantComment: string;
  record: {
    id: string;
    checklist: PreMarketingChecklist;
    marketingVisaStatus: string | null;
    marketingStartDate: string | null;
    marketingEndDate: string | null;
    recruiter: { id: string; firstName: string; lastName: string; email: string } | null;
    updatedAt: string;
  } | null;
  progress: {
    completed: number;
    total: number;
    badCount: number;
    isComplete: boolean;
    readyForMarketing: boolean;
  };
}

export function PreMarketingChecklistBoard({ records: initialRecords }: { records: PreMarketingBoardRecord[] }) {
  const router = useRouter();
  const [records, setRecords] = useState(initialRecords);
  const [expandedId, setExpandedId] = useState<string | null>(initialRecords[0]?.consultant.id ?? null);
  const [drafts, setDrafts] = useState<Record<string, PreMarketingChecklist>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [completingRecord, setCompletingRecord] = useState<PreMarketingBoardRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [, startTransition] = useTransition();
  const { toast, show, hide } = useToast();
  const rowRefs = useRef<Record<string, Partial<Record<PreMarketingChecklistKey, HTMLDivElement | null>>>>({});

  const getDraft = (item: PreMarketingBoardRecord) =>
    drafts[item.consultant.id] ?? normalizeChecklist(item.record?.checklist);

  const getCommentDraft = (item: PreMarketingBoardRecord) =>
    commentDrafts[item.consultant.id] ?? item.consultantComment ?? "";

  const setDraftItem = (
    consultantId: string,
    item: PreMarketingBoardRecord,
    key: PreMarketingChecklistKey,
    patch: Partial<PreMarketingChecklist[PreMarketingChecklistKey]>
  ) => {
    const current = getDraft(item);
    setDrafts((prev) => ({
      ...prev,
      [consultantId]: {
        ...current,
        [key]: { ...current[key], ...patch },
      },
    }));
  };

  const summary = useMemo(() => {
    const complete = records.filter((r) => r.progress.readyForMarketing).length;
    return { total: records.length, complete };
  }, [records]);

  const visibleRecords = useMemo(() => {
    return filterBySearch(records, searchQuery, (item) => searchBlob(
      item.consultant.firstName, item.consultant.lastName, item.consultant.email,
      item.consultant.technology, item.consultant.originalVisaStatus, item.consultantComment,
      item.record?.recruiter?.firstName, item.record?.recruiter?.lastName,
    ));
  }, [records, searchQuery]);

  const focusFirstBadItem = (consultantId: string, checklist: PreMarketingChecklist) => {
    const badItem = PREMARKETING_CHECKLIST_ITEMS.find((item) => checklist[item.key]?.status === "Bad");
    if (!badItem) return;
    const row = rowRefs.current[consultantId]?.[badItem.key];
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
    row?.focus({ preventScroll: true });
  };

  const saveChecklist = (item: PreMarketingBoardRecord, openCompleteOnSuccess = false) => {
    const consultantId = item.consultant.id;
    const checklist = getDraft(item);
    const consultantComment = getCommentDraft(item);
    const progress = checklistProgress(checklist);

    if (openCompleteOnSuccess && !progress.isComplete) {
      show("Rate every checklist item before starting marketing.", "error");
      return;
    }

    if (openCompleteOnSuccess && progress.badCount > 0) {
      focusFirstBadItem(consultantId, checklist);
      show(`${progress.badCount} item(s) marked Bad — review notes, then continue when ready.`, "error");
    }

    setSavingId(consultantId);
    startTransition(async () => {
      try {
        const res = await fetch("/api/premarketing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ consultantId, checklist, consultantComment }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to save checklist");

        const updatedRecord: PreMarketingBoardRecord = {
          consultant: item.consultant,
          consultantComment: data.consultantComment ?? consultantComment.trim(),
          record: {
            id: data.record.id,
            checklist: data.record.checklist,
            marketingVisaStatus: data.record.marketingVisaStatus,
            marketingStartDate: data.record.marketingStartDate,
            marketingEndDate: data.record.marketingEndDate,
            recruiter: data.record.recruiter,
            updatedAt: data.record.updatedAt,
          },
          progress: data.progress,
        };

        setRecords((prev) => prev.map((r) => (r.consultant.id === consultantId ? updatedRecord : r)));
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[consultantId];
          return next;
        });
        setCommentDrafts((prev) => {
          const next = { ...prev };
          delete next[consultantId];
          return next;
        });

        if (openCompleteOnSuccess && progress.isComplete) {
          setCompletingRecord(updatedRecord);
          show(
            progress.badCount > 0
              ? "Checklist saved with Bad items noted. Complete marketing handoff when ready."
              : "Checklist saved. Complete marketing handoff details.",
            progress.badCount > 0 ? "error" : "success"
          );
        } else {
          show(`Saved checklist for ${item.consultant.firstName} ${item.consultant.lastName}`, "success");
        }
      } catch (err) {
        show(err instanceof Error ? err.message : "Failed to save checklist", "error");
      } finally {
        setSavingId(null);
      }
    });
  };

  const saveConsultantComment = (item: PreMarketingBoardRecord) => {
    const consultantId = item.consultant.id;
    const consultantComment = getCommentDraft(item);

    setSavingId(consultantId);
    startTransition(async () => {
      try {
        const res = await fetch("/api/premarketing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ consultantId, consultantComment }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to save consultant comment");

        const updatedRecord: PreMarketingBoardRecord = {
          ...item,
          consultantComment: data.consultantComment ?? consultantComment.trim(),
          record: item.record
            ? {
                ...item.record,
                checklist: data.record?.checklist ?? item.record.checklist,
                marketingVisaStatus: data.record?.marketingVisaStatus ?? item.record.marketingVisaStatus,
                marketingStartDate: data.record?.marketingStartDate ?? item.record.marketingStartDate,
                marketingEndDate: data.record?.marketingEndDate ?? item.record.marketingEndDate,
                recruiter: data.record?.recruiter ?? item.record.recruiter,
                updatedAt: data.record?.updatedAt ?? item.record.updatedAt,
              }
            : data.record
              ? {
                  id: data.record.id,
                  checklist: data.record.checklist,
                  marketingVisaStatus: data.record.marketingVisaStatus,
                  marketingStartDate: data.record.marketingStartDate,
                  marketingEndDate: data.record.marketingEndDate,
                  recruiter: data.record.recruiter,
                  updatedAt: data.record.updatedAt,
                }
              : null,
          progress: data.progress ?? item.progress,
        };

        setRecords((prev) => prev.map((r) => (r.consultant.id === consultantId ? updatedRecord : r)));
        setCommentDrafts((prev) => {
          const next = { ...prev };
          delete next[consultantId];
          return next;
        });
        show(`Saved consultant comment for ${item.consultant.firstName} ${item.consultant.lastName}`, "success");
      } catch (err) {
        show(err instanceof Error ? err.message : "Failed to save consultant comment", "error");
      } finally {
        setSavingId(null);
      }
    });
  };

  const completeHandoff = (data: { marketingStartDate: string; recruiterId: string; marketingVisaStatus: string }) => {
    if (!completingRecord?.record?.id) return;
    const recordId = completingRecord.record.id;
    const consultantName = `${completingRecord.consultant.firstName} ${completingRecord.consultant.lastName}`;

    setSavingId(completingRecord.consultant.id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/premarketing/${recordId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Failed to complete pre-marketing");

        setRecords((prev) => prev.filter((r) => r.consultant.id !== completingRecord.consultant.id));
        setCompletingRecord(null);
        if (expandedId === completingRecord.consultant.id) setExpandedId(null);
        show(`${consultantName} moved to In-Market`, "success");
        router.refresh();
      } catch (err) {
        show(err instanceof Error ? err.message : "Failed to complete pre-marketing", "error");
      } finally {
        setSavingId(null);
      }
    });
  };

  if (records.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <Send className="mx-auto mb-3 h-8 w-8 text-slate-300" />
        <p className="text-sm font-semibold text-slate-700">No consultants in Pre-Marketing</p>
        <p className="mt-1 text-xs text-slate-400">
          Set a consultant&apos;s Project Status to &quot;Pre-Marketing&quot; in the Consultants tab to track them here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
          {summary.total} in Pre-Marketing
        </span>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
          {summary.complete} ready for marketing
        </span>
        {searchQuery && (
          <span className="text-xs text-slate-500">{visibleRecords.length} of {records.length} shown</span>
        )}
        </div>
        <TabSearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search pre-marketing…" />
      </div>

      <div className="space-y-3">
        {visibleRecords.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            No consultants match your search.
          </div>
        ) : visibleRecords.map((item) => {
          const consultantId = item.consultant.id;
          const isExpanded = expandedId === consultantId;
          const draft = getDraft(item);
          const progress = checklistProgress(draft);
          const name = `${item.consultant.firstName} ${item.consultant.lastName}`;
          const isSaving = savingId === consultantId;

          return (
            <div key={consultantId} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : consultantId)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
              >
                {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-slate-900">
                      <HighlightText text={name} query={searchQuery} />
                    </p>
                    {item.consultant.technology && (
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                        <HighlightText text={item.consultant.technology} query={searchQuery} />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{item.consultant.email}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {item.consultant.originalVisaStatus && (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        Original Visa: {item.consultant.originalVisaStatus}
                      </span>
                    )}
                    {item.record?.marketingVisaStatus && (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        Marketing Visa: {item.record.marketingVisaStatus}
                      </span>
                    )}
                  </div>
                </div>
                <div className="hidden sm:block min-w-[120px]">
                  <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
                    <span>Progress</span>
                    <span className="font-semibold">{progress.completed}/{progress.total}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        progress.readyForMarketing ? "bg-emerald-500" : progress.badCount > 0 ? "bg-rose-400" : "bg-amber-400"
                      )}
                      style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
                {progress.readyForMarketing && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> Ready
                  </span>
                )}
                {progress.badCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                    <AlertTriangle className="h-3 w-3" /> {progress.badCount} Bad
                  </span>
                )}
              </button>

              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50/60 p-4">
                  <div className="mb-3 rounded-lg border border-slate-200 bg-white p-3">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Consultant Comment
                      </label>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isSaving}
                        onClick={() => saveConsultantComment(item)}
                        className="h-7 px-2.5 text-[11px]"
                      >
                        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Save Comment
                      </Button>
                    </div>
                    <textarea
                      value={getCommentDraft(item)}
                      onChange={(e) =>
                        setCommentDrafts((prev) => ({
                          ...prev,
                          [consultantId]: e.target.value,
                        }))
                      }
                      rows={3}
                      placeholder="Add a consultant-level note for the Consultants tab..."
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
                    />
                  </div>

                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <div className="grid grid-cols-[minmax(0,1fr)_120px_minmax(180px,1fr)] border-b border-slate-200 bg-slate-800 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
                      <div className="px-4 py-2">Checklist Item</div>
                      <div className="border-l border-slate-700 px-3 py-2 text-center">Status</div>
                      <div className="border-l border-slate-700 px-3 py-2">Note</div>
                    </div>
                    <div className="max-h-[52vh] overflow-y-auto">
                      {PREMARKETING_CHECKLIST_ITEMS.map((row, index) => {
                        const entry = draft[row.key];
                        const status = entry?.status ?? null;
                        const ratingStyle = status ? CHECKLIST_RATING_COLORS[status] : null;
                        const isBad = status === "Bad";

                        return (
                          <div
                            key={row.key}
                            ref={(el) => {
                              if (!rowRefs.current[consultantId]) rowRefs.current[consultantId] = {};
                              rowRefs.current[consultantId][row.key] = el;
                            }}
                            tabIndex={isBad ? -1 : undefined}
                            className={cn(
                              "grid grid-cols-[minmax(0,1fr)_120px_minmax(180px,1fr)] border-b border-slate-100 text-sm transition-colors",
                              isBad && "bg-rose-50/80 ring-1 ring-inset ring-rose-200",
                              status && !isBad && ratingStyle?.bg
                            )}
                          >
                            <div className="flex items-center gap-3 px-4 py-2.5">
                              <span className="w-5 shrink-0 text-xs font-semibold text-slate-400">{index + 1}</span>
                              <span className="text-xs font-medium text-slate-700">{row.label}</span>
                            </div>
                            <div className="flex items-center border-l border-slate-100 px-2 py-2">
                              <select
                                value={status ?? ""}
                                onChange={(e) => {
                                  const nextStatus = (e.target.value || null) as ChecklistRating | null;
                                  setDraftItem(consultantId, item, row.key, { status: nextStatus });
                                }}
                                className={cn(
                                  "h-8 w-full rounded-lg border bg-white px-2 text-xs font-semibold focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20",
                                  ratingStyle ? `${ratingStyle.border} ${ratingStyle.text}` : "border-slate-200 text-slate-500"
                                )}
                              >
                                <option value="">Select…</option>
                                {CHECKLIST_RATINGS.map((rating) => (
                                  <option key={rating} value={rating}>{rating}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-center border-l border-slate-100 px-2 py-2">
                              <input
                                type="text"
                                value={entry?.note ?? ""}
                                onChange={(e) => setDraftItem(consultantId, item, row.key, { note: e.target.value })}
                                placeholder={isBad ? "Why is this Bad?" : "Optional note"}
                                className={cn(
                                  "h-8 w-full rounded-lg border bg-white px-2.5 text-xs placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20",
                                  isBad ? "border-rose-300 ring-1 ring-rose-100" : "border-slate-200"
                                )}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-slate-500">
                      {progress.completed} of {progress.total} rated
                      {progress.readyForMarketing && " · All rated Good or better"}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isSaving}
                        onClick={() => saveChecklist(item, false)}
                      >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save Progress
                      </Button>
                      <Button
                        size="sm"
                        disabled={isSaving}
                        onClick={() => saveChecklist(item, true)}
                      >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Start Marketing
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <PreMarketingCompleteModal
        key={completingRecord?.consultant.id ?? "closed"}
        open={!!completingRecord}
        consultantName={completingRecord ? `${completingRecord.consultant.firstName} ${completingRecord.consultant.lastName}` : ""}
        originalVisaStatus={completingRecord?.consultant.originalVisaStatus}
        currentMarketingVisaStatus={completingRecord?.record?.marketingVisaStatus ?? null}
        isPending={!!savingId}
        onClose={() => setCompletingRecord(null)}
        onConfirm={completeHandoff}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </>
  );
}
