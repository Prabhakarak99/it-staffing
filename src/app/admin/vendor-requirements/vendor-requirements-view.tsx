"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Mail, Phone, Search, Users2, FileText, Plus } from "lucide-react";
import { Header } from "@/components/layout/header";
import { cn } from "@/lib/utils";
import { APP_TZ } from "@/lib/tz";

export interface VendorSuggestion {
  id: string;
  consultantName: string;
  recruiterName: string;
  technology: string;
  jobDescription: string | null;
  implementationPartner: string;
  clientName: string | null;
  sourceVendor: string;
  vendorCompany: string;
  vendorContactName: string;
  vendorContactEmail: string;
  vendorContactPhone: string;
  pastSubmissions: number;
  lastUsed: string;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { timeZone: APP_TZ, month: "short", day: "numeric", year: "numeric" });

export function VendorRequirementsView({ today, suggestions, sourceCount }: {
  today: string; suggestions: VendorSuggestion[]; sourceCount: number;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suggestions;
    return suggestions.filter((s) =>
      [s.consultantName, s.technology, s.implementationPartner, s.clientName, s.vendorCompany, s.vendorContactName, s.vendorContactEmail, s.jobDescription]
        .some((f) => f?.toLowerCase().includes(q)),
    );
  }, [query, suggestions]);

  const partnerCount = new Set(suggestions.map((s) => s.implementationPartner.toLowerCase())).size;
  const vendorCount = new Set(suggestions.map((s) => s.vendorCompany.toLowerCase())).size;
  const th = "px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap";

  return (
    <>
      <Header title="Vendor Requirements" subtitle="Other vendors that work with today's implementation partners" />
      <div className="p-6 space-y-5">

        {/* ── Summary ── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Today's Submissions", value: sourceCount, color: "text-sky-700" },
            { label: "Implementation Partners", value: partnerCount, color: "text-indigo-700" },
            { label: "Suggested Vendors", value: vendorCount, color: "text-violet-700" },
            { label: "Possible Submissions", value: suggestions.length, color: "text-emerald-700" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className={cn("text-[22px] font-bold tabular-nums leading-none", color)}>{value}</p>
              <p className="mt-1 text-[11px] font-medium text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Table ── */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
              <Building2 className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-slate-900">Possible Submissions</p>
              <p className="text-[11px] text-slate-400">
                Vendors from past submissions with the same implementation partner, excluding vendors the consultant was already submitted to
              </p>
            </div>
            <div className="relative ml-auto w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search consultant, partner, vendor…"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-[12px] text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          {suggestions.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <Users2 className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              <p className="text-[13px] font-semibold text-slate-500">
                {sourceCount === 0 ? "No submissions with an implementation partner today" : "No other vendors found for today's implementation partners"}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Suggestions appear when a submission today names an implementation partner that other vendors have worked with before
              </p>
              <Link href="/admin/submissions" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-[12px] font-bold text-white hover:bg-sky-600 transition-colors">
                <Plus className="h-3.5 w-3.5" /> New Submission
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-800">
                    <th className={th}>Date</th>
                    <th className={th}>Consultant</th>
                    <th className={th}>Technology</th>
                    <th className={th}>Job Description</th>
                    <th className={th}>Implementation Partner</th>
                    <th className={th}>Vendor</th>
                    <th className={th}>Vendor Contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((s) => (
                    <tr key={s.id} className="align-top hover:bg-indigo-50/20 transition-colors">
                      <td className="px-4 py-3 text-[12px] text-slate-600 whitespace-nowrap">{fmtDate(today)}</td>
                      <td className="px-4 py-3">
                        <p className="text-[12px] font-semibold text-slate-800 whitespace-nowrap">{s.consultantName}</p>
                        <p className="text-[10px] text-slate-400 whitespace-nowrap">Recruiter: {s.recruiterName}</p>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-slate-700 whitespace-nowrap">{s.technology}</td>
                      <td className="px-4 py-3 min-w-[240px] max-w-[360px]">
                        {s.jobDescription ? (
                          <details className="group">
                            <summary className="cursor-pointer list-none text-[12px] text-slate-600">
                              <span className="line-clamp-2 group-open:hidden">{s.jobDescription}</span>
                              <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600">
                                <FileText className="h-3 w-3" />
                                <span className="group-open:hidden">Show full JD</span>
                                <span className="hidden group-open:inline">Hide JD</span>
                              </span>
                            </summary>
                            <p className="mt-1 whitespace-pre-wrap text-[12px] text-slate-600">{s.jobDescription}</p>
                          </details>
                        ) : (
                          <span className="text-[12px] text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[12px] font-semibold text-slate-800 whitespace-nowrap">{s.implementationPartner}</p>
                        {s.clientName && <p className="text-[10px] text-slate-400 whitespace-nowrap">Client: {s.clientName}</p>}
                        <p className="text-[10px] text-slate-400 whitespace-nowrap">Today via {s.sourceVendor}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[12px] font-semibold text-slate-800 whitespace-nowrap">{s.vendorCompany}</p>
                        <p className="text-[10px] text-slate-400 whitespace-nowrap">
                          {s.pastSubmissions} past submission{s.pastSubmissions === 1 ? "" : "s"} · last {fmtDate(s.lastUsed)}
                        </p>
                      </td>
                      <td className="px-4 py-3 space-y-0.5">
                        <p className="text-[12px] font-semibold text-slate-800 whitespace-nowrap">{s.vendorContactName}</p>
                        {s.vendorContactEmail && (
                          <a href={`mailto:${s.vendorContactEmail}`} className="flex items-center gap-1 text-[11px] text-indigo-600 hover:underline whitespace-nowrap">
                            <Mail className="h-3 w-3" /> {s.vendorContactEmail}
                          </a>
                        )}
                        {s.vendorContactPhone && (
                          <a href={`tel:${s.vendorContactPhone}`} className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 whitespace-nowrap">
                            <Phone className="h-3 w-3" /> {s.vendorContactPhone}
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-[12px] text-slate-400">No matches for “{query}”</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
