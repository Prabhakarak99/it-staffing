"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookUser, Mail, Pencil, Phone, Plus, Search, Send, Trash2, X } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { VendorList } from "@/lib/vendors/list";

type Vendor = VendorList["vendors"][number];

type VendorForm = Pick<Vendor, "name" | "email" | "companyName"> & {
  phone: string; technologies: string; clients: string; implementationPartners: string; notes: string;
};

const EMPTY_FORM: VendorForm = {
  name: "", email: "", phone: "", companyName: "", technologies: "", clients: "", implementationPartners: "", notes: "",
};

const TEMPLATES = [
  {
    id: "greetings",
    label: "Greetings",
    subject: "Greetings – staying connected",
    body: "Hi {firstName},\n\nHope you are doing well! I wanted to reach out and stay connected. We have strong consultants available across multiple technologies and would be happy to support any open requirements you have with your clients.\n\nPlease feel free to share any current positions.\n\nThanks & regards,",
  },
  {
    id: "followup",
    label: "Requirement follow-up",
    subject: "Following up on your requirement",
    body: "Hi {firstName},\n\nI am following up on the requirement we discussed. Could you please share an update on the status, or let me know if there is any additional information you need from our side?\n\nAlso, please keep us posted on any new requirements.\n\nThanks & regards,",
  },
  { id: "custom", label: "Custom", subject: "", body: "" },
] as const;

const splitList = (s: string | null) => (s ?? "").split(",").map((t) => t.trim()).filter(Boolean);

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-[3px] sm:items-center">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className={cn("relative w-full rounded-2xl bg-white shadow-2xl", wide ? "max-w-2xl" : "max-w-xl")}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-[15px] font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function TextArea({ label, ...props }: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</label>
      <textarea
        {...props}
        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      />
    </div>
  );
}

