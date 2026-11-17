"use client";

import { useEffect, useState } from "react";
import { Check, ClipboardCopy, Download, ExternalLink, Loader2, RefreshCw, Users2 } from "lucide-react";
import { TEAM_SHEET_HEADINGS } from "@/lib/leads/fields";
import { Button } from "@/components/ui/button";

interface Result { added: number; skipped: { row: number; reason: string }[] }
interface Team { url: string | null; canManage: boolean }

/**
 * Copies the headings tab-separated: pasted into cell A1 of a Google Sheet they fill A1 to J1.
 * (The app can't write into the sheet itself without Google sign-in, so this is the one-paste way.)
 */
function CopyHeadings() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(TEAM_SHEET_HEADINGS.join("\t"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy these headings, then paste them into cell A1:", TEAM_SHEET_HEADINGS.join("\t"));
    }
  };
  return (
    <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 font-semibold text-indigo-700 hover:bg-indigo-50">
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <ClipboardCopy className="h-3.5 w-3.5" />} {copied ? "Copied: paste into cell A1" : "Copy column headings"}
    </button>
  );
}

/** Top of the upload popup: the one Google Sheet the whole team fills in (no Google sign-in needed) */
export function TeamSheetSection({ myEmail, onResult, onError }: {
  myEmail: string;
  onResult: (r: Result) => void;
  onError: (message: string | null) => void;
}) {
  const [team, setTeam] = useState<Team | null>(null);
  const [link, setLink] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/leads/team-sheet", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => d && setTeam(d)).catch(() => {});
  }, []);

  const call = async (method: "PUT" | "POST", body?: unknown) => {
    setBusy(true);
    onError(null);
    const res = await fetch("/api/leads/team-sheet", { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) return onError(d.error ?? "Could not reach the team sheet");
    if (method === "POST") return onResult(d);
    setTeam(d);
    setEditing(false);
    setLink("");
  };

  if (!team) return null;
  const setup = !team.url || editing;

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-3">
      <p className="flex items-center gap-1.5 font-semibold text-slate-800"><Users2 className="h-4 w-4 text-indigo-600" /> Team Google Sheet (one sheet for everyone)</p>

      {!setup && team.url && (
        <>
          <p className="mt-1 text-slate-600">
            New sheet? Click <b>Copy column headings</b>, open the sheet, click cell <b>A1</b> and paste: the columns appear in row 1.
            Everyone adds leads to this one sheet, then clicks Load. Rows are loaded once, to whoever loads them first.
            To keep a row for a particular recruiter, put their login email (yours is <b>{myEmail}</b>) in a <b>Recruiter Email</b> column. Rows already loaded are skipped.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <a href={team.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 font-semibold text-indigo-700 hover:bg-indigo-50">
              <ExternalLink className="h-3.5 w-3.5" /> Open the team sheet
            </a>
            <CopyHeadings />
            <Button onClick={() => call("POST")} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Load data from sheet
            </Button>
            {team.canManage && <button type="button" onClick={() => setEditing(true)} className="ml-auto text-[11.5px] font-medium text-slate-400 hover:text-indigo-600 hover:underline">Change sheet</button>}
          </div>
        </>
      )}

      {setup && !team.canManage && <p className="mt-1 text-slate-600">No team sheet is set up yet. Ask an admin to add it here.</p>}

      {setup && team.canManage && (
        <>
          <ol className="mt-1 list-decimal space-y-1 pl-4 text-slate-600">
            <li>Use any Google Sheet. For a ready-made one, <a href="/api/leads/template?format=csv&team=1" download className="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:underline"><Download className="h-3.5 w-3.5" /> download the format</a>, open <a href="https://sheets.new" target="_blank" rel="noreferrer" className="font-semibold text-indigo-700 hover:underline">sheets.new</a>, then <b>File &gt; Import &gt; Upload</b>.</li>
            <li>In the sheet click <b>Share</b>, set General access to <b>Anyone with the link</b>, role <b>Editor</b>, so everyone can work in it.</li>
            <li>Paste the sheet&apos;s link here and click Save.</li>
          </ol>
          <div className="mt-2 flex gap-2">
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…"
              className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-[13px] shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            <Button onClick={() => call("PUT", { url: link })} disabled={busy || !link.trim()}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
            {editing && <Button variant="ghost" onClick={() => { setEditing(false); setLink(""); }}>Cancel</Button>}
          </div>
          <p className="mt-1.5 text-[11.5px] text-slate-500">This needs no Google sign-in. Note that anyone who has the link can open the sheet, so share the link only with your team.</p>
        </>
      )}
    </div>
  );
}
