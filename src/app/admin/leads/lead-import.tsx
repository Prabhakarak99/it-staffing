"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Result { added: number; skipped: { row: number; reason: string }[] }

/** Popup: download the sheet format, then upload a filled Excel / Google Sheets file */
export function LeadImportDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sheetUrl, setSheetUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const upload = async () => {
    if (!file && !sheetUrl.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    const body = new FormData();
    if (file) body.append("file", file);
    else body.append("sheetUrl", sheetUrl.trim());
    const res = await fetch("/api/leads/import", { method: "POST", body }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) return setError(d.error ?? "Could not import the file");
    setResult(d);
    setFile(null);
    setSheetUrl("");
    if (input.current) input.current.value = "";
    if (d.added) router.refresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-6" onClick={onClose}>
      <div className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-slate-800 px-5 py-3">
          <h2 className="text-[14px] font-semibold text-white">Upload leads from Excel / Google Sheets</h2>
          <button type="button" onClick={onClose} className="text-slate-300 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5 text-[12.5px] text-slate-700">
          <div className="rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3">
            <p className="font-semibold text-slate-800">1. Get the format</p>
            <p className="mt-1 text-slate-600">Fill one lead per row under the headings. No column is mandatory.</p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
              <a href="/api/leads/template?format=csv" download className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 hover:underline">
                <Download className="h-3.5 w-3.5" /> Google Sheets format (.csv)
              </a>
              <a href="/api/leads/template" download className="inline-flex items-center gap-1.5 font-semibold text-sky-700 hover:underline">
                <Download className="h-3.5 w-3.5" /> Excel format (.xlsx)
              </a>
            </div>
            <p className="mt-2 text-[11.5px] text-slate-500">
              No Excel? Download the Google Sheets format, open <a href="https://sheets.new" target="_blank" rel="noreferrer" className="font-semibold text-emerald-700 hover:underline">sheets.new</a>,
              then <b>File &gt; Import &gt; Upload</b> and pick the file. The headings appear in row 1.
            </p>
          </div>

          <div>
            <p className="font-semibold text-slate-800">2. Upload the filled file, or paste your Google Sheet link</p>
            <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-4 hover:border-sky-400 hover:bg-sky-50/40">
              <FileSpreadsheet className="h-6 w-6 shrink-0 text-emerald-600" />
              <span className="min-w-0 flex-1 truncate">{file ? file.name : "Choose an .xlsx or .csv file"}</span>
              <input ref={input} type="file" accept=".xlsx,.csv" className="hidden"
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); setSheetUrl(""); setError(null); setResult(null); }} />
            </label>
            <p className="my-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">or</p>
            <input value={sheetUrl} placeholder="https://docs.google.com/spreadsheets/d/…"
              onChange={(e) => { setSheetUrl(e.target.value); setFile(null); if (input.current) input.current.value = ""; setError(null); setResult(null); }}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            <p className="mt-1 text-[11.5px] text-slate-500">
              For a link, the sheet must be shared: <b>Share &gt; General access &gt; Anyone with the link</b>. The tab that is open in the link is read.
            </p>
          </div>

          {error && <p className="font-medium text-rose-600">{error}</p>}

          {result && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> {result.added} lead{result.added === 1 ? "" : "s"} added
                {result.skipped.length > 0 && <span className="font-medium text-amber-700">· {result.skipped.length} row{result.skipped.length === 1 ? "" : "s"} skipped</span>}
              </p>
              {result.skipped.length > 0 && (
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-[11.5px] text-slate-700">
                  {result.skipped.map((s) => <li key={s.row}><b>Row {s.row}:</b> {s.reason}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <Button variant="ghost" onClick={onClose}>{result ? "Done" : "Cancel"}</Button>
          <Button onClick={upload} disabled={(!file && !sheetUrl.trim()) || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload
          </Button>
        </div>
      </div>
    </div>
  );
}
