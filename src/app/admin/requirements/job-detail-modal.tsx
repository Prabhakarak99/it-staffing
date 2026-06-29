"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  X, MapPin, Mail, Phone, ExternalLink, Calendar, Building2,
  Briefcase, DollarSign, Wifi, Shield, Tag, Globe, Clock,
} from "lucide-react";

export interface JobResult {
  id: string;
  title: string | null;
  technology: string | null;
  technologies: string[];
  source: string;
  vendorName: string | null;
  vendorEmail: string | null;
  vendorPhone: string | null;
  location: string | null;
  isRemote: boolean;
  jobDescription: string | null;
  clientName: string | null;
  jobType: string | null;
  rateMin: number | null;
  rateMax: number | null;
  visaRequirements: string[];
  applyLink: string | null;
  datePosted: string | null;
  dateScraped: string;
}

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
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface Props { job: JobResult; onClose: () => void; }

export function JobDetailModal({ job, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  const jobTypeParts = (job.jobType ?? "Contract").split("/");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 px-6 py-5 shrink-0">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
          <div className="absolute -left-4 bottom-0 h-16 w-16 rounded-full bg-white/5" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {jobTypeParts.map((t) => (
                  <span key={t} className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold", JOB_TYPE_STYLE[t] ?? JOB_TYPE_STYLE.Contract)}>{t}</span>
                ))}
                <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold", SOURCE_STYLE[job.source] ?? "bg-slate-100 text-slate-700")}>{job.source}</span>
                {job.isRemote && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100/80 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                    <Wifi className="h-3 w-3" /> Remote
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-white leading-snug">{job.title ?? "Untitled Position"}</h2>
              {job.vendorName && <p className="mt-1 text-sm text-white/75">{job.vendorName}</p>}
            </div>
            <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white hover:bg-white/25 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Key info grid */}
          <div className="grid grid-cols-2 gap-0 divide-x divide-y divide-slate-100 border-b border-slate-100 sm:grid-cols-4">
            {[
              { icon: MapPin, label: "Location", value: job.location ?? "—" },
              { icon: DollarSign, label: "Rate", value: job.rateMin ? `$${job.rateMin}${job.rateMax ? `–$${job.rateMax}` : ""}/hr` : "—" },
              { icon: Calendar, label: "Posted", value: fmtDate(job.datePosted) },
              { icon: Clock, label: "Scraped", value: fmtDate(job.dateScraped) },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="px-5 py-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="h-3.5 w-3.5 text-slate-400" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
                </div>
                <p className="text-[13px] font-semibold text-slate-800">{value}</p>
              </div>
            ))}
          </div>

          <div className="p-6 space-y-5">
            {/* Contact */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Vendor Contact</span>
              </div>
              <div className="p-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase text-slate-400">Company</p>
                  <p className="mt-0.5 text-[13px] font-semibold text-blue-700">{job.vendorName ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-slate-400">Email</p>
                  {job.vendorEmail
                    ? <a href={`mailto:${job.vendorEmail}`} className="mt-0.5 flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:underline"><Mail className="h-3 w-3" />{job.vendorEmail}</a>
                    : <p className="mt-0.5 text-[13px] text-slate-400">—</p>}
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-slate-400">Phone</p>
                  {job.vendorPhone
                    ? <a href={`tel:${job.vendorPhone}`} className="mt-0.5 flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:underline"><Phone className="h-3 w-3" />{job.vendorPhone}</a>
                    : <p className="mt-0.5 text-[13px] text-slate-400">—</p>}
                </div>
              </div>
            </div>

            {/* Job details */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 flex items-center gap-2">
                <Briefcase className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Job Details</span>
              </div>
              <div className="p-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase text-slate-400">Client</p>
                  <p className="mt-0.5 text-[13px] font-semibold text-slate-800">{job.clientName ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-slate-400">Job Type</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {jobTypeParts.map((t) => (
                      <span key={t} className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", JOB_TYPE_STYLE[t] ?? JOB_TYPE_STYLE.Contract)}>{t}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-slate-400">Remote</p>
                  <p className="mt-0.5 text-[13px] font-semibold text-slate-800">{job.isRemote ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-slate-400">Primary Tech</p>
                  <p className="mt-0.5 text-[13px] font-semibold text-slate-800">{job.technology ?? "—"}</p>
                </div>
              </div>
            </div>

            {/* Tech skills */}
            {job.technologies.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="h-3.5 w-3.5 text-slate-400" />
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Tech Skills</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {job.technologies.map((t) => (
                    <span key={t} className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-700">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Visa requirements */}
            {job.visaRequirements.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-3.5 w-3.5 text-slate-400" />
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Visa Requirements</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {job.visaRequirements.map((v) => (
                    <span key={v} className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">{v}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {job.jobDescription && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="h-3.5 w-3.5 text-slate-400" />
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Job Description</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 max-h-64 overflow-y-auto">
                  <p className="text-[13px] leading-relaxed text-slate-700 whitespace-pre-wrap">{job.jobDescription}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="shrink-0 border-t border-slate-100 bg-slate-50 px-6 py-4 flex items-center justify-between gap-3">
          <button onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
            Close
          </button>
          <div className="flex items-center gap-2">
            {job.vendorEmail && (
              <a href={`mailto:${job.vendorEmail}`}
                className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-[13px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors">
                <Mail className="h-3.5 w-3.5" /> Email Vendor
              </a>
            )}
            {job.applyLink && (
              <a href={job.applyLink} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-cyan-700 transition-colors">
                <ExternalLink className="h-3.5 w-3.5" /> Apply Now
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
