"use client";

import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { Toast, useToast } from "@/components/ui/toast";
import { TabSearchBar } from "@/components/ui/tab-search-bar";
import { HighlightText } from "@/components/ui/highlight-text";
import { filterBySearch, searchBlob } from "@/lib/table-search";
import { cn } from "@/lib/utils";
import { RecruiterAssignedCandidates } from "./recruiter-assigned-candidates";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Loader2,
  Mail,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Users,
} from "lucide-react";
import type { Role } from "@/generated/prisma/client";

type SortDir = "asc" | "desc";

type RecruiterCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  personalPhone: string | null;
  technology: string | null;
  originalVisaStatus: string | null;
  marketingVisaStatus: string | null;
  projectStatus: string | null;
  marketingStartDate: string | null;
  submissions: Array<{
    id: string;
    submissionId: string;
    clientName: string | null;
    vendorCompany: string | null;
    createdAt: string;
    status: string;
    interviews: Array<{
      id: string;
      interviewId: string;
      createdAt: string;
      interviewStatus: string;
    }>;
  }>;
};

export type RecruiterUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
  businessNumber: string | null;
  fullAddress: string | null;
  experience: string | null;
  salary: string | null;
  bankName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  bankBranch: string | null;
  accountType: string | null;
  blackChequeDocument: string | null;
  roleId: string | null;
  startDate: Date | string | null;
  endDate: Date | string | null;
  isActive: boolean;
  role: Role | null;
  assignedCandidates: RecruiterCandidate[];
};

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function fmtDate(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { dateStyle: "medium" });
}

