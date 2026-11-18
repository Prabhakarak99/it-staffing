"use client";

import { Fragment, useState } from "react";
import { Building2, Check, Copy, Loader2, Minus, Plus, ShieldCheck, UserPlus, X } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { CompanyRow } from "@/lib/tenant/platform";

interface Screen { name: string; path: string }

const field = "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Never");
const suggestSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
const suggestCode = (name: string) => name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
const loginUrl = (slug: string) => `${typeof window === "undefined" ? "" : window.location.origin}/login?company=${slug}`;

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const data = await res?.json().catch(() => ({}));
  return { ok: !!res?.ok, data: (data ?? {}) as Record<string, unknown> };
}

function CopyLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { void navigator.clipboard.writeText(loginUrl(slug)); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="inline-flex items-center gap-1 font-mono text-[11.5px] text-indigo-600 hover:underline"
      title="Copy this company's login link"
    >
      ?company={slug} {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export function CompaniesView({ initial, screens }: { initial: CompanyRow[]; screens: Screen[] }) {
  const { toast, show, hide } = useToast();
  const [companies, setCompanies] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const customers = companies.filter((c) => c.kind === "company");
  const totals = {
    companies: customers.length,
    users: customers.reduce((n, c) => n + c.activeUsers, 0),
    submissions: customers.reduce((n, c) => n + c.submissionsThisMonth, 0),
  };

  return (
    <>
      <Header title="Companies" subtitle="Platform · every company on GFT Vision, its usage, admins and settings" />
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-[13px] text-slate-600 shadow-sm">
          <span><b className="text-[18px] text-slate-900">{totals.companies}</b> companies</span>
          <span><b className="text-[18px] text-slate-900">{totals.users}</b> active users</span>
          <span><b className="text-[18px] text-slate-900">{totals.submissions}</b> submissions this month</span>
          <Button className="ml-auto" onClick={() => setCreating((c) => !c)}>
            {creating ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {creating ? "Close" : "New company"}
          </Button>
        </div>

        {creating && (
          <NewCompanyForm
            onCreated={(list, message) => { setCompanies(list); setCreating(false); show(message, "success"); }}
            onError={(m) => show(m, "error")}
          />
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-slate-800">
                <tr>
                  <th className="w-10 px-3 py-2.5" />
                  {["Company", "Login link", "Status", "Users", "Consultants", "Submissions (month)", "AI resumes (month)", "Last login", "Admins"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-300">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {companies.map((c) => {
                  const isOpen = open === c.id;
                  const platform = c.kind === "platform";
                  return (
                    <Fragment key={c.id}>
                      <tr className={cn("hover:bg-slate-50", isOpen && "bg-indigo-50/40")}>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => setOpen(isOpen ? null : c.id)}
                            aria-label={isOpen ? "Close settings" : "Open settings"}
                            className={cn("flex h-6 w-6 items-center justify-center rounded-md border", isOpen ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-indigo-400")}
                          >
                            {isOpen ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                          </button>
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="flex items-center gap-1.5 font-semibold text-slate-800"><Building2 className="h-3.5 w-3.5 text-indigo-500" />{platform ? "Platform (shared settings)" : c.name}</p>
                          <p className="text-[11px] text-slate-400">Code {c.code}</p>
                        </td>
                        <td className="px-4 py-2.5">{platform ? <span className="text-[11.5px] text-slate-400">Plain /login (Super Admin)</span> : <CopyLink slug={c.slug} />}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-semibold", c.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
                            {c.status === "active" ? "Active" : "Suspended"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-slate-700">{c.activeUsers}<span className="text-slate-400"> / {c.users}{c.maxUsers ? ` (limit ${c.maxUsers})` : ""}</span></td>
                        <td className="px-4 py-2.5 tabular-nums text-slate-700">{c.consultants}</td>
                        <td className="px-4 py-2.5 tabular-nums text-slate-700">{c.submissionsThisMonth}</td>
                        <td className="px-4 py-2.5 tabular-nums text-slate-700">{c.aiResumesThisMonth}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{fmtDate(c.lastLogin)}</td>
                        <td className="px-4 py-2.5 text-slate-600">{c.admins.map((a) => a.name).join(", ") || "—"}</td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={10} className="bg-slate-50/80 px-4 py-4">
                            <CompanySettings company={c} screens={screens} onSaved={(list, m) => { setCompanies(list); show(m, "success"); }} onError={(m) => show(m, "error")} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </>
  );
}

function NewCompanyForm({ onCreated, onError }: { onCreated: (list: CompanyRow[], message: string) => void; onError: (m: string) => void }) {
  const [f, setF] = useState({ name: "", slug: "", code: "", firstName: "", lastName: "", email: "" });
  const [touched, setTouched] = useState({ slug: false, code: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f, v: string) =>
    setF((p) => ({
      ...p,
      [k]: v,
      // The login name and code follow the company name until edited by hand
      ...(k === "name" && !touched.slug ? { slug: suggestSlug(v) } : {}),
      ...(k === "name" && !touched.code ? { code: suggestCode(v) } : {}),
    }));

  const submit = async () => {
    setBusy(true);
    setError("");
    const { ok, data } = await send("/api/platform/companies", "POST", {
      name: f.name, slug: f.slug, code: f.code, admin: { firstName: f.firstName, lastName: f.lastName, email: f.email },
    });
    setBusy(false);
    if (!ok) { setError(String(data.error ?? "Could not create the company")); onError(String(data.error ?? "Could not create the company")); return; }
    const mail = data.emailSent ? "The admin was emailed an activation link." : `The activation email could not be sent (${String(data.emailError ?? "email not set up")}); use Resend in the company's settings.`;
    onCreated(data.companies as CompanyRow[], `${f.name} created. Login link: ${loginUrl(f.slug)}. ${mail}`);
  };

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5">
      <p className="text-[14px] font-bold text-slate-800">New company</p>
      <p className="mt-0.5 text-[12px] text-slate-500">It starts with GenFusion Tech&apos;s roles and screen access, AutoJobs paused, and the shared AI keys. Its first admin gets an activation email.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Company name<input className={field} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Dataforce" /></label>
        <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Login name (in the link)<input className={field} value={f.slug} onChange={(e) => { setTouched((t) => ({ ...t, slug: true })); set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "")); }} placeholder="dataforce" /></label>
        <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Code (3 letters)<input className={field} maxLength={3} value={f.code} onChange={(e) => { setTouched((t) => ({ ...t, code: true })); set("code", e.target.value.toUpperCase().replace(/[^A-Z]/g, "")); }} placeholder="DAT" /></label>
        <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Admin first name<input className={field} value={f.firstName} onChange={(e) => set("firstName", e.target.value)} /></label>
        <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Admin last name<input className={field} value={f.lastName} onChange={(e) => set("lastName", e.target.value)} /></label>
        <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Admin email<input className={field} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></label>
      </div>
      {f.slug && <p className="mt-3 text-[12px] text-slate-500">Login link: <span className="font-mono text-slate-700">{loginUrl(f.slug)}</span> · submission ids: <span className="font-mono text-slate-700">Sub-{f.code || "XXX"}-001</span></p>}
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] font-medium text-rose-700">{error}</p>}
      <div className="mt-4 flex justify-end">
        <Button onClick={() => void submit()} disabled={busy || !f.name || !f.slug || f.code.length !== 3 || !f.email}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create company
        </Button>
      </div>
    </div>
  );
}

function CompanySettings({ company, screens, onSaved, onError }: {
  company: CompanyRow;
  screens: Screen[];
  onSaved: (list: CompanyRow[], message: string) => void;
  onError: (m: string) => void;
}) {
  const platform = company.kind === "platform";
  const [name, setName] = useState(company.name);
  const [timezone, setTimezone] = useState(company.timezone);
  const [attTz, setAttTz] = useState(company.attendanceTimezone);
  const [maxUsers, setMaxUsers] = useState(company.maxUsers?.toString() ?? "");
  const [off, setOff] = useState(new Set(company.disabledModules));
  const [busy, setBusy] = useState<string | null>(null);
  const [admin, setAdmin] = useState({ firstName: "", lastName: "", email: "" });

  const patch = async (key: string, body: Record<string, unknown>, message: string) => {
    setBusy(key);
    const { ok, data } = await send(`/api/platform/companies/${company.id}`, "PATCH", body);
    setBusy(null);
    if (!ok) return onError(String(data.error ?? "Could not save"));
    onSaved(data as unknown as CompanyRow[], message);
  };
  const adminAction = async (userId: string, action: "resend-activation" | "reset-password") => {
    setBusy(userId + action);
    const { ok, data } = await send(`/api/platform/companies/${company.id}/admins`, "PATCH", { userId, action });
    setBusy(null);
    if (!ok) return onError(String(data.error ?? "Could not send"));
    if (!data.emailSent) return onError(`The email could not be sent: ${String(data.emailError ?? "email not set up")}`);
    onSaved(undefined as unknown as CompanyRow[], action === "reset-password" ? "Password reset link sent" : "Activation link sent again");
  };
  const addAdmin = async () => {
    setBusy("add-admin");
    const { ok, data } = await send(`/api/platform/companies/${company.id}/admins`, "POST", admin);
    setBusy(null);
    if (!ok) return onError(String(data.error ?? "Could not add the admin"));
    setAdmin({ firstName: "", lastName: "", email: "" });
    onSaved(data.companies as CompanyRow[], data.emailSent ? "Admin added and emailed an activation link" : "Admin added; the activation email could not be sent");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-[13px] font-bold text-slate-800">Company</p>
        {!platform && (
          <label className="block space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Name<input className={field} value={name} onChange={(e) => setName(e.target.value)} /></label>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Time zone (dates)<input className={field} value={timezone} onChange={(e) => setTimezone(e.target.value)} /></label>
          <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Attendance time zone<input className={field} value={attTz} onChange={(e) => setAttTz(e.target.value)} /></label>
          {!platform && <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">User limit (empty = none)<input className={field} inputMode="numeric" value={maxUsers} onChange={(e) => setMaxUsers(e.target.value.replace(/\D/g, ""))} /></label>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => void patch("save", { ...(platform ? {} : { name, maxUsers: maxUsers || null }), timezone, attendanceTimezone: attTz }, "Company saved")} disabled={!!busy}>
            {busy === "save" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
          </Button>
          {!platform && (
            <Button
              size="sm"
              variant="outline"
              disabled={!!busy}
              onClick={() => {
                const suspend = company.status === "active";
                if (suspend && !confirm(`Suspend ${company.name}? Its users are signed out within a minute and can't sign in until you activate it again. No data is deleted.`)) return;
                void patch("status", { status: suspend ? "suspended" : "active" }, suspend ? `${company.name} suspended` : `${company.name} active again`);
              }}
            >
              {busy === "status" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {company.status === "active" ? "Suspend" : "Activate"}
            </Button>
          )}
        </div>
      </div>

      {!platform && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-bold text-slate-800"><ShieldCheck className="h-4 w-4 text-indigo-600" /> Company admins</p>
          <ul className="divide-y divide-slate-100">
            {company.admins.length === 0 && <li className="py-2 text-[12px] text-slate-400">No admin yet.</li>}
            {company.admins.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 py-2 text-[12.5px]">
                <span className="font-semibold text-slate-800">{a.name}</span>
                <span className="text-slate-500">{a.email}</span>
                {!a.isActive && <span className="rounded bg-amber-50 px-1.5 text-[10.5px] font-semibold text-amber-700">Not activated</span>}
                <span className="ml-auto flex gap-1.5">
                  {!a.isActive && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void adminAction(a.id, "resend-activation")}>Resend activation</Button>}
                  <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void adminAction(a.id, "reset-password")}>Send password reset</Button>
                </span>
              </li>
            ))}
          </ul>
          <div className="grid gap-2 sm:grid-cols-3">
            <input className={field} placeholder="First name" value={admin.firstName} onChange={(e) => setAdmin((p) => ({ ...p, firstName: e.target.value }))} />
            <input className={field} placeholder="Last name" value={admin.lastName} onChange={(e) => setAdmin((p) => ({ ...p, lastName: e.target.value }))} />
            <input className={field} placeholder="Email" type="email" value={admin.email} onChange={(e) => setAdmin((p) => ({ ...p, email: e.target.value }))} />
          </div>
          <Button size="sm" variant="outline" disabled={!!busy || !admin.email} onClick={() => void addAdmin()}>
            {busy === "add-admin" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />} Add admin
          </Button>
        </div>
      )}

      {!platform && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
          <p className="text-[13px] font-bold text-slate-800">Screens for this company</p>
          <p className="text-[12px] text-slate-500">Untick a screen to switch it off for everyone in {company.name}, the Company Admin included. Users see the change when they next sign in.</p>
          <div className="grid gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
            {screens.map((s) => (
              <label key={s.path} className="flex items-center gap-2 text-[12.5px] text-slate-700">
                <input type="checkbox" className="h-3.5 w-3.5 accent-indigo-600" checked={!off.has(s.path)} onChange={() => setOff((prev) => { const n = new Set(prev); if (n.has(s.path)) n.delete(s.path); else n.add(s.path); return n; })} />
                {s.name}
              </label>
            ))}
          </div>
          <Button size="sm" disabled={!!busy} onClick={() => void patch("modules", { disabledModules: [...off] }, "Screens saved")}>
            {busy === "modules" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save screens
          </Button>
        </div>
      )}
    </div>
  );
}
