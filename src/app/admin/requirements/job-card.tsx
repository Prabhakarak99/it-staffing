"use client";

import { cn } from "@/lib/utils";
import { MapPin, Mail, Phone, ExternalLink, Calendar, Wifi, DollarSign, Building2, Trash2 } from "lucide-react";
import type { JobResult } from "./job-detail-modal";

const SOURCE_STYLE: Record<string, string> = {
  LinkedIn: "bg-blue-100 text-blue-700 border-blue-200",
  Indeed:   "bg-indigo-100 text-indigo-700 border-indigo-200",
  Google:   "bg-red-100 text-red-700 border-red-200",
};

const JOB_TYPE_STYLE: Record<string, string> = {
  "C2C":     "bg-emerald-100 text-emerald-700 border-emerald-200",
  "C2C/W2":  "bg-teal-100 text-teal-700 border-teal-200",
  "W2":      "bg-sky-100 text-sky-700 border-sky-200",
  "1099":    "bg-violet-100 text-violet-700 border-violet-200",
  "Contract":"bg-amber-100 text-amber-700 border-amber-200",
};

function fmtDate(d: string | null) {
  if (!d) return null;
  const date = new Date(d);
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface Props {
  job: JobResult;
  onClick: () => void;
  onDelete: () => void;
}

export function JobCard({ job, onClick, onDelete }: Props) {
  const jobType = job.jobType ?? "Contract";
  const isC2C = jobType.includes("C2C");

  return (
    <div
      className={cn(
        "group relative rounded-2xl border bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 overflow-hidden cursor-pointer",
        isC2C ? "border-emerald-200" : "border-slate-200"
      )}
      onClick={onClick}
    >
      {/* C2C accent bar */}
      {isC2C && <div className="absolute left-0 top-0 h-full w-[3px] bg-emerald-500 rounded-l-2xl" />}

      <div className="p-5 pl-6">
        {/* Top badges */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold", JOB_TYPE_STYLE[jobType] ?? JOB_TYPE_STYLE.Contract)}>
            {jobType}
          </span>
          <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold", SOURCE_STYLE[job.source] ?? "bg-slate-100 text-slate-700")}>
            {job.source}
          </span>
          {job.technology && (
            <span className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-bold text-cyan-700">
              {job.technology}
            </span>
          )}
          {job.isRemote && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              <Wifi className="h-2.5 w-2.5" /> Remote
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-[14px] font-bold text-slate-900 leading-snug mb-1 line-clamp-2">
          {job.title ?? "Untitled Position"}
        </h3>

        {/* Vendor */}
        {job.vendorName && (
          <div className="flex items-center gap-1.5 mb-2">
            <Building2 className="h-3 w-3 shrink-0 text-blue-500" />
            <p className="text-[12px] font-semibold text-blue-600 truncate">{job.vendorName}</p>
          </div>
        )}

        {/* Description */}
        {job.jobDescription && (
          <p className="text-[12px] leading-relaxed text-slate-500 line-clamp-3 mb-3">
            {job.jobDescription}
          </p>
        )}

        {/* Contact row */}
        {(job.vendorEmail || job.vendorPhone) && (
          <div className="flex flex-wrap items-center gap-3 mb-3">
            {job.vendorEmail && (
              <a href={`mailto:${job.vendorEmail}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline truncate max-w-[180px]">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{job.vendorEmail}</span>
              </a>
            )}
            {job.vendorPhone && (
              <a href={`tel:${job.vendorPhone}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline">
                <Phone className="h-3 w-3 shrink-0" />
                {job.vendorPhone}
              </a>
            )}
          </div>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            {job.location && (
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <MapPin className="h-3 w-3" />{job.location}
              </span>
            )}
            {(job.rateMin ?? job.rateMax) && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                <DollarSign className="h-3 w-3" />
                {job.rateMin}{job.rateMax ? `–$${job.rateMax}` : ""}/hr
              </span>
            )}
            {job.datePosted && (
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <Calendar className="h-3 w-3" />{fmtDate(job.datePosted)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {job.applyLink && (
              <a href={job.applyLink} target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-700 hover:bg-cyan-100 transition-colors">
                <ExternalLink className="h-3 w-3" /> Apply
              </a>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-colors"
              title="Remove job">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
