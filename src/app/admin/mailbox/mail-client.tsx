"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Archive, ArrowLeft, ChevronLeft, ChevronRight, Download, FileText, Forward, Inbox, Loader2, Mail, MailOpen,
  Paperclip, PenSquare, RefreshCw, Reply, ReplyAll, RotateCcw, Search, Send, ShieldAlert, Star, Tag, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { displayName, replyRecipients } from "@/lib/gmail/addresses";
import type { MessageDetail, MessageSummary } from "@/lib/gmail/api";

type ComposeMode = "new" | "reply" | "replyAll" | "forward";

const FOLDERS = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "starred", label: "Starred", icon: Star },
  { id: "sent", label: "Sent", icon: Send },
  { id: "drafts", label: "Drafts", icon: FileText },
  { id: "all", label: "All Mail", icon: Mail },
  { id: "spam", label: "Spam", icon: ShieldAlert },
  { id: "trash", label: "Trash", icon: Trash2 },
] as const;

interface Label { id: string; name: string }

interface ListResult { key: string; messages: MessageSummary[]; nextPageToken: string | null; error?: string }
interface DetailResult { key: string; detail: MessageDetail | null; error?: string }

interface ComposeState {
  mode: ComposeMode;
  messageId?: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  files: File[];
  showCc: boolean;
}

const fmtListDate = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
};

