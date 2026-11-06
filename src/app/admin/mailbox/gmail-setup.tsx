"use client";

import { useState } from "react";
import { Check, CheckCircle2, Copy, ExternalLink, KeyRound, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { GmailSetup } from "@/lib/gmail/setup";
import { APP_TZ } from "@/lib/tz";

const CONSOLE = "https://console.cloud.google.com";

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
      <code className="min-w-0 flex-1 truncate text-[11.5px] text-slate-700">{value}</code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function Step({ n, title, link, children }: { n: number; title: string; link?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">{n}</span>
      <div className="min-w-0 flex-1 pb-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-[13px] font-semibold text-slate-900">{title}</p>
          {link && (
            <a href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] font-semibold text-indigo-600 hover:underline">
              {link.label} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <div className="mt-1 text-[12.5px] leading-relaxed text-slate-600">{children}</div>
      </div>
    </li>
  );
}

/**
 * First-time Gmail setup for admins: how to create the Google OAuth client, then paste its keys.
 * The keys are checked with Google before they are saved.
 */
export function GmailSetupPanel({ setup: initial, onSaved, notify }: {
  setup: GmailSetup;
  onSaved: (setup: GmailSetup) => void;
  notify: (message: string, type: "success" | "error") => void;
}) {
  const [setup, setSetup] = useState(initial);
  const [clientId, setClientId] = useState(initial.clientId ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fromServer = setup.source === "env";
  const replacing = setup.source === "app";

  const save = async () => {
    setError("");
    if (!clientId.trim()) return setError("Paste the Client ID");
    if (!replacing && !clientSecret.trim()) return setError("Paste the Client Secret");
    setSaving(true);
    const res = await fetch("/api/gmail/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, clientSecret }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data.error ?? "Could not save the keys");
    setSetup(data);
    setClientSecret("");
    notify("Google keys verified and saved. Everyone can now connect their Gmail.", "success");
    onSaved(data);
  };

  const remove = async () => {
    if (!confirm("Remove the Google keys? Nobody will be able to use the Mailbox until new keys are added.")) return;
    const res = await fetch("/api/gmail/settings", { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return notify(data.error ?? "Could not remove the keys", "error");
    setSetup(data);
    setClientId("");
    notify("Google keys removed", "success");
    onSaved(data);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600">
          <KeyRound className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-slate-900">Gmail Setup</p>
          <p className="text-[11.5px] text-slate-500">
            One-time setup by an administrator. Takes about 10 minutes in Google Cloud, signed in with your Google Workspace admin account.
          </p>
        </div>
        {setup.configured && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Connected to Google
          </span>
        )}
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-[1.4fr_1fr]">
        <ol className="space-y-4">
          <Step n={1} title="Sign in to Google Cloud and create a project" link={{ href: `${CONSOLE}/projectcreate`, label: "Open Google Cloud" }}>
            Sign in with your company Google Workspace admin account. Create a project, for example <b>GFT Vision</b>, or pick an existing one.
          </Step>
          <Step n={2} title="Turn on the Gmail API" link={{ href: `${CONSOLE}/apis/library/gmail.googleapis.com`, label: "Gmail API" }}>
            Make sure your project is selected at the top, then click <b>Enable</b>.
          </Step>
          <Step n={3} title="Set up the consent screen" link={{ href: `${CONSOLE}/auth/branding`, label: "Consent screen" }}>
            Choose User type <b>Internal</b> (only people in your company domain can sign in, and Google doesn&apos;t need to review the app).
            Enter an app name and support email. Under <b>Data Access</b>, add this scope:
            <CopyValue value={setup.scope} />
          </Step>
          <Step n={4} title="Create the OAuth client" link={{ href: `${CONSOLE}/auth/clients/create`, label: "Create client" }}>
            Application type <b>Web application</b>. Under <b>Authorized JavaScript origins</b> add:
            <CopyValue value={setup.appOrigin} />
            <span className="mt-2 block">Under <b>Authorized redirect URIs</b> add:</span>
            <CopyValue value={setup.redirectUri} />
          </Step>
          <Step n={5} title="Copy the keys into GFT Vision">
            Google shows a <b>Client ID</b> and <b>Client Secret</b> after you click Create. Paste them on the right and click <b>Verify &amp; Save</b>.
          </Step>
        </ol>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          {fromServer ? (
            <>
              <p className="text-[13px] font-semibold text-slate-800">Keys are set on the server</p>
              <p className="text-[12px] text-slate-500">
                The Google keys come from the server settings (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET), so they can&apos;t be changed here.
              </p>
              <p className="truncate text-[11.5px] text-slate-500">Client ID: <code>{setup.clientId}</code></p>
            </>
          ) : (
            <>
              <Input
                compact
                label="Client ID"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="1234567890-abc….apps.googleusercontent.com"
                autoComplete="off"
                spellCheck={false}
              />
              <Input
                compact
                label="Client Secret"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={replacing ? "Leave empty to keep the saved secret" : "GOCSPX-…"}
                autoComplete="new-password"
              />
              {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">{error}</p>}
              <Button size="sm" className="w-full" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                {saving ? "Checking with Google…" : "Verify & Save"}
              </Button>
              <p className="text-[11px] text-slate-400">
                The secret is stored encrypted and is never shown again. Everyone uses these keys to connect their own Gmail; nobody can read anyone else&apos;s mailbox.
              </p>
              {replacing && (
                <div className={cn("flex items-center justify-between gap-2 border-t border-slate-200 pt-3")}>
                  <p className="text-[11px] text-slate-500">
                    Saved{setup.updatedByName ? ` by ${setup.updatedByName}` : ""}
                    {setup.updatedAt ? ` on ${new Date(setup.updatedAt).toLocaleDateString("en-US", { timeZone: APP_TZ, month: "short", day: "numeric", year: "numeric" })}` : ""}
                  </p>
                  <button type="button" onClick={remove} className="flex items-center gap-1 text-[11.5px] font-semibold text-rose-600 hover:underline">
                    <Trash2 className="h-3 w-3" /> Remove keys
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