export function RecruiterList({
  recruiters,
  onSelect,
  onEdit,
  initialExpandedId,
  restoreFilters,
  restoreCandidateId,
  onExpandChange,
}: {
  recruiters: RecruiterUser[];
  onSelect?: (id: string) => void;
  onEdit?: (id: string) => void;
  initialExpandedId?: string;
  restoreFilters?: boolean;
  restoreCandidateId?: string;
  onExpandChange?: (id: string | null) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(initialExpandedId ?? null);
  const { toast, show, hide } = useToast();
  const [sortCol, setSortCol] = useState("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setExpandedId(initialExpandedId ?? null);
    if (initialExpandedId) {
      requestAnimationFrame(() => {
        document.getElementById(`recruiter-expanded-${initialExpandedId}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    }
  }, [initialExpandedId]);

  const toggleExpanded = (id: string) => {
    const next = expandedId === id ? null : id;
    setExpandedId(next);
    onExpandChange?.(next);
  };

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  }

  const renderSortIcon = (col: string) =>
    sortCol !== col
      ? <ChevronsUpDown className="h-3 w-3 opacity-30" />
      : sortDir === "asc"
        ? <ChevronUp className="h-3 w-3" />
        : <ChevronDown className="h-3 w-3" />;

  const filtered = useMemo(() => {
    return filterBySearch(recruiters, searchQuery, (r) => searchBlob(
      r.firstName, r.lastName, r.email, r.phoneNumber, r.businessNumber, r.role?.name,
      r.experience, r.fullAddress,
    ));
  }, [recruiters, searchQuery]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortCol) {
        case "name":   return dir * (`${a.firstName} ${a.lastName}`).localeCompare(`${b.firstName} ${b.lastName}`);
        case "email":  return dir * a.email.localeCompare(b.email);
        case "role":   return dir * (a.role?.name ?? "").localeCompare(b.role?.name ?? "");
        case "period": return dir * (new Date(a.startDate ?? 0).getTime() - new Date(b.startDate ?? 0).getTime());
        case "status": return dir * (Number(Boolean(b.isActive)) - Number(Boolean(a.isActive)));
        default: return 0;
      }
    });
  }, [filtered, sortCol, sortDir]);

  const isActive = (r: RecruiterUser) => Boolean(r.isActive);

  const toggleActive = (id: string, active: boolean) => {
    startTransition(async () => {
      await fetch(`/api/recruiters/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !active }),
      });
      router.refresh();
    });
  };

  const resendActivation = async (recruiterId: string, email: string) => {
    setResendingId(recruiterId);
    try {
      const res = await fetch("/api/recruiters/resend-activation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruiterId }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
      show(`Activation email sent to ${email}`, "success");
    } catch (err: unknown) {
      show(err instanceof Error ? err.message : "Failed to resend email", "error");
    } finally {
      setResendingId(null);
    }
  };

  const openEdit = (r: RecruiterUser) => {
    if (onEdit) onEdit(r.id);
    else onSelect?.(r.id);
  };

  const activeCount = recruiters.filter((r) => Boolean(r.isActive)).length;
  const pendingCount = recruiters.length - activeCount;

  if (recruiters.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
          <Users className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-700">No recruiters onboarded yet</p>
        <p className="text-xs text-slate-400 mt-1">Onboard your first recruiter using the button above</p>
      </div>
    );
  }

  const thCls = "px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap cursor-pointer select-none hover:bg-slate-700 transition-colors";
  const thFixed = "px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap";

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
              <Users className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">All Recruiters</h3>
              <p className="text-xs text-slate-500">
                {searchQuery ? `${sorted.length} of ${recruiters.length} shown` : `${recruiters.length} total`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:ml-auto">
            <div className="hidden sm:flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-semibold text-emerald-700">{activeCount} Active</span>
              </div>
              {pendingCount > 0 && (
                <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span className="text-xs font-semibold text-amber-700">{pendingCount} Pending</span>
                </div>
              )}
            </div>
            <TabSearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search recruiters…" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800 text-left">
                <th className={thCls} onClick={() => toggleSort("name")}>
                  <span className="flex items-center gap-1.5">Recruiter {renderSortIcon("name")}</span>
                </th>
                <th className={thCls} onClick={() => toggleSort("email")}>
                  <span className="flex items-center gap-1.5">Contact {renderSortIcon("email")}</span>
                </th>
                <th className={thCls} onClick={() => toggleSort("role")}>
                  <span className="flex items-center gap-1.5">Role {renderSortIcon("role")}</span>
                </th>
                <th className={thCls} onClick={() => toggleSort("period")}>
                  <span className="flex items-center gap-1.5">Period {renderSortIcon("period")}</span>
                </th>
                <th className={thCls} onClick={() => toggleSort("status")}>
                  <span className="flex items-center gap-1.5">Status {renderSortIcon("status")}</span>
                </th>
                <th className={thFixed}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((r) => {
                const active = isActive(r);
                const isResending = resendingId === r.id;
                const name = `${r.firstName} ${r.lastName}`;
                const isExpanded = expandedId === r.id;

                return (
                  <Fragment key={r.id}>
                    <tr className={cn("hover:bg-indigo-50/20 transition-colors", !active && "opacity-80")}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(r.id)}
                            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                            title={isExpanded ? "Collapse recruiter" : "Expand recruiter"}
                          >
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                          <div className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                            active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                          )}>
                            {initials(name)}
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => onSelect?.(r.id)}
                              className="font-semibold text-slate-900 whitespace-nowrap text-left transition-colors hover:text-emerald-600 hover:underline"
                            >
                              <HighlightText text={name} query={searchQuery} />
                            </button>
                            <p className="text-xs text-slate-500 truncate max-w-[140px]">
                              <HighlightText text={r.email} query={searchQuery} />
                            </p>
                            <p className="mt-0.5 text-[10px] font-semibold text-indigo-600">
                              {r.assignedCandidates.length} assigned candidate{r.assignedCandidates.length === 1 ? "" : "s"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                        {r.phoneNumber && (
                          <p><HighlightText text={r.phoneNumber} query={searchQuery} /></p>
                        )}
                        {r.businessNumber && (
                          <p className="text-slate-400">
                            <HighlightText text={r.businessNumber} query={searchQuery} />
                          </p>
                        )}
                        {!r.phoneNumber && !r.businessNumber && <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {r.role ? (
                          <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                            <HighlightText text={r.role.name} query={searchQuery} />
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                        <p>{fmtDate(r.startDate)}</p>
                        {r.endDate && <p className="text-slate-400">→ {fmtDate(r.endDate)}</p>}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          active ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        )}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-emerald-500" : "bg-amber-500")} />
                          {active ? "Active" : "Pending"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openEdit(r)}
                            title="Edit"
                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                          <button
                            disabled={isPending}
                            onClick={() => toggleActive(r.id, active)}
                            title={active ? "Disable" : "Enable"}
                            className={cn(
                              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                              active
                                ? "border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                                : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            )}
                          >
                            {active ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                            {active ? "Disable" : "Enable"}
                          </button>
                          <div className="relative group">
                            <button
                              disabled={active || isResending}
                              onClick={() => !active && resendActivation(r.id, r.email)}
                              title={active ? "Already activated" : "Resend activation email"}
                              className={cn(
                                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                                active
                                  ? "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                                  : "border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                              )}
                            >
                              {isResending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                              {isResending ? "Sending…" : "Resend"}
                            </button>
                            {active && (
                              <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-white whitespace-nowrap group-hover:block z-10">
                                Already activated
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr id={`recruiter-expanded-${r.id}`} className="bg-slate-50/50">
                        <td colSpan={6} className="px-5 py-4">
                          <RecruiterAssignedCandidates
                            recruiterId={r.id}
                            assignedCandidates={r.assignedCandidates}
                            variant="inline"
                            initialFiltersOpen={restoreFilters && isExpanded}
                            initialCandidateId={isExpanded ? restoreCandidateId : undefined}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
      </div>
    </>
  );
}
