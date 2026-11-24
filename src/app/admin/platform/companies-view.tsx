"use client";

import { Fragment, useEffect, useState } from "react";
import { ArrowRightLeft, Building2, Check, Copy, Eye, EyeOff, KeyRound, Loader2, Minus, Plus, ShieldCheck, UserPlus, Users, X } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { CompanyRow } from "@/lib/tenant/platform";
import type { CompanyUserRow } from "@/app/api/platform/companies/[id]/users/route";
import { validatePassword } from "@/lib/validators";

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

type PasswordPair = { password: string; confirm: string };
const EMPTY_PAIR: PasswordPair = { password: "", confirm: "" };

/** Why the pair can't be saved (undefined = OK). Optional: both empty is fine (e.g. send an activation email instead). */
function pairError(p: PasswordPair, optional = false): string | undefined {
  if (optional && !p.password && !p.confirm) return undefined;
  return validatePassword(p.password) ?? (p.password !== p.confirm ? "The passwords don't match" : undefined);
}

/** Password + Re-enter password, with show/hide and a live hint */
function PasswordFields({ value, onChange, optional, autoFocus }: { value: PasswordPair; onChange: (p: PasswordPair) => void; optional?: boolean; autoFocus?: boolean }) {
  const [show, setShow] = useState(false);
  const err = pairError(value, optional);
  const empty = !value.password && !value.confirm;
  const input = (key: keyof PasswordPair, placeholder: string, focus?: boolean) => (
    <input
      className={cn(field, "pr-9")}
      type={show ? "text" : "password"}
      autoComplete="new-password"
      autoFocus={focus}
      placeholder={placeholder}
      value={value[key]}
      onChange={(e) => onChange({ ...value, [key]: e.target.value })}
    />
  );
  return (
    <div className="space-y-1">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="relative">
          {input("password", optional ? "Password (optional)" : "Password", autoFocus)}
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label={show ? "Hide passwords" : "Show passwords"}>
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {input("confirm", "Re-enter password")}
      </div>
      <p className={cn("text-[11.5px]", empty ? "text-slate-500" : err ? "text-rose-600" : "text-emerald-600")}>
        {empty
          ? optional ? "Leave empty to email an activation link instead, or set a password so they can sign in right away." : "At least 8 characters, with a letter and a number."
          : err ?? "Passwords match"}
      </p>
    </div>
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
                            <CompanySettings company={c} companies={companies} screens={screens} onSaved={(list, m) => { if (list) setCompanies(list); show(m, "success"); }} onError={(m) => show(m, "error")} />
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
  const [pw, setPw] = useState(EMPTY_PAIR);
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
      name: f.name, slug: f.slug, code: f.code, admin: { firstName: f.firstName, lastName: f.lastName, email: f.email, ...(pw.password || pw.confirm ? { password: pw.password, confirmPassword: pw.confirm } : {}) },
    });
    setBusy(false);
    if (!ok) { setError(String(data.error ?? "Could not create the company")); onError(String(data.error ?? "Could not create the company")); return; }
    const mail = data.adminActive ? "The admin can sign in now with the password you set." : data.emailSent ? "The admin was emailed an activation link." : `The activation email could not be sent (${String(data.emailError ?? "email not set up")}); use Resend in the company's settings.`;
    onCreated(data.companies as CompanyRow[], `${f.name} created. Login link: ${loginUrl(f.slug)}. ${mail}`);
  };

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5">
      <p className="text-[14px] font-bold text-slate-800">New company</p>
      <p className="mt-0.5 text-[12px] text-slate-500">It starts with GenFusion Tech&apos;s roles and screen access, AutoJobs paused, and the shared AI keys. Its first admin gets an activation email, or set their password here so they can sign in right away.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Company name<input className={field} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Dataforce" /></label>
        <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Login name (in the link)<input className={field} value={f.slug} onChange={(e) => { setTouched((t) => ({ ...t, slug: true })); set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "")); }} placeholder="dataforce" /></label>
        <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Code (3 letters)<input className={field} maxLength={3} value={f.code} onChange={(e) => { setTouched((t) => ({ ...t, code: true })); set("code", e.target.value.toUpperCase().replace(/[^A-Z]/g, "")); }} placeholder="DAT" /></label>
        <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Admin first name<input className={field} value={f.firstName} onChange={(e) => set("firstName", e.target.value)} /></label>
        <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Admin last name<input className={field} value={f.lastName} onChange={(e) => set("lastName", e.target.value)} /></label>
        <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Admin email<input className={field} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></label>
      </div>
      <div className="mt-3"><PasswordFields value={pw} onChange={setPw} optional /></div>
      {f.slug && <p className="mt-3 text-[12px] text-slate-500">Login link: <span className="font-mono text-slate-700">{loginUrl(f.slug)}</span> · submission ids: <span className="font-mono text-slate-700">Sub-{f.code || "XXX"}-001</span></p>}
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] font-medium text-rose-700">{error}</p>}
      <div className="mt-4 flex justify-end">
        <Button onClick={() => void submit()} disabled={busy || !f.name || !f.slug || f.code.length !== 3 || !f.email || !!pairError(pw, true)}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create company
        </Button>
      </div>
    </div>
  );
}

