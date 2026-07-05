"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { DollarSign, Loader2, Search, X, Upload, Tag, MapPin, FileText, StickyNote } from "lucide-react";

const CATEGORIES = ["Travel", "Food & Meals", "Accommodation", "Office Supplies", "Training", "Communication", "Software", "Other"];
const LOCATIONS = ["Onsite", "Offshore"];
const STATUSES = ["Pending", "Approved", "Rejected"];

const CATEGORY_ICONS: Record<string, string> = {
  "Travel": "✈️", "Food & Meals": "🍽️", "Accommodation": "🏨",
  "Office Supplies": "📎", "Training": "📚", "Communication": "📡",
  "Software": "💻", "Other": "📦",
};

interface Person { id: string; firstName: string; lastName: string; email: string; }

const EMPTY = {
  date: "", submittedById: "", submittedByName: "", consultantId: "", consultantName: "",
  category: "", description: "", amount: "", location: "", status: "Pending", notes: "",
};

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function SectionCard({ icon: Icon, title, color, children }: {
  icon: React.ElementType; title: string; color: string; children: React.ReactNode;
}) {
  const colorMap: Record<string, { bg: string; border: string; icon: string }> = {
    teal:    { bg: "bg-teal-50",   border: "border-teal-100",   icon: "text-teal-500" },
    emerald: { bg: "bg-emerald-50",border: "border-emerald-100",icon: "text-emerald-500" },
    violet:  { bg: "bg-violet-50", border: "border-violet-100", icon: "text-violet-500" },
    amber:   { bg: "bg-amber-50",  border: "border-amber-100",  icon: "text-amber-500" },
    slate:   { bg: "bg-slate-50",  border: "border-slate-100",  icon: "text-slate-500" },
    blue:    { bg: "bg-blue-50",   border: "border-blue-100",   icon: "text-blue-500" },
  };
  const c = colorMap[color] ?? colorMap.slate;
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={cn("flex items-center gap-2.5 rounded-t-xl border-b px-4 py-3", c.bg, c.border)}>
        <Icon className={cn("h-4 w-4 shrink-0", c.icon)} />
        <span className="text-xs font-bold uppercase tracking-widest text-slate-600">{title}</span>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function PersonSearch({ label, query, setQuery, results, isSearching, showDropdown, selectedId,
  onSelect, onClear, boxRef, error, required, avatarColor }: {
  label: string; query: string; setQuery: (v: string) => void;
  results: Person[]; isSearching: boolean; showDropdown: boolean;
  selectedId: string; onSelect: (p: Person) => void; onClear: () => void;
  boxRef: React.RefObject<HTMLDivElement | null>; error?: string; required?: boolean;
  avatarColor: string;
}) {
  const selectedPerson = results.find((p) => p.id === selectedId);
  return (
    <div className="flex flex-col gap-1.5" ref={boxRef}>
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}{required && " *"}
      </label>
      {selectedId && query ? (
        <div className={cn("flex items-center gap-3 rounded-xl border px-4 py-3", avatarColor === "teal" ? "border-teal-200 bg-teal-50" : "border-violet-200 bg-violet-50")}>
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
            avatarColor === "teal" ? "bg-teal-100 text-teal-700" : "bg-violet-100 text-violet-700")}>
            {initials(query)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">{query}</p>
          </div>
          <button type="button" onClick={onClear}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-400 hover:text-slate-600 shadow-sm">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder={`Search ${label.toLowerCase()}…`} value={query}
            onChange={(e) => { setQuery(e.target.value); if (selectedId) onClear(); }}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-sm placeholder:text-slate-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/20" />
          {isSearching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
          {showDropdown && results.length > 0 && (
            <ul className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
              {results.map((p) => (
                <li key={p.id}>
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); onSelect(p); }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-teal-50 transition-colors">
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      avatarColor === "teal" ? "bg-teal-100 text-teal-700" : "bg-violet-100 text-violet-700")}>
                      {initials(`${p.firstName} ${p.lastName}`)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{p.firstName} {p.lastName}</p>
                      <p className="text-xs text-slate-500 truncate">{p.email}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {showDropdown && results.length === 0 && !isSearching && (
            <div className="absolute z-30 mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-4 text-center text-sm text-slate-400 shadow-xl">
              No results found
            </div>
          )}
        </div>
      )}
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  );
}

export function ExpenseForm({
  existingExpense,
  onSuccess,
  onCancel,
}: {
  existingExpense?: {
    id: string;
    expenseId: string;
    date: string;
    category: string;
    description: string | null;
    amount: number;
    location: string;
    receiptFile?: string | null;
    status: string;
    notes: string | null;
    submittedBy: { id: string; firstName: string; lastName: string };
    consultant: { id: string; firstName: string; lastName: string } | null;
  };
  onSuccess?: (expense?: {
    id: string;
    expenseId: string;
    date: string;
    category: string;
    description: string | null;
    amount: number;
    location: string;
    receiptFile: string | null;
    status: string;
    notes: string | null;
    submittedBy: { id: string; firstName: string; lastName: string; email: string };
    consultant: { id: string; firstName: string; lastName: string } | null;
  }) => void;
  onCancel?: () => void;
} = {}) {
  const toDateInput = (d: string) => new Date(d).toISOString().split("T")[0];

  const [form, setForm] = useState(() => existingExpense ? {
    date: toDateInput(existingExpense.date),
    submittedById: existingExpense.submittedBy.id,
    submittedByName: `${existingExpense.submittedBy.firstName} ${existingExpense.submittedBy.lastName}`,
    consultantId: existingExpense.consultant?.id ?? "",
    consultantName: existingExpense.consultant ? `${existingExpense.consultant.firstName} ${existingExpense.consultant.lastName}` : "",
    category: existingExpense.category,
    description: existingExpense.description ?? "",
    amount: String(existingExpense.amount),
    location: existingExpense.location,
    status: existingExpense.status,
    notes: existingExpense.notes ?? "",
  } : EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof EMPTY | "receiptFile", string>>>({});
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast, show, hide } = useToast();
  const router = useRouter();

  const [submitterQuery, setSubmitterQuery] = useState(existingExpense ? `${existingExpense.submittedBy.firstName} ${existingExpense.submittedBy.lastName}` : "");
  const [submitterResults, setSubmitterResults] = useState<Person[]>([]);
  const [isSubmitterSearching, setIsSubmitterSearching] = useState(false);
  const [showSubmitterDropdown, setShowSubmitterDropdown] = useState(false);
  const submitterRef = useRef<HTMLDivElement>(null);
  const submitterDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [consultantQuery, setConsultantQuery] = useState(existingExpense?.consultant ? `${existingExpense.consultant.firstName} ${existingExpense.consultant.lastName}` : "");
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
      if (submitterRef.current && !submitterRef.current.contains(e.target as Node)) setShowSubmitterDropdown(false);
      if (consultantRef.current && !consultantRef.current.contains(e.target as Node)) setShowConsultantDropdown(false);
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
        const res = await fetch(existingExpense ? `/api/expenses/${existingExpense.id}` : "/api/expenses", {
          method: existingExpense ? "PATCH" : "POST",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Failed to ${existingExpense ? "update" : "save"} expense`);
        show(`Expense ${data.expenseId ?? existingExpense?.expenseId} ${existingExpense ? "updated" : "saved"} successfully`, "success");
        if (!existingExpense) {
          setForm(EMPTY);
          setSubmitterQuery(""); setConsultantQuery(""); setReceiptFile(null);
        }
        onSuccess?.(data);
        router.refresh();
      } catch (err: unknown) {
        show(err instanceof Error ? err.message : "Error saving expense", "error");
      }
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Gradient header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-3">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute -left-4 bottom-0 h-16 w-16 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm shadow-inner">
            <DollarSign className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-white">{existingExpense ? "Edit Expense" : "New Expense"}</h2>
            <p className="text-sm text-white/70">{existingExpense ? `Update ${existingExpense.expenseId}` : "Log and track an expense record"}</p>
          </div>
          {form.amount && (
            <div className="ml-auto rounded-xl bg-white/15 px-4 py-2 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/60">Amount</p>
              <p className="text-[15px] font-bold text-white">${parseFloat(form.amount || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">

        {/* Who & When */}
        <SectionCard icon={DollarSign} title="Submitter & Date" color="teal">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <PersonSearch
              label="Submitted By" query={submitterQuery} setQuery={setSubmitterQuery}
              results={submitterResults} isSearching={isSubmitterSearching}
              showDropdown={showSubmitterDropdown} selectedId={form.submittedById}
              onSelect={(p) => { setForm((f) => ({ ...f, submittedById: p.id, submittedByName: `${p.firstName} ${p.lastName}` })); setSubmitterQuery(`${p.firstName} ${p.lastName}`); setShowSubmitterDropdown(false); }}
              onClear={() => { setForm((f) => ({ ...f, submittedById: "", submittedByName: "" })); setSubmitterQuery(""); }}
              boxRef={submitterRef} error={errors.submittedById} required avatarColor="teal"
            />
            <Input compact id="exp-date" label="Expense Date *" type="date" value={form.date} onChange={set("date")} error={errors.date} />
          </div>
          <PersonSearch
            label="Related Consultant (optional)" query={consultantQuery} setQuery={setConsultantQuery}
            results={consultantResults} isSearching={isConsultantSearching}
            showDropdown={showConsultantDropdown} selectedId={form.consultantId}
            onSelect={(p) => { setForm((f) => ({ ...f, consultantId: p.id, consultantName: `${p.firstName} ${p.lastName}` })); setConsultantQuery(`${p.firstName} ${p.lastName}`); setShowConsultantDropdown(false); }}
            onClear={() => { setForm((f) => ({ ...f, consultantId: "", consultantName: "" })); setConsultantQuery(""); }}
            boxRef={consultantRef} avatarColor="violet"
          />
        </SectionCard>

        {/* Category */}
        <SectionCard icon={Tag} title="Category & Amount" color="emerald">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Category *</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button key={cat} type="button"
                  onClick={() => setForm((p) => ({ ...p, category: p.category === cat ? "" : cat }))}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                    form.category === cat
                      ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50"
                  )}>
                  <span>{CATEGORY_ICONS[cat]}</span>{cat}
                </button>
              ))}
            </div>
            {errors.category && <p className="mt-1 text-xs text-rose-500">{errors.category}</p>}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input compact id="exp-amount" label="Amount (USD) *" type="number" placeholder="0.00" min="0" step="0.01" value={form.amount} onChange={set("amount")} error={errors.amount} />
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
              <div className="flex gap-2">
                {STATUSES.map((s) => (
                  <button key={s} type="button"
                    onClick={() => setForm((p) => ({ ...p, status: s }))}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold transition-all",
                      form.status === s
                        ? s === "Approved" ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
                          : s === "Rejected" ? "border-rose-500 bg-rose-500 text-white shadow-sm"
                          : "border-amber-500 bg-amber-500 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    )}>{s}</button>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Location */}
        <SectionCard icon={MapPin} title="Location" color="blue">
          <div>
            <div className="flex gap-2">
              {LOCATIONS.map((loc) => (
                <button key={loc} type="button"
                  onClick={() => setForm((p) => ({ ...p, location: p.location === loc ? "" : loc }))}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition-all",
                    form.location === loc
                      ? loc === "Onsite" ? "border-blue-500 bg-blue-500 text-white shadow-sm" : "border-indigo-500 bg-indigo-500 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"
                  )}>
                  <MapPin className="h-3 w-3" />{loc}
                </button>
              ))}
            </div>
            {errors.location && <p className="mt-1 text-xs text-rose-500">{errors.location}</p>}
          </div>
        </SectionCard>

        {/* Description & Notes */}
        <SectionCard icon={StickyNote} title="Description & Notes" color="amber">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Description</label>
            <textarea id="exp-desc" rows={3} placeholder="Describe the expense…" value={form.description} onChange={set("description")}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20 resize-y" />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</label>
              <textarea id="exp-notes" rows={2} placeholder="Any additional notes…" value={form.notes} onChange={set("notes")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20 resize-none" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Receipt</label>
              <label className={cn(
                "flex h-[72px] cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 transition-all",
                receiptFile ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:border-teal-300 hover:bg-teal-50/40"
              )}>
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", receiptFile ? "bg-emerald-100" : "bg-slate-200")}>
                  {receiptFile ? <FileText className="h-4 w-4 text-emerald-600" /> : <Upload className="h-4 w-4 text-slate-400" />}
                </div>
                <div className="min-w-0">
                  <p className={cn("text-xs font-semibold", receiptFile ? "text-emerald-700" : "text-slate-600")}>
                    {receiptFile ? receiptFile.name : "Upload Receipt"}
                  </p>
                  <p className="text-[10px] text-slate-400">{receiptFile ? "Click to replace" : "PDF, JPG, or PNG"}</p>
                </div>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          </div>
        </SectionCard>

        <div className="flex justify-end gap-2 pt-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={isPending}>
              Cancel
            </Button>
          )}
          <Button onClick={submit} disabled={isPending} className="px-8">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
            {isPending ? "Saving…" : existingExpense ? "Save Changes" : "Save Expense"}
          </Button>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  );
}
