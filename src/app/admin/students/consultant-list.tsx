"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { GraduationCap, Trash2, Loader2, MapPin, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

type SortDir = "asc" | "desc";

type Consultant = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  personalPhone?: string | null;
  technology?: string | null;
  visaStatus?: string | null;
  projectStatus?: string | null;
  offerLetterType?: string | null;
  workMode?: string | null;
  city?: string | null;
  state?: string | null;
  createdAt: string;
};

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

const PROJECT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "Project Started":    { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
  "Project Completed":  { bg: "bg-sky-100",     text: "text-sky-700",     dot: "bg-sky-500" },
  "Verbal Confirmation":{ bg: "bg-amber-100",   text: "text-amber-700",   dot: "bg-amber-500" },
  "Confirmation":       { bg: "bg-violet-100",  text: "text-violet-700",  dot: "bg-violet-500" },
  "In Market":          { bg: "bg-slate-100",   text: "text-slate-600",   dot: "bg-slate-400" },
};

const WORK_MODE_COLOR: Record<string, string> = {
  Remote: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Hybrid: "border-amber-200 bg-amber-50 text-amber-700",
  Onsite: "border-blue-200 bg-blue-50 text-blue-700",
};

const TECH_COLOR: Record<string, string> = {
  ".Net": "bg-purple-100 text-purple-700",
  "Java": "bg-orange-100 text-orange-700",
  "DE": "bg-cyan-100 text-cyan-700",
  "DS/GenAi/ML": "bg-pink-100 text-pink-700",
  "Devops": "bg-teal-100 text-teal-700",
  "Mainframes": "bg-slate-100 text-slate-700",
  "Networking": "bg-blue-100 text-blue-700",
  "BA": "bg-amber-100 text-amber-700",
  "Sales Force": "bg-indigo-100 text-indigo-700",
};

export function ConsultantList({ consultants }: { consultants: Consultant[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast, show, hide } = useToast();
  const [sortCol, setSortCol] = useState("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  }

  function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return <ChevronsUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  }

  const sorted = useMemo(() => {
    return [...consultants].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortCol) {
        case "name":          return dir * (`${a.firstName} ${a.lastName}`).localeCompare(`${b.firstName} ${b.lastName}`);
        case "email":         return dir * a.email.localeCompare(b.email);
        case "technology":    return dir * (a.technology ?? "").localeCompare(b.technology ?? "");
        case "visaStatus":    return dir * (a.visaStatus ?? "").localeCompare(b.visaStatus ?? "");
        case "projectStatus": return dir * (a.projectStatus ?? "").localeCompare(b.projectStatus ?? "");
        case "workMode":      return dir * (a.workMode ?? "").localeCompare(b.workMode ?? "");
        case "location":      return dir * ([a.city, a.state].filter(Boolean).join(", ")).localeCompare([b.city, b.state].filter(Boolean).join(", "));
        default: return 0;
      }
    });
  }, [consultants, sortCol, sortDir]);

  const deleteConsultant = (id: string, name: string) => {
    if (!confirm(`Remove consultant ${name}? This cannot be undone.`)) return;
    setDeletingId(id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/students/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete");
        show(`${name} removed`, "success");
        router.refresh();
      } catch {
        show("Failed to remove consultant", "error");
      } finally {
        setDeletingId(null);
      }
    });
  };

  const activeCount = consultants.filter((c) => c.projectStatus === "Project Started").length;
  const inMarketCount = consultants.filter((c) => c.projectStatus === "In Market").length;

  if (consultants.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
          <GraduationCap className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-700">No consultants onboarded yet</p>
        <p className="text-xs text-slate-400 mt-1">Add a consultant using the button above</p>
      </div>
    );
  }

  const thCls = "px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap cursor-pointer select-none hover:bg-slate-700 transition-colors";
  const thFixed = "px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50">
            <GraduationCap className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Consultants</h3>
            <p className="text-xs text-slate-500">{consultants.length} onboarded</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-emerald-700">{activeCount} On Project</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            <span className="text-xs font-semibold text-slate-600">{inMarketCount} In Market</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-left">
              <th className={thCls} onClick={() => toggleSort("name")}>
                <span className="flex items-center gap-1.5">Consultant <SortIcon col="name" /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("email")}>
                <span className="flex items-center gap-1.5">Contact <SortIcon col="email" /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("technology")}>
                <span className="flex items-center gap-1.5">Technology <SortIcon col="technology" /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("visaStatus")}>
                <span className="flex items-center gap-1.5">Visa <SortIcon col="visaStatus" /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("projectStatus")}>
                <span className="flex items-center gap-1.5">Project Status <SortIcon col="projectStatus" /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("workMode")}>
                <span className="flex items-center gap-1.5">Work Mode <SortIcon col="workMode" /></span>
              </th>
              <th className={thCls} onClick={() => toggleSort("location")}>
                <span className="flex items-center gap-1.5">Location <SortIcon col="location" /></span>
              </th>
              <th className={thFixed} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((c) => {
              const name = `${c.firstName} ${c.lastName}`;
              const projColor = PROJECT_COLORS[c.projectStatus ?? ""] ?? PROJECT_COLORS["In Market"];
              return (
                <tr key={c.id} className="hover:bg-indigo-50/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                        {initials(name)}
                      </div>
                      <p className="font-semibold text-slate-900 whitespace-nowrap">{name}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-xs text-slate-600 truncate max-w-[160px]">{c.email}</p>
                    {c.personalPhone && <p className="text-xs text-slate-400 mt-0.5">{c.personalPhone}</p>}
                  </td>
                  <td className="px-5 py-3.5">
                    {c.technology ? (
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", TECH_COLOR[c.technology] ?? "bg-slate-100 text-slate-700")}>
                        {c.technology}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {c.visaStatus ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                        {c.visaStatus}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {c.projectStatus ? (
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", projColor.bg, projColor.text)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", projColor.dot)} />
                        {c.projectStatus}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {c.workMode ? (
                      <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", WORK_MODE_COLOR[c.workMode] ?? "border-slate-200 bg-slate-50 text-slate-600")}>
                        {c.workMode}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                    {c.city || c.state ? (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        <span className="text-xs">{[c.city, c.state].filter(Boolean).join(", ")}</span>
                      </div>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      disabled={deletingId === c.id}
                      onClick={() => deleteConsultant(c.id, name)}
                      className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-colors disabled:opacity-40"
                      title="Remove consultant"
                    >
                      {deletingId === c.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  );
}
