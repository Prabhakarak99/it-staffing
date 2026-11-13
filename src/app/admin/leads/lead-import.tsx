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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/leads/import", { method: "POST", body }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) return setError(d.error ?? "Could not import the file");
    setResult(d);
    setFile(null);
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
            <p className="mt-1 text-slate-600">
              Fill one lead per row. No column is mandatory. For Google Sheets, upload this file to Google Drive, open it with Sheets, and when done use <b>File &gt; Download &gt; Microsoft Excel (.xlsx)</b>.
            </p>
            <a href="/api/leads/template" download className="mt-2 inline-flex items-center gap-1.5 font-semibold text-sky-700 hover:underline">
              <Download className="h-3.5 w-3.5" /> Download the Excel / Google Sheets format
            </a>
          </div>

          <div>
            <p className="font-semibold text-slate-800">2. Upload the filled file</p>
            <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-4 hover:border-sky-400 hover:bg-sky-50/40">
              <FileSpreadsheet className="h-6 w-6 shrink-0 text-emerald-600" />
              <span className="min-w-0 flex-1 truncate">{file ? file.name : "Choose an .xlsx or .csv file"}</span>
              <input ref={input} type="file" accept=".xlsx,.csv" className="hidden"
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(null); setResult(null); }} />
            </label>
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
          <Button onClick={upload} disabled={!file || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload
          </Button>
        </div>
      </div>
    </div>
  );
}
