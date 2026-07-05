"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarRange, Loader2, Search, UserSearch, X } from "lucide-react";

const VISA_OPTIONS = ["F1", "Initial OPT", "Stem OPT", "CPT", "H1B", "H4Ead", "GC", "TN", "U", "Citizen"];

interface Recruiter {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Props {
  consultantName: string;
  originalVisaStatus?: string | null;
  currentMarketingVisaStatus?: string | null;
  open: boolean;
  isPending?: boolean;
  onClose: () => void;
  onConfirm: (data: { marketingStartDate: string; recruiterId: string; recruiterName: string; marketingVisaStatus: string }) => void;
}

export function PreMarketingCompleteModal({
  consultantName,
  originalVisaStatus,
  currentMarketingVisaStatus,
  open,
  isPending,
  onClose,
  onConfirm,
}: Props) {
  const [marketingStartDate, setMarketingStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [marketingVisaStatus, setMarketingVisaStatus] = useState(currentMarketingVisaStatus ?? "");
  const [recruiterId, setRecruiterId] = useState("");
  const [recruiterName, setRecruiterName] = useState("");
  const [recruiterQuery, setRecruiterQuery] = useState("");
  const [recruiterResults, setRecruiterResults] = useState<Recruiter[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [errors, setErrors] = useState<{ date?: string; recruiter?: string; visa?: string }>({});
  const recruiterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (recruiterRef.current && !recruiterRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!recruiterQuery.trim()) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/recruiters/search?q=${encodeURIComponent(recruiterQuery)}`);
        if (res.ok) {
          setRecruiterResults(await res.json());
          setShowDropdown(true);
        }
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [recruiterQuery]);

  if (!open) return null;

  const submit = () => {
    const nextErrors: { date?: string; recruiter?: string; visa?: string } = {};
    if (!marketingStartDate) nextErrors.date = "Required";
    if (!marketingVisaStatus) nextErrors.visa = "Required";
    if (!recruiterId) nextErrors.recruiter = "Required";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    onConfirm({ marketingStartDate, recruiterId, recruiterName, marketingVisaStatus });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-t-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4 text-white">
          <h3 className="text-base font-bold">Move to In-Market</h3>
          <p className="mt-1 text-xs text-emerald-100">
            All checklist items are complete for <span className="font-semibold">{consultantName}</span>.
          </p>
        </div>

        <div className="space-y-4 p-5">
          {originalVisaStatus && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Original Visa</p>
              <p className="mt-0.5 text-sm font-semibold text-amber-900">{originalVisaStatus}</p>
            </div>
          )}

          <Input
            compact
            id="pm-start-date"
            label="Marketing Start Date *"
            type="date"
            value={marketingStartDate}
            onChange={(e) => setMarketingStartDate(e.target.value)}
            error={errors.date}
          />

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Marketing Visa *
            </label>
            <select
              value={marketingVisaStatus}
              onChange={(e) => setMarketingVisaStatus(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
            >
              <option value="">Select marketing visa</option>
              {VISA_OPTIONS.map((visa) => (
                <option key={visa} value={visa}>{visa === "H4Ead" ? "H4 EAD" : visa}</option>
              ))}
            </select>
            {errors.visa && <p className="text-[10px] font-medium text-rose-500">{errors.visa}</p>}
          </div>

          <div ref={recruiterRef} className="relative">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Recruiter Name *
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={recruiterQuery}
                onChange={(e) => {
                  setRecruiterQuery(e.target.value);
                  setRecruiterId("");
                  setRecruiterName("");
                  if (!e.target.value.trim()) {
                    setRecruiterResults([]);
                    setShowDropdown(false);
                  }
                }}
                placeholder="Search recruiter..."
                className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-8 text-xs focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
              />
              {searching && <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-400" />}
              {recruiterId && !searching && (
                <button type="button" onClick={() => { setRecruiterId(""); setRecruiterName(""); setRecruiterQuery(""); setRecruiterResults([]); setShowDropdown(false); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {errors.recruiter && <p className="mt-1 text-[10px] font-medium text-rose-500">{errors.recruiter}</p>}
            {showDropdown && recruiterResults.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                {recruiterResults.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-indigo-50"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setRecruiterId(r.id);
                        setRecruiterName(`${r.firstName} ${r.lastName}`);
                        setRecruiterQuery(`${r.firstName} ${r.lastName}`);
                        setShowDropdown(false);
                      }}
                    >
                      <UserSearch className="h-3.5 w-3.5 text-rose-500" />
                      <span className="font-semibold text-slate-800">{r.firstName} {r.lastName}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarRange className="h-4 w-4" />}
            Confirm & Move to In-Market
          </Button>
        </div>
      </div>
    </div>
  );
}
