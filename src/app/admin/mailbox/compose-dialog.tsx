"use client";

import { useEffect, useState } from "react";
import { Loader2, Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_BYTES = 18 * 1024 * 1024;

const fmtSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** New email, sent from the user's connected Gmail */
export function ComposeDialog({ fromEmail, onClose, onSent, notify }: {
  fromEmail: string;
  onClose: () => void;
  onSent: () => void;
  notify: (message: string, type: "success" | "error") => void;
}) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const totalSize = files.reduce((n, f) => n + f.size, 0);
  const field = "h-9 w-full border-0 border-b border-slate-100 bg-transparent px-0 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-0";

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    const fd = new FormData();
    fd.set("to", to);
    fd.set("cc", cc);
    fd.set("bcc", bcc);
    fd.set("subject", subject);
    fd.set("body", body);
    for (const f of files) fd.append("files", f);
    const res = await fetch("/api/gmail/send", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) return notify(data.error ?? "Could not send the email", "error");
    notify("Email sent", "success");
    onSent();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <form onSubmit={send} className="relative flex max-h-[95vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between rounded-t-2xl bg-slate-800 px-5 py-3">
          <div>
            <h2 className="text-[14px] font-semibold text-white">New Email</h2>
            <p className="text-[11px] text-slate-400">From {fromEmail}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-300 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="w-14 text-[12px] text-slate-400">To</span>
            <input value={to} onChange={(e) => setTo(e.target.value)} className={field} placeholder="name@company.com, …" autoFocus required />
            {!showCc && (
              <button type="button" onClick={() => setShowCc(true)} className="shrink-0 text-[12px] font-medium text-slate-500 hover:text-indigo-600">Cc/Bcc</button>
            )}
          </div>
          {showCc && (
            <>
              <div className="flex items-center gap-2">
                <span className="w-14 text-[12px] text-slate-400">Cc</span>
                <input value={cc} onChange={(e) => setCc(e.target.value)} className={field} />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-14 text-[12px] text-slate-400">Bcc</span>
                <input value={bcc} onChange={(e) => setBcc(e.target.value)} className={field} />
              </div>
            </>
          )}
          <div className="flex items-center gap-2">
            <span className="w-14 text-[12px] text-slate-400">Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className={field} required />
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            placeholder="Write your message…"
            className="mt-2 w-full resize-y rounded-xl border border-slate-200 p-3 text-[13px] leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          {files.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {files.map((f, i) => (
                <span key={`${f.name}-${i}`} className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-[11.5px] text-slate-700">
                  <Paperclip className="h-3 w-3" />{f.name}<span className="text-slate-400">{fmtSize(f.size)}</span>
                  <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-3">
          <Button type="submit" disabled={sending || totalSize > MAX_BYTES}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {sending ? "Sending…" : "Send"}
          </Button>
          <label className="cursor-pointer rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" title="Attach files">
            <Paperclip className="h-4 w-4" />
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }}
            />
          </label>
          {totalSize > MAX_BYTES && <p className="text-[11.5px] text-rose-600">Attachments over 18 MB total</p>}
          <Button type="button" variant="ghost" className="ml-auto" onClick={onClose}>Discard</Button>
        </div>
      </form>
    </div>
  );
}