export function VendorManagementView({ initial }: { initial: VendorList }) {
  const { toast, show, hide } = useToast();
  const [data, setData] = useState(initial);
  const { vendors, isAdmin } = data;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Add/edit popup: null = closed, "new" = add, otherwise the vendor being edited
  const [editing, setEditing] = useState<Vendor | "new" | null>(null);
  const [form, setForm] = useState<VendorForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Email popup: list of recipient ids, null = closed
  const [emailTo, setEmailTo] = useState<string[] | null>(null);
  const [templateId, setTemplateId] = useState<string>(TEMPLATES[0].id);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/vendor-management");
    const json = await res.json();
    if (res.ok) setData(json);
    else show(json.error ?? "Failed to reload vendors", "error");
  }, [show]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter((v) =>
      [v.name, v.email, v.phone, v.companyName, v.technologies, v.clients, v.implementationPartners, v.ownerName]
        .some((f) => f?.toLowerCase().includes(q)),
    );
  }, [query, vendors]);

  const allChecked = filtered.length > 0 && filtered.every((v) => selected.has(v.id));
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const v of filtered) {
        if (allChecked) next.delete(v.id);
        else next.add(v.id);
      }
      return next;
    });
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // ── Add / edit ──
  const openNew = () => { setForm(EMPTY_FORM); setEditing("new"); };
  const openEdit = (v: Vendor) => {
    setForm({
      name: v.name, email: v.email, companyName: v.companyName, phone: v.phone ?? "",
      technologies: v.technologies ?? "", clients: v.clients ?? "",
      implementationPartners: v.implementationPartners ?? "", notes: v.notes ?? "",
    });
    setEditing(v);
  };
  const closeEdit = useCallback(() => setEditing(null), []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const isNew = editing === "new";
    const res = await fetch(isNew ? "/api/vendor-management" : `/api/vendor-management/${(editing as Vendor).id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return show(data.error ?? "Failed to save", "error");
    show(isNew ? "Vendor contact added" : "Vendor contact updated");
    setEditing(null);
    void load();
  };

  const remove = async (v: Vendor) => {
    if (!confirm(`Delete ${v.name} (${v.companyName})?`)) return;
    const res = await fetch(`/api/vendor-management/${v.id}`, { method: "DELETE" });
    if (!res.ok) return show("Failed to delete", "error");
    setSelected((prev) => { const next = new Set(prev); next.delete(v.id); return next; });
    show("Vendor contact deleted");
    void load();
  };

  // ── Email ──
  const applyTemplate = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id) ?? TEMPLATES[0];
    setTemplateId(t.id);
    setSubject(t.subject);
    setBody(t.body);
  };
  const openEmail = (ids: string[]) => {
    applyTemplate(TEMPLATES[0].id);
    setEmailTo(ids);
  };
  const closeEmail = useCallback(() => setEmailTo(null), []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailTo) return;
    setSending(true);
    const res = await fetch("/api/vendor-management/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: emailTo, subject, body }),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) return show(data.error ?? "Failed to send", "error");
    if (data.failed.length > 0) {
      show(`Sent ${data.sent}, failed ${data.failed.length}: ${data.failed.slice(0, 3).join(", ")}`, "error");
    } else {
      show(`Email sent to ${data.sent} vendor${data.sent === 1 ? "" : "s"}`);
    }
    setEmailTo(null);
    setSelected(new Set());
    void load();
  };

  const recipients = emailTo ? vendors.filter((v) => emailTo.includes(v.id)) : [];
  const companyCount = new Set(vendors.map((v) => v.companyName.toLowerCase())).size;
  const th = "px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap";
  const set = (k: keyof VendorForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <Header title="Vendor Management" subtitle={isAdmin ? "Every recruiter's vendor contacts" : "Your personal vendor contact book"} />
      <div className="space-y-5 p-6">

        {/* ── Summary ── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Vendor Contacts", value: vendors.length, color: "text-indigo-700" },
            { label: "Companies", value: companyCount, color: "text-sky-700" },
            { label: "Emailed (last 7 days)", value: data.emailedLast7Days, color: "text-emerald-700" },
            { label: "Selected", value: selected.size, color: "text-violet-700" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className={cn("text-[22px] font-bold tabular-nums leading-none", color)}>{value}</p>
              <p className="mt-1 text-[11px] font-medium text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Grid ── */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
              <BookUser className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-slate-900">Vendor Contacts</p>
              <p className="text-[11px] text-slate-400">Select contacts to send a bulk email, or use the mail icon for one</p>
            </div>
            <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, company, technology…"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-[12px] text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <Button size="sm" variant="outline" disabled={selected.size === 0} onClick={() => openEmail([...selected])}>
                <Send className="h-3.5 w-3.5" /> Email selected{selected.size > 0 ? ` (${selected.size})` : ""}
              </Button>
              <Button size="sm" onClick={openNew}>
                <Plus className="h-3.5 w-3.5" /> New Vendor Contact
              </Button>
            </div>
          </div>

          {vendors.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <p className="text-[13px] font-semibold text-slate-700">No vendor contacts yet</p>
              <p className="mt-1 text-[12px] text-slate-400">Click &ldquo;New Vendor Contact&rdquo; to start your vendor book.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="w-10 px-3 py-3">
                      <input type="checkbox" checked={allChecked} onChange={toggleAll} className="h-3.5 w-3.5 accent-indigo-500" />
                    </th>
                    <th className={th}>Name</th>
                    <th className={th}>Company</th>
                    <th className={th}>Contact</th>
                    <th className={th}>Technologies</th>
                    <th className={th}>Clients</th>
                    <th className={th}>Impl. Partners</th>
                    <th className={th}>Last Emailed</th>
                    {isAdmin && <th className={th}>Recruiter</th>}
                    <th className={cn(th, "text-right")}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((v) => (
                    <tr key={v.id} className={cn("align-top hover:bg-slate-50", selected.has(v.id) && "bg-indigo-50/50")}>
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggleOne(v.id)} className="h-3.5 w-3.5 accent-indigo-500" />
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-800">{v.name}</td>
                      <td className="px-3 py-3 text-slate-700">{v.companyName}</td>
                      <td className="px-3 py-3">
                        <a href={`mailto:${v.email}`} className="flex items-center gap-1 text-indigo-600 hover:underline">
                          <Mail className="h-3 w-3 shrink-0" />{v.email}
                        </a>
                        {v.phone && (
                          <p className="mt-0.5 flex items-center gap-1 text-slate-500"><Phone className="h-3 w-3 shrink-0" />{v.phone}</p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex max-w-[220px] flex-wrap gap-1">
                          {splitList(v.technologies).map((t) => (
                            <span key={t} className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10.5px] font-medium text-indigo-700">{t}</span>
                          ))}
                        </div>
                      </td>
                      <td className="max-w-[180px] px-3 py-3 text-slate-600">{v.clients ?? "—"}</td>
                      <td className="max-w-[180px] px-3 py-3 text-slate-600">{v.implementationPartners ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                        {fmtDate(v.lastEmailedAt)}
                        {v.emailCount > 0 && <span className="ml-1 text-[10.5px] text-slate-400">({v.emailCount}×)</span>}
                      </td>
                      {isAdmin && <td className="whitespace-nowrap px-3 py-3 text-slate-600">{v.ownerName}</td>}
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          <button title="Send email" onClick={() => openEmail([v.id])} className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600">
                            <Send className="h-3.5 w-3.5" />
                          </button>
                          <button title="Edit" onClick={() => openEdit(v)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button title="Delete" onClick={() => remove(v)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={isAdmin ? 10 : 9} className="px-5 py-10 text-center text-slate-400">No contacts match your search</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Add / edit popup ── */}
      {editing && (
        <Modal title={editing === "new" ? "New Vendor Contact" : "Edit Vendor Contact"} onClose={closeEdit}>
          <form onSubmit={save} className="space-y-4 px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Name *" value={form.name} onChange={set("name")} required autoFocus />
              <Input label="Company Name *" value={form.companyName} onChange={set("companyName")} required />
              <Input label="Email *" type="email" value={form.email} onChange={set("email")} required />
              <Input label="Phone Number" value={form.phone} onChange={set("phone")} />
            </div>
            <Input label="Technologies" placeholder="Java, AWS, Salesforce" value={form.technologies} onChange={set("technologies")} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Clients" placeholder="Comma-separated" value={form.clients} onChange={set("clients")} />
              <Input label="Implementation Partners" placeholder="Comma-separated" value={form.implementationPartners} onChange={set("implementationPartners")} />
            </div>
            <TextArea label="Notes" rows={2} value={form.notes} onChange={set("notes")} />
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button type="button" variant="outline" onClick={closeEdit}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : editing === "new" ? "Add Contact" : "Save Changes"}</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Email popup ── */}
      {emailTo && (
        <Modal title={recipients.length === 1 ? `Email ${recipients[0].name}` : `Email ${recipients.length} vendors`} onClose={closeEmail} wide>
          <form onSubmit={send} className="space-y-4 px-6 py-5">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">To</p>
              <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                {recipients.map((v) => (
                  <span key={v.id} className="rounded-md bg-white px-2 py-0.5 text-[11px] text-slate-700 shadow-sm">
                    {v.name} &lt;{v.email}&gt;
                  </span>
                ))}
              </div>
              {recipients.length > 1 && (
                <p className="mt-1 text-[11px] text-slate-400">Each vendor gets their own separate email; they won&apos;t see each other.</p>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t.id)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-[12px] font-medium",
                    templateId === t.id ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <Input label="Subject *" value={subject} onChange={(e) => setSubject(e.target.value)} required />
            <TextArea label="Message *" rows={9} value={body} onChange={(e) => setBody(e.target.value)} required />
            <p className="text-[11px] text-slate-400">
              Use <code className="rounded bg-slate-100 px-1">{"{firstName}"}</code>, <code className="rounded bg-slate-100 px-1">{"{name}"}</code> or{" "}
              <code className="rounded bg-slate-100 px-1">{"{company}"}</code> to personalize each email. Replies come to your own inbox.
            </p>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button type="button" variant="outline" onClick={closeEmail}>Cancel</Button>
              <Button type="submit" disabled={sending || recipients.length === 0}>
                <Send className="h-3.5 w-3.5" /> {sending ? "Sending…" : `Send${recipients.length > 1 ? ` to ${recipients.length}` : ""}`}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </>
  );
}