function CompanySettings({ company, companies, screens, onSaved, onError }: {
  company: CompanyRow;
  companies: CompanyRow[];
  screens: Screen[];
  onSaved: (list: CompanyRow[] | null, message: string) => void;
  onError: (m: string) => void;
}) {
  const platform = company.kind === "platform";
  const [pwFor, setPwFor] = useState<string | null>(null);
  const [pw, setPw] = useState(EMPTY_PAIR);
  const [newPw, setNewPw] = useState(EMPTY_PAIR);
  const [usersKey, setUsersKey] = useState(0);

  /** Fresh company list (admins' status) after a user change */
  const reload = async (message: string, refreshUsers = false) => {
    const list = await fetch("/api/platform/companies").then((r) => (r.ok ? r.json() : null)).catch(() => null);
    onSaved(list as CompanyRow[] | null, message);
    if (refreshUsers) setUsersKey((k) => k + 1);
  };
  const setAdminPassword = async (a: { id: string; name: string; isActive: boolean }) => {
    setBusy(a.id + "pw");
    const { ok, data } = await send(`/api/platform/companies/${company.id}/users`, "PATCH", { userId: a.id, password: pw.password, confirmPassword: pw.confirm });
    setBusy(null);
    if (!ok) return onError(String(data.error ?? "Could not set the password"));
    setPwFor(null);
    setPw(EMPTY_PAIR);
    await reload(a.isActive ? `Password set for ${a.name}` : `Password set and ${a.name} activated`, true);
  };
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
    onSaved(null, action === "reset-password" ? "Password reset link sent" : "Activation link sent again");
  };
  const addAdmin = async () => {
    setBusy("add-admin");
    const withPassword = !!(newPw.password || newPw.confirm);
    const { ok, data } = await send(`/api/platform/companies/${company.id}/admins`, "POST", {
      ...admin,
      ...(withPassword ? { password: newPw.password, confirmPassword: newPw.confirm } : {}),
    });
    setBusy(null);
    if (!ok) return onError(String(data.error ?? "Could not add the admin"));
    setAdmin({ firstName: "", lastName: "", email: "" });
    setNewPw(EMPTY_PAIR);
    setUsersKey((k) => k + 1);
    onSaved(
      data.companies as CompanyRow[],
      withPassword ? "Admin added and active: they can sign in with the password you set"
        : data.emailSent ? "Admin added and emailed an activation link" : "Admin added; the activation email could not be sent",
    );
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
              <li key={a.id} className="py-2 text-[12.5px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-800">{a.name}</span>
                  <span className="text-slate-500">{a.email}</span>
                  {a.isActive
                    ? <span className="rounded bg-emerald-50 px-1.5 text-[10.5px] font-semibold text-emerald-700">Active</span>
                    : <span className="rounded bg-amber-50 px-1.5 text-[10.5px] font-semibold text-amber-700">Not activated</span>}
                  <span className="ml-auto flex flex-wrap justify-end gap-1.5">
                    <Button size="sm" variant={pwFor === a.id ? "default" : "outline"} disabled={!!busy} onClick={() => { setPwFor(pwFor === a.id ? null : a.id); setPw(EMPTY_PAIR); }}>
                      <KeyRound className="h-3.5 w-3.5" /> Set password
                    </Button>
                    {!a.isActive && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void adminAction(a.id, "resend-activation")}>Resend activation</Button>}
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void adminAction(a.id, "reset-password")}>Send password reset</Button>
                  </span>
                </div>
                {pwFor === a.id && (
                  <form className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3" onSubmit={(e) => { e.preventDefault(); void setAdminPassword(a); }}>
                    <PasswordFields value={pw} onChange={setPw} autoFocus />
                    <div className="flex gap-2">
                      <Button size="sm" type="submit" disabled={!!busy || !!pairError(pw)}>
                        {busy === a.id + "pw" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {a.isActive ? "Save password" : "Save and activate"}
                      </Button>
                      <Button size="sm" type="button" variant="outline" onClick={() => setPwFor(null)}>Cancel</Button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
          <div className="grid gap-2 sm:grid-cols-3">
            <input className={field} placeholder="First name" value={admin.firstName} onChange={(e) => setAdmin((p) => ({ ...p, firstName: e.target.value }))} />
            <input className={field} placeholder="Last name" value={admin.lastName} onChange={(e) => setAdmin((p) => ({ ...p, lastName: e.target.value }))} />
            <input className={field} placeholder="Email" type="email" value={admin.email} onChange={(e) => setAdmin((p) => ({ ...p, email: e.target.value }))} />
          </div>
          <PasswordFields value={newPw} onChange={setNewPw} optional />
          <Button size="sm" variant="outline" disabled={!!busy || !admin.email || !!pairError(newPw, true)} onClick={() => void addAdmin()}>
            {busy === "add-admin" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />} Add admin
          </Button>
        </div>
      )}

      {!platform && <CompanyUsers key={usersKey} company={company} companies={companies} onDone={(m) => void reload(m)} onError={onError} />}

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

function CompanyUsers({ company, companies, onDone, onError }: { company: CompanyRow; companies: CompanyRow[]; onDone: (m: string) => void; onError: (m: string) => void }) {
  const [users, setUsers] = useState<CompanyUserRow[] | null>(null);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [pw, setPw] = useState(EMPTY_PAIR);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [moving, setMoving] = useState<string | null>(null);
  const others = companies.filter((c) => c.kind === "company" && c.id !== company.id);

  const refresh = () =>
    fetch(`/api/platform/companies/${company.id}/users`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((list: CompanyUserRow[]) => setUsers(list))
      .catch(() => setLoadError(true));

  useEffect(() => {
    let live = true;
    fetch(`/api/platform/companies/${company.id}/users`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((list: CompanyUserRow[]) => live && setUsers(list))
      .catch(() => live && setLoadError(true));
    return () => { live = false; };
  }, [company.id]);

  const change = async (u: CompanyUserRow, body: Record<string, unknown>, message: string) => {
    setBusy(u.id);
    const { ok, data } = await send(`/api/platform/companies/${company.id}/users`, "PATCH", { userId: u.id, ...body });
    setBusy(null);
    if (!ok) return onError(String(data.error ?? "Could not save"));
    setUsers(data as unknown as CompanyUserRow[]);
    setEditing(null);
    setPw(EMPTY_PAIR);
    onDone(message);
  };

  const q = filter.trim().toLowerCase();
  const shown = (users ?? []).filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q));

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex items-center gap-1.5 text-[13px] font-bold text-slate-800"><Users className="h-4 w-4 text-indigo-600" /> Users in {company.name}</p>
        {users && <span className="text-[12px] text-slate-500">{users.filter((u) => u.isActive).length} active of {users.length}</span>}
        <input className={cn(field, "ml-auto max-w-xs")} placeholder="Search name, email or role" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      <p className="text-[12px] text-slate-500">Setting a password also activates the account, so the user can sign in right away with it at <span className="font-mono">?company={company.slug}</span>. Share the password with them privately.</p>
      {!users ? (
        loadError ? (
          <p className="py-2 text-[12.5px] font-medium text-rose-600">Could not load the users. Refresh the page to try again.</p>
        ) : (
          <p className="flex items-center gap-2 py-2 text-[12.5px] text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading users…</p>
        )
      ) : (
        <ul className="divide-y divide-slate-100">
          {shown.length === 0 && <li className="py-2 text-[12px] text-slate-400">No users.</li>}
          {shown.map((u) => (
            <li key={u.id} className="py-2 text-[12.5px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-800">{u.name}</span>
                <span className="text-slate-500">{u.email}</span>
                <span className="rounded bg-slate-100 px-1.5 text-[10.5px] font-semibold text-slate-600">{u.isPlatformAdmin ? "Super Admin" : u.role}</span>
                {u.isActive ? (
                  <span className="rounded bg-emerald-50 px-1.5 text-[10.5px] font-semibold text-emerald-700">Active</span>
                ) : (
                  <span className="rounded bg-amber-50 px-1.5 text-[10.5px] font-semibold text-amber-700">{u.pendingActivation ? "Not activated" : "Inactive"}</span>
                )}
                <span className="ml-auto flex gap-1.5">
                  <Button size="sm" variant="outline" disabled={!!busy} onClick={() => { setEditing(editing === u.id ? null : u.id); setMoving(null); setPw(EMPTY_PAIR); }}>
                    <KeyRound className="h-3.5 w-3.5" /> Set password
                  </Button>
                  {!u.isPlatformAdmin && !u.pendingActivation && others.length > 0 && (
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => { setMoving(moving === u.id ? null : u.id); setEditing(null); }}>
                      <ArrowRightLeft className="h-3.5 w-3.5" /> Transfer
                    </Button>
                  )}
                  {u.isActive ? (
                    !u.isPlatformAdmin && (
                      <Button size="sm" variant="outline" disabled={!!busy} onClick={() => { if (confirm(`Deactivate ${u.name}? They won't be able to sign in until activated again.`)) void change(u, { isActive: false }, `${u.name} deactivated`); }}>
                        {busy === u.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Deactivate
                      </Button>
                    )
                  ) : (
                    !u.pendingActivation && (
                      <Button size="sm" disabled={!!busy} onClick={() => void change(u, { isActive: true }, `${u.name} activated`)}>
                        {busy === u.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Activate
                      </Button>
                    )
                  )}
                </span>
              </div>
              {editing === u.id && (
                <form
                  className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3"
                  onSubmit={(e) => { e.preventDefault(); void change(u, { password: pw.password, confirmPassword: pw.confirm }, u.isActive ? `Password set for ${u.name}` : `Password set and ${u.name} activated`); }}
                >
                  <PasswordFields value={pw} onChange={setPw} autoFocus />
                  <div className="flex gap-2">
                    <Button size="sm" type="submit" disabled={!!busy || !!pairError(pw)}>
                      {busy === u.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {u.isActive ? "Save password" : "Save and activate"}
                    </Button>
                    <Button size="sm" type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </form>
              )}
              {moving === u.id && (
                <TransferForm
                  user={u}
                  from={company}
                  companies={others}
                  onCancel={() => setMoving(null)}
                  onError={onError}
                  onDone={(m) => { setMoving(null); void refresh(); onDone(m); }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Move a user to another company: history stays here under the old (deactivated) account */
function TransferForm({ user, from, companies, onCancel, onDone, onError }: {
  user: CompanyUserRow;
  from: CompanyRow;
  companies: CompanyRow[];
  onCancel: () => void;
  onDone: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [toId, setToId] = useState(companies.find((c) => c.status === "active")?.id ?? companies[0]?.id ?? "");
  const [roles, setRoles] = useState<{ id: string; name: string }[] | null>(null);
  const [roleId, setRoleId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const admin = user.role === "Company Admin";

  useEffect(() => {
    if (!toId) return;
    let live = true;
    fetch(`/api/platform/companies/${toId}/roles`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((list: { id: string; name: string }[]) => {
        if (!live) return;
        setRoles(list);
        // Same role as now when that company has it ("" = Company Admin)
        setRoleId(admin ? "" : list.find((r) => r.name === user.role)?.id ?? "?");
      })
      .catch(() => live && setRoles([]));
    return () => { live = false; };
  }, [toId, admin, user.role]);

  const to = companies.find((c) => c.id === toId);
  const submit = async () => {
    if (!to) return;
    if (!confirm(`Move ${user.name} from ${from.name} to ${to.name}?\n\nTheir account in ${from.name} is deactivated; its submissions and other records stay with ${from.name}. They sign in at ?company=${to.slug} with the same email and password.`)) return;
    setBusy(true);
    const { ok, data } = await send(`/api/platform/companies/${from.id}/users/transfer`, "POST", { userId: user.id, toCompanyId: to.id, roleId });
    setBusy(false);
    if (!ok) return onError(String(data.error ?? "Could not transfer the user"));
    onDone(`${user.name} moved to ${to.name}. They sign in at ?company=${to.slug} with the same password.`);
  };

  return (
    <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Move to company
          <select className={field} value={toId} onChange={(e) => { setRoles(null); setToId(e.target.value); }}>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}{c.status !== "active" ? " (suspended)" : ""}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Role there
          <select className={field} value={roleId} onChange={(e) => setRoleId(e.target.value)} disabled={!roles}>
            {roleId === "?" && <option value="?">Choose a role…</option>}
            <option value="">Company Admin (every screen)</option>
            {(roles ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
      </div>
      <p className="text-[11.5px] text-slate-500">
        {user.name}&apos;s records stay with {from.name} under the old account, which is deactivated. In {to?.name ?? "the other company"} they get an active account with the same email, details and password.
      </p>
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || !roles || roleId === "?" || !to} onClick={() => void submit()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="h-3.5 w-3.5" />} Transfer
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
