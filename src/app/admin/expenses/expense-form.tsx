"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { DollarSign, Loader2, Search, X, Upload } from "lucide-react";

const CATEGORIES = [
  "Travel", "Food & Meals", "Accommodation", "Office Supplies",
  "Training", "Communication", "Software", "Other",
].map((c) => ({ value: c, label: c }));

const LOCATIONS = [
  { value: "Onsite", label: "Onsite" },
  { value: "Offshore", label: "Offshore" },
];

const STATUSES = [
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
];

interface Person {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

const EMPTY = {
  date: "",
  submittedById: "",
  submittedByName: "",
  consultantId: "",
  consultantName: "",
  category: "",
  description: "",
  amount: "",
  location: "",
  status: "Pending",
  notes: "",
};

export function ExpenseForm() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof EMPTY | "receiptFile", string>>>({});
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast, show, hide } = useToast();
  const router = useRouter();

  // Submitter search
  const [submitterQuery, setSubmitterQuery] = useState("");
  const [submitterResults, setSubmitterResults] = useState<Person[]>([]);
  const [isSubmitterSearching, setIsSubmitterSearching] = useState(false);
  const [showSubmitterDropdown, setShowSubmitterDropdown] = useState(false);
  const submitterRef = useRef<HTMLDivElement>(null);
  const submitterDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Consultant search
  const [consultantQuery, setConsultantQuery] = useState("");
  const [consultantResults, setConsultantResults] = useState<Person[]>([]);
  const [isConsultantSearching, setIsConsultantSearching] = useState(false);
  const [showConsultantDropdown, setShowConsultantDropdown] = useState(false);
  const consultantRef = useRef<HTMLDivElement>(null);
  const consultantDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchSubmitters = useCallback(async (q: string) => {
    if (!q.trim()) { setSubmitterResults([]); setShowSubmitterDropdown(false); return; }
    setIsSubmitterSearching(true);
    try {
      const res = await fetch(`/api/recruiters/search?q=${encodeURIComponent(q)}`);
      setSubmitterResults(await res.json());
      setShowSubmitterDropdown(true);
    } catch { setSubmitterResults([]); }
    finally { setIsSubmitterSearching(false); }
  }, []);

  const searchConsultants = useCallback(async (q: string) => {
    if (!q.trim()) { setConsultantResults([]); setShowConsultantDropdown(false); return; }
    setIsConsultantSearching(true);
    try {
      const res = await fetch(`/api/students/search?q=${encodeURIComponent(q)}`);
      setConsultantResults(await res.json());
      setShowConsultantDropdown(true);
    } catch { setConsultantResults([]); }
    finally { setIsConsultantSearching(false); }
  }, []);

  useEffect(() => {
    if (submitterDebounce.current) clearTimeout(submitterDebounce.current);
    submitterDebounce.current = setTimeout(() => searchSubmitters(submitterQuery), 300);
    return () => { if (submitterDebounce.current) clearTimeout(submitterDebounce.current); };
  }, [submitterQuery, searchSubmitters]);

  useEffect(() => {
    if (consultantDebounce.current) clearTimeout(consultantDebounce.current);
    consultantDebounce.current = setTimeout(() => searchConsultants(consultantQuery), 300);
    return () => { if (consultantDebounce.current) clearTimeout(consultantDebounce.current); };
  }, [consultantQuery, searchConsultants]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (submitterRef.current && !submitterRef.current.contains(e.target as Node))
        setShowSubmitterDropdown(false);
      if (consultantRef.current && !consultantRef.current.contains(e.target as Node))
        setShowConsultantDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const set = (field: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const validate = () => {
    const errs: typeof errors = {};
    if (!form.submittedById) errs.submittedById = "Select who is submitting";
    if (!form.date) errs.date = "Required";
    if (!form.category) errs.category = "Required";
    if (!form.amount.trim()) errs.amount = "Required";
    else if (isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) errs.amount = "Must be a positive number";
    if (!form.location) errs.location = "Required";
    return errs;
  };

  const submit = () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append("submittedById", form.submittedById);
        fd.append("date", form.date);
        fd.append("category", form.category);
        fd.append("description", form.description);
        fd.append("amount", form.amount);
        fd.append("location", form.location);
        fd.append("status", form.status);
        fd.append("notes", form.notes);
        if (form.consultantId) fd.append("consultantId", form.consultantId);
        if (receiptFile) fd.append("receiptFile", receiptFile);

        const res = await fetch("/api/expenses", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to save expense");
        show(`Expense ${data.expenseId} saved successfully`, "success");
        setForm(EMPTY);
        setSubmitterQuery("");
        setConsultantQuery("");
        setReceiptFile(null);
        router.refresh();
      } catch (err: unknown) {
        show(err instanceof Error ? err.message : "Error saving expense", "error");
      }
    });
  };

  const SearchBox = ({
    label, query, setQuery, results, isSearching, showDropdown,
    selectedId, onSelect, onClear, boxRef, error, required,
  }: {
    label: string; query: string; setQuery: (v: string) => void;
    results: Person[]; isSearching: boolean; showDropdown: boolean;
    selectedId: string; onSelect: (p: Person) => void; onClear: () => void;
    boxRef: React.RefObject<HTMLDivElement | null>; error?: string; required?: boolean;
  }) => (
    <div className="flex flex-col gap-1" ref={boxRef}>
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}{required && " *"}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder={`Search ${label.toLowerCase()}…`}
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (selectedId) onClear(); }}
          className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-9 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        {isSearching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
        {selectedId && !isSearching && (
          <button type="button" onClick={onClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        )}
        {showDropdown && results.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); onSelect(p); }}
                  className="flex w-full flex-col px-3 py-2 text-left hover:bg-indigo-50 transition-colors"
                >
                  <span className="text-sm font-medium text-slate-900">{p.firstName} {p.lastName}</span>
                  <span className="text-xs text-slate-500">{p.email}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {showDropdown && results.length === 0 && !isSearching && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-4 text-center text-sm text-slate-400 shadow-lg">
            No results found
          </div>
        )}
      </div>
      {error && <p className="text-xs text-rose-500">{error}</p>}
      {selectedId && <p className="text-xs text-emerald-600">✓ {query} selected</p>}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-indigo-600" />
          New Expense
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Submitted By + Date */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SearchBox
            label="Submitted By"
            query={submitterQuery}
            setQuery={setSubmitterQuery}
            results={submitterResults}
            isSearching={isSubmitterSearching}
            showDropdown={showSubmitterDropdown}
            selectedId={form.submittedById}
            onSelect={(p) => {
              setForm((f) => ({ ...f, submittedById: p.id, submittedByName: `${p.firstName} ${p.lastName}` }));
              setSubmitterQuery(`${p.firstName} ${p.lastName}`);
              setShowSubmitterDropdown(false);
            }}
            onClear={() => {
              setForm((f) => ({ ...f, submittedById: "", submittedByName: "" }));
              setSubmitterQuery("");
            }}
            boxRef={submitterRef}
            error={errors.submittedById}
            required
          />
          <Input id="exp-date" label="Expense Date *" type="date" value={form.date} onChange={set("date")} error={errors.date} />
        </div>

        {/* Category + Amount + Location + Status */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select id="exp-category" label="Category *" options={CATEGORIES} placeholder="Select category" value={form.category} onChange={set("category")} error={errors.category} />
          <Input id="exp-amount" label="Amount (USD) *" type="number" placeholder="0.00" min="0" step="0.01" value={form.amount} onChange={set("amount")} error={errors.amount} />
          <Select id="exp-location" label="Expenses Location *" options={LOCATIONS} placeholder="Select location" value={form.location} onChange={set("location")} error={errors.location} />
          <Select id="exp-status" label="Status" options={STATUSES} placeholder="Select status" value={form.status} onChange={set("status")} />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1">
          <label htmlFor="exp-desc" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</label>
          <textarea
            id="exp-desc"
            rows={3}
            placeholder="Describe the expense…"
            value={form.description}
            onChange={set("description")}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-y"
          />
        </div>

        {/* Receipt Upload + Notes */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Receipt (Optional)</label>
            <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 text-sm text-slate-500 hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors">
              <Upload className="h-4 w-4 shrink-0" />
              <span className="truncate">{receiptFile ? receiptFile.name : "Choose file…"}</span>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="exp-notes" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</label>
            <textarea
              id="exp-notes"
              rows={2}
              placeholder="Any additional notes…"
              value={form.notes}
              onChange={set("notes")}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={submit} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
            {isPending ? "Saving…" : "Save Expense"}
          </Button>
        </div>
      </CardContent>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </Card>
  );
}