const fmtSize = (n: number) => (n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Email HTML runs in a sandboxed frame: no scripts, no access to the app; links open in a new tab */
function emailDocument(detail: MessageDetail) {
  const body = detail.html ?? `<pre style="white-space:pre-wrap;font-family:inherit;margin:0">${(detail.text ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`;
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">
<meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'; form-action 'none'">
<style>body{font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1e293b;margin:0;padding:4px 2px;word-wrap:break-word}img{max-width:100%;height:auto}</style>
</head><body>${body}</body></html>`;
}

export function MailClient({ ownEmail, onLostAccess, notify }: {
  ownEmail: string;
  onLostAccess: () => void;
  notify: (message: string, type?: "success" | "error") => void;
}) {
  const [folder, setFolder] = useState<string>("inbox");
  const [labelId, setLabelId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  // Gmail pages forward only, so keep the tokens of the pages we came from
  const [pageTokens, setPageTokens] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const [labels, setLabels] = useState<Label[]>([]);
  const [inboxUnread, setInboxUnread] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailReload, setDetailReload] = useState(0);
  const [labelMenu, setLabelMenu] = useState(false);
  const [compose, setCompose] = useState<ComposeState | null>(null);
  const [sending, setSending] = useState(false);

  const pageToken = pageTokens[pageTokens.length - 1] ?? "";
  const listKey = `${folder}|${labelId ?? ""}|${query}|${pageToken}|${reloadKey}`;
  const [list, setList] = useState<ListResult | null>(null);
  const listLoading = list?.key !== listKey;

  const detailKey = selectedId ? `${selectedId}|${detailReload}` : "";
  const [detailResult, setDetailResult] = useState<DetailResult | null>(null);
  const detail = detailResult?.key === detailKey ? detailResult.detail : null;
  const detailLoading = !!selectedId && detailResult?.key !== detailKey;

  const handleError = useCallback((status: number, data: { error?: string; code?: string }) => {
    if (data.code === "not_connected") onLostAccess();
    return data.error ?? `Request failed (${status})`;
  }, [onLostAccess]);

  // ── Message list ──
  useEffect(() => {
    const ctrl = new AbortController();
    const params = new URLSearchParams({ folder });
    if (labelId) params.set("label", labelId);
    if (query) params.set("q", query);
    if (pageToken) params.set("pageToken", pageToken);
    fetch(`/api/gmail/messages?${params}`, { signal: ctrl.signal })
      .then(async (res) => {
        const data = await res.json();
        setList(res.ok
          ? { key: listKey, messages: data.messages, nextPageToken: data.nextPageToken }
          : { key: listKey, messages: [], nextPageToken: null, error: handleError(res.status, data) });
      })
      .catch((err) => {
        if (err.name !== "AbortError") setList({ key: listKey, messages: [], nextPageToken: null, error: "Could not reach the server" });
      });
    return () => ctrl.abort();
  }, [listKey, folder, labelId, query, pageToken, handleError]);

  // ── Labels + unread count (refreshed with the list) ──
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/gmail/labels", { signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setLabels(data.labels);
        setInboxUnread(data.inboxUnread);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [reloadKey]);

  // ── Open message ──
  useEffect(() => {
    if (!selectedId) return;
    const ctrl = new AbortController();
    fetch(`/api/gmail/messages/${selectedId}`, { signal: ctrl.signal })
      .then(async (res) => {
        const data = await res.json();
        setDetailResult(res.ok
          ? { key: detailKey, detail: data }
          : { key: detailKey, detail: null, error: handleError(res.status, data) });
        // Opening marks it read: reflect that in the list without a reload
        if (res.ok) {
          setList((l) => l && { ...l, messages: l.messages.map((m) => (m.id === data.id ? { ...m, unread: false } : m)) });
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") setDetailResult({ key: detailKey, detail: null, error: "Could not reach the server" });
      });
    return () => ctrl.abort();
  }, [selectedId, detailKey, handleError]);

  const goFolder = (id: string, label: string | null = null) => {
    setFolder(id);
    setLabelId(label);
    setPageTokens([]);
    setSelectedId(null);
  };
  const runSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(searchInput.trim());
    setPageTokens([]);
    setSelectedId(null);
  };
  const reload = () => setReloadKey((k) => k + 1);

  // ── Actions ──
  const patch = async (id: string, body: object, success?: string) => {
    const res = await fetch(`/api/gmail/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return notify(handleError(res.status, data), "error"), null;
    if (success) notify(success);
    return data as { labelIds?: string[] };
  };

  const updateLocal = (id: string, labelIds: string[]) => {
    setList((l) => l && {
      ...l,
      messages: l.messages.map((m) => (m.id === id ? { ...m, labelIds, unread: labelIds.includes("UNREAD"), starred: labelIds.includes("STARRED") } : m)),
    });
    setDetailResult((d) => d && d.detail?.id === id
      ? { ...d, detail: { ...d.detail, labelIds, unread: labelIds.includes("UNREAD"), starred: labelIds.includes("STARRED") } }
      : d);
  };

  const toggleStar = async (m: MessageSummary) => {
    const data = await patch(m.id, m.starred ? { remove: ["STARRED"] } : { add: ["STARRED"] });
    if (data?.labelIds) updateLocal(m.id, data.labelIds);
  };

  const markUnread = async (m: MessageDetail) => {
    const data = await patch(m.id, { add: ["UNREAD"] }, "Marked as unread");
    if (data) { setSelectedId(null); reload(); }
  };

  const archive = async (m: MessageDetail) => {
    const data = await patch(m.id, { remove: ["INBOX"] }, "Archived");
    if (data) { setSelectedId(null); reload(); }
  };

  const moveToInbox = async (m: MessageDetail) => {
    const data = await patch(m.id, { add: ["INBOX"], remove: ["SPAM"] }, "Moved to Inbox");
    if (data) { setSelectedId(null); reload(); }
  };

  const restore = async (m: MessageDetail) => {
    const data = await patch(m.id, { action: "untrash" }, "Restored");
    if (data) { setSelectedId(null); reload(); }
  };

  const toggleLabel = async (m: MessageDetail, label: Label) => {
    const has = m.labelIds.includes(label.id);
    const data = await patch(m.id, has ? { remove: [label.id] } : { add: [label.id] }, has ? `Removed “${label.name}”` : `Labeled “${label.name}”`);
    if (data?.labelIds) updateLocal(m.id, data.labelIds);
  };

  const trash = async (m: MessageDetail) => {
    const res = await fetch(`/api/gmail/messages/${m.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return notify(handleError(res.status, data), "error");
    notify("Moved to Trash");
    setSelectedId(null);
    reload();
  };

  // ── Compose ──
  const openCompose = (mode: ComposeMode, original?: MessageDetail) => {
    if (mode === "new" || !original) {
      setCompose({ mode: "new", to: "", cc: "", bcc: "", subject: "", body: "", files: [], showCc: false });
      return;
    }
    const recipients = mode === "forward" ? { to: "", cc: "" } : replyRecipients(original, ownEmail, mode === "replyAll");
    const prefix = mode === "forward" ? "Fwd" : "Re";
    const subject = new RegExp(`^${prefix}:`, "i").test(original.subject) ? original.subject : `${prefix}: ${original.subject}`;
    setCompose({ mode, messageId: original.id, ...recipients, bcc: "", subject, body: "", files: [], showCc: !!recipients.cc });
  };

  const closeCompose = useCallback(() => setCompose(null), []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compose) return;
    setSending(true);
    const fd = new FormData();
    fd.set("mode", compose.mode);
    if (compose.messageId) fd.set("messageId", compose.messageId);
    for (const k of ["to", "cc", "bcc", "subject", "body"] as const) fd.set(k, compose[k]);
    compose.files.forEach((f) => fd.append("files", f));
    const res = await fetch("/api/gmail/send", { method: "POST", body: fd });
    const data = await res.json();
    setSending(false);
    if (!res.ok) return notify(handleError(res.status, data), "error");
    notify("Email sent");
    setCompose(null);
    if (folder === "sent" || compose.mode !== "new") reload();
  };

  const messages = list?.messages ?? [];
  const inTrash = folder === "trash" && !labelId;
  const inSpam = folder === "spam" && !labelId;
  const title = labelId ? labels.find((l) => l.id === labelId)?.name ?? "Label" : FOLDERS.find((f) => f.id === folder)?.label;

  return (
    <div className="flex h-[calc(100vh-150px)] min-h-[560px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

      {/* ── Folders ── */}
      <aside className="hidden w-52 shrink-0 flex-col border-r border-slate-100 bg-slate-50/60 p-3 md:flex">
        <Button size="sm" className="mb-3 w-full" onClick={() => openCompose("new")}>
          <PenSquare className="h-3.5 w-3.5" /> Compose
        </Button>
        <nav className="no-scrollbar flex-1 space-y-0.5 overflow-y-auto">
          {FOLDERS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => goFolder(id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium",
                folder === id && !labelId ? "bg-indigo-100 text-indigo-800" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{label}</span>
              {id === "inbox" && inboxUnread > 0 && <span className="text-[11px] font-bold">{inboxUnread}</span>}
            </button>
          ))}
          {labels.length > 0 && (
            <>
              <p className="px-2.5 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Labels</p>
              {labels.map((l) => (
                <button
                  key={l.id}
                  onClick={() => goFolder("all", l.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px]",
                    labelId === l.id ? "bg-indigo-100 font-medium text-indigo-800" : "text-slate-600 hover:bg-slate-100",
                  )}
                >
                  <Tag className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{l.name}</span>
                </button>
              ))}
            </>
          )}
        </nav>
      </aside>

      {/* ── List ── */}
      <section className={cn("flex min-w-0 flex-col border-r border-slate-100 lg:w-[380px] lg:shrink-0", selectedId ? "hidden lg:flex" : "flex flex-1 lg:flex-none")}>
        <div className="flex items-center gap-2 border-b border-slate-100 p-3">
          {/* Small screens: folder picker + compose in place of the sidebar */}
          <select
            value={labelId ? `label:${labelId}` : folder}
            onChange={(e) => (e.target.value.startsWith("label:") ? goFolder("all", e.target.value.slice(6)) : goFolder(e.target.value))}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[12px] md:hidden"
          >
            {FOLDERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            {labels.map((l) => <option key={l.id} value={`label:${l.id}`}>{l.name}</option>)}
          </select>
          <form onSubmit={runSearch} className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={`Search ${title?.toLowerCase() ?? "mail"}…`}
              className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-[12px] placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            {query && (
              <button type="button" onClick={() => { setSearchInput(""); setQuery(""); setPageTokens([]); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </form>
          <button title="Refresh" onClick={reload} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <RefreshCw className={cn("h-4 w-4", listLoading && "animate-spin")} />
          </button>
          <button title="Compose" onClick={() => openCompose("new")} className="rounded-lg p-1.5 text-indigo-600 hover:bg-indigo-50 md:hidden">
            <PenSquare className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {listLoading && messages.length === 0 ? (
            <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
          ) : list?.error ? (
            <p className="px-5 py-12 text-center text-[13px] text-rose-600">{list.error}</p>
          ) : messages.length === 0 ? (
            <p className="px-5 py-16 text-center text-[13px] text-slate-400">{query ? "No emails match your search" : `No emails in ${title}`}</p>
          ) : (
            <ul className={cn("divide-y divide-slate-100", listLoading && "opacity-60")}>
              {messages.map((m) => {
                const who = folder === "sent" || folder === "drafts" ? `To: ${displayName(m.to)}` : displayName(m.from);
                return (
                  <li key={m.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(m.id)}
                      onKeyDown={(e) => { if (e.key === "Enter") setSelectedId(m.id); }}
                      className={cn(
                        "flex cursor-pointer gap-2.5 px-3 py-2.5 hover:bg-slate-50",
                        selectedId === m.id && "bg-indigo-50/70",
                        m.unread && "bg-white",
                      )}
                    >
                      <button
                        title={m.starred ? "Unstar" : "Star"}
                        onClick={(e) => { e.stopPropagation(); void toggleStar(m); }}
                        className="mt-0.5 self-start"
                      >
                        <Star className={cn("h-4 w-4", m.starred ? "fill-amber-400 text-amber-400" : "text-slate-300 hover:text-slate-500")} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <p className={cn("flex-1 truncate text-[13px]", m.unread ? "font-bold text-slate-900" : "text-slate-700")}>{who || "(unknown)"}</p>
                          <p className={cn("shrink-0 text-[11px]", m.unread ? "font-semibold text-indigo-700" : "text-slate-400")}>{fmtListDate(m.date)}</p>
                        </div>
                        <p className={cn("truncate text-[12.5px]", m.unread ? "font-semibold text-slate-800" : "text-slate-600")}>{m.subject || "(no subject)"}</p>
                        <p className="truncate text-[11.5px] text-slate-400">{m.snippet}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-[12px] text-slate-500">
          <button
            disabled={pageTokens.length === 0}
            onClick={() => setPageTokens((t) => t.slice(0, -1))}
            className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Newer
          </button>
          <span>Page {pageTokens.length + 1}</span>
          <button
            disabled={!list?.nextPageToken || listLoading}
            onClick={() => list?.nextPageToken && setPageTokens((t) => [...t, list.nextPageToken!])}
            className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            Older <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>

      {/* ── Reader ── */}
      <section className={cn("min-w-0 flex-1 flex-col", selectedId ? "flex" : "hidden lg:flex")}>
        {!selectedId ? (
          <div className="flex flex-1 flex-col items-center justify-center text-slate-300">
            <MailOpen className="h-10 w-10" />
            <p className="mt-2 text-[13px] text-slate-400">Select an email to read it</p>
          </div>
        ) : detailLoading ? (
          <div className="flex flex-1 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
        ) : !detail ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <p className="text-[13px] text-rose-600">{detailResult?.error ?? "Could not open this email"}</p>
            <Button size="sm" variant="outline" onClick={() => setDetailReload((k) => k + 1)}>Try again</Button>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 px-3 py-2">
              <ToolButton title="Back" icon={ArrowLeft} onClick={() => setSelectedId(null)} className="lg:hidden" />
              <ToolButton title="Reply" icon={Reply} onClick={() => openCompose("reply", detail)} />
              <ToolButton title="Reply all" icon={ReplyAll} onClick={() => openCompose("replyAll", detail)} />
              <ToolButton title="Forward" icon={Forward} onClick={() => openCompose("forward", detail)} />
              <span className="mx-1 h-5 w-px bg-slate-200" />
              {inTrash ? (
                <ToolButton title="Restore" icon={RotateCcw} onClick={() => restore(detail)} />
              ) : (
                <>
                  {detail.labelIds.includes("INBOX") && <ToolButton title="Archive" icon={Archive} onClick={() => archive(detail)} />}
                  {(inSpam || (!detail.labelIds.includes("INBOX") && !detail.labelIds.includes("SENT") && !detail.labelIds.includes("DRAFT"))) && (
                    <ToolButton title="Move to Inbox" icon={Inbox} onClick={() => moveToInbox(detail)} />
                  )}
                  <ToolButton title="Mark as unread" icon={Mail} onClick={() => markUnread(detail)} />
                  <ToolButton
                    title={detail.starred ? "Unstar" : "Star"}
                    icon={Star}
                    onClick={() => toggleStar(detail)}
                    iconClass={detail.starred ? "fill-amber-400 text-amber-400" : undefined}
                  />
                  {labels.length > 0 && (
                    <div className="relative">
                      <ToolButton title="Labels" icon={Tag} onClick={() => setLabelMenu((o) => !o)} />
                      {labelMenu && (
                        <LabelMenu labels={labels} selected={detail.labelIds} onToggle={(l) => toggleLabel(detail, l)} onClose={() => setLabelMenu(false)} />
                      )}
                    </div>
                  )}
                  <ToolButton title="Delete" icon={Trash2} onClick={() => trash(detail)} className="hover:!bg-rose-50 hover:!text-rose-600" />
                </>
              )}
            </div>

            {/* Header */}
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-[17px] font-bold leading-snug text-slate-900">{detail.subject || "(no subject)"}</h2>
              <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-[13px] font-semibold text-slate-800">{detail.from}</p>
                <p className="text-[11.5px] text-slate-400">
                  {new Date(detail.date).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
              <p className="mt-0.5 text-[12px] text-slate-500">To: {detail.to || "—"}</p>
              {detail.cc && <p className="text-[12px] text-slate-500">Cc: {detail.cc}</p>}
            </div>

            {/* Body */}
            <iframe
              title="Email content"
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              srcDoc={emailDocument(detail)}
              className="min-h-[200px] w-full flex-1 bg-white px-3"
            />

            {detail.attachments.length > 0 && (
              <div className="border-t border-slate-100 px-5 py-3">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <Paperclip className="h-3.5 w-3.5" /> {detail.attachments.length} attachment{detail.attachments.length === 1 ? "" : "s"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {detail.attachments.map((a) => (
                    <a
                      key={a.attachmentId}
                      href={`/api/gmail/messages/${detail.id}/attachments/${encodeURIComponent(a.attachmentId)}`}
                      className="flex max-w-[260px] items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[12px] text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
                    >
                      <Download className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                      <span className="truncate">{a.filename}</span>
                      <span className="shrink-0 text-[10.5px] text-slate-400">{fmtSize(a.size)}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Compose popup ── */}
      {compose && (
        <ComposeDialog
          state={compose}
          onChange={(patch) => setCompose((c) => c && { ...c, ...patch })}
          onClose={closeCompose}
          onSend={send}
          sending={sending}
        />
      )}
    </div>
  );
}

function ToolButton({ title, icon: Icon, onClick, className, iconClass }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  className?: string;
  iconClass?: string;
}) {
  return (
    <button title={title} onClick={onClick} className={cn("rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800", className)}>
      <Icon className={cn("h-4 w-4", iconClass)} />
    </button>
  );
}

function LabelMenu({ labels, selected, onToggle, onClose }: {
  labels: Label[];
  selected: string[];
  onToggle: (l: Label) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute left-0 top-full z-20 mt-1 max-h-72 w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
      {labels.map((l) => (
        <label key={l.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50">
          <input type="checkbox" checked={selected.includes(l.id)} onChange={() => onToggle(l)} className="h-3.5 w-3.5 accent-indigo-600" />
          <span className="truncate">{l.name}</span>
        </label>
      ))}
    </div>
  );
}

function ComposeDialog({ state, onChange, onClose, onSend, sending }: {
  state: ComposeState;
  onChange: (patch: Partial<ComposeState>) => void;
  onClose: () => void;
  onSend: (e: React.FormEvent) => void;
  sending: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title = { new: "New Email", reply: "Reply", replyAll: "Reply All", forward: "Forward" }[state.mode];
  const field = "h-9 w-full border-0 border-b border-slate-100 bg-transparent px-0 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-0";
  const totalSize = state.files.reduce((n, f) => n + f.size, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <form onSubmit={onSend} className="relative flex max-h-[95vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between rounded-t-2xl bg-slate-800 px-5 py-3">
          <h2 className="text-[14px] font-semibold text-white">{title}</h2>
          <button type="button" onClick={onClose} className="text-slate-300 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="w-10 text-[12px] text-slate-400">To</span>
            <input value={state.to} onChange={(e) => onChange({ to: e.target.value })} className={field} placeholder="name@company.com, …" autoFocus={!state.to} />
            {!state.showCc && (
              <button type="button" onClick={() => onChange({ showCc: true })} className="shrink-0 text-[12px] font-medium text-slate-500 hover:text-indigo-600">Cc/Bcc</button>
            )}
          </div>
          {state.showCc && (
            <>
              <div className="flex items-center gap-2">
                <span className="w-10 text-[12px] text-slate-400">Cc</span>
                <input value={state.cc} onChange={(e) => onChange({ cc: e.target.value })} className={field} />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-10 text-[12px] text-slate-400">Bcc</span>
                <input value={state.bcc} onChange={(e) => onChange({ bcc: e.target.value })} className={field} />
              </div>
            </>
          )}
          <div className="flex items-center gap-2">
            <span className="w-10 text-[12px] text-slate-400">Subject</span>
            <input value={state.subject} onChange={(e) => onChange({ subject: e.target.value })} className={field} required={state.mode === "new"} />
          </div>
          <textarea
            value={state.body}
            onChange={(e) => onChange({ body: e.target.value })}
            rows={12}
            autoFocus={!!state.to}
            placeholder={state.mode === "new" ? "Write your message…" : "Write your reply… (the original email is included below automatically)"}
            className="mt-2 w-full resize-y rounded-xl border border-slate-200 p-3 text-[13px] leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          {state.mode === "forward" && <p className="text-[11px] text-slate-400">The original email and its attachments are forwarded below your message.</p>}
          {state.files.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {state.files.map((f, i) => (
                <span key={`${f.name}-${i}`} className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-[11.5px] text-slate-700">
                  <Paperclip className="h-3 w-3" />{f.name}<span className="text-slate-400">{fmtSize(f.size)}</span>
                  <button type="button" onClick={() => onChange({ files: state.files.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-rose-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-3">
          <Button type="submit" disabled={sending || totalSize > 18 * 1024 * 1024}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {sending ? "Sending…" : "Send"}
          </Button>
          <label className="cursor-pointer rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" title="Attach files">
            <Paperclip className="h-4 w-4" />
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => { onChange({ files: [...state.files, ...Array.from(e.target.files ?? [])] }); e.target.value = ""; }}
            />
          </label>
          {totalSize > 18 * 1024 * 1024 && <p className="text-[11.5px] text-rose-600">Attachments over 18 MB total</p>}
          <Button type="button" variant="ghost" className="ml-auto" onClick={onClose}>Discard</Button>
        </div>
      </form>
    </div>
  );
}
