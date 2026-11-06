"use client";

import { useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, ExternalLink, Loader2, Pencil, Plus, Star, Trash2, X, Zap } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toast, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { PROVIDERS, type ProviderId } from "@/lib/ai/catalog";
import type { AiProviderRow } from "@/lib/ai/admin";

interface FormState {
  id?: string;
  provider: ProviderId;
  label: string;
  apiKey: string;
  model: string;
  baseUrl: string;
}

const emptyForm = (provider: ProviderId = "openai"): FormState => ({
  provider,
  label: "",
  apiKey: "",
  model: PROVIDERS[provider].defaultModel,
  baseUrl: "",
});

export function AiSettingsView({ providers: initial }: { providers: AiProviderRow[] }) {
  const { toast, show, hide } = useToast();
  const [providers, setProviders] = useState(initial);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const call = async (url: string, method: string, body?: unknown) => {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Request failed");
    return data;
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const data = form.id
        ? await call(`/api/ai-providers/${form.id}`, "PATCH", { label: form.label, apiKey: form.apiKey, model: form.model, baseUrl: form.baseUrl })
        : await call("/api/ai-providers", "POST", form);
      setProviders(data);
      setForm(null);
      show(form.id ? "AI provider updated" : "AI provider added. Click Test to check the key.", "success");
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  const action = async (id: string, kind: "test" | "default" | "toggle" | "delete", row: AiProviderRow) => {
    if (kind === "delete" && !confirm(`Remove "${row.label}"? Its API key is deleted.`)) return;
    setBusy(`${id}-${kind}`);
    try {
      if (kind === "test") {
        const data = await call(`/api/ai-providers/${id}/test`, "POST");
        setProviders(data.providers);
        show(data.ok ? `${row.label} works` : `Test failed: ${data.error}`, data.ok ? "success" : "error");
      } else if (kind === "delete") {
        setProviders(await call(`/api/ai-providers/${id}`, "DELETE"));
      } else {
        setProviders(
          await call(`/api/ai-providers/${id}`, "PATCH", kind === "default" ? { isDefault: true } : { isEnabled: !row.isEnabled }),
        );
      }
    } catch (err) {
      show(err instanceof Error ? err.message : "Request failed", "error");
    } finally {
      setBusy(null);
    }
  };

  const meta = form ? PROVIDERS[form.provider] : null;

  return (
    <>
      <Header title="AI Settings" subtitle="API keys used for AI resume updates and ATS scoring" />
      <div className="space-y-5 p-6">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-5 py-4">
          <Bot className="h-5 w-5 text-indigo-600" />
          <p className="mr-auto max-w-3xl text-[12.5px] text-slate-600">
            Add one or more AI providers. The <b>default</b> enabled provider is used everywhere in the app (Easy Submissions resume updates).
            Keys are stored encrypted and only shown as a preview.
          </p>
          <Button onClick={() => setForm(emptyForm())}><Plus className="h-4 w-4" /> Add AI Provider</Button>
        </div>

        {providers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <Bot className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">No AI provider configured yet</p>
            <p className="mt-1 text-xs text-slate-400">Add an OpenAI, Claude or Gemini API key to turn on AI resume updates.</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {providers.map((p) => (
              <div key={p.id} className={cn("rounded-2xl border bg-white p-5 shadow-sm", p.isDefault ? "border-indigo-300 ring-2 ring-indigo-100" : "border-slate-200", !p.isEnabled && "opacity-60")}>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900"><Bot className="h-5 w-5 text-white" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14px] font-bold text-slate-900">{p.label}</p>
                      {p.isDefault && <span className="flex items-center gap-1 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white"><Star className="h-2.5 w-2.5" /> Default</span>}
                      {!p.isEnabled && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">Disabled</span>}
                    </div>
                    <p className="text-[12px] text-slate-500">{p.providerName}</p>
                  </div>
                  <button onClick={() => setForm({ id: p.id, provider: p.provider as ProviderId, label: p.label, apiKey: "", model: p.model, baseUrl: p.baseUrl ?? "" })} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
                  <div><dt className="text-[10px] font-semibold uppercase text-slate-400">Model</dt><dd className="font-mono text-slate-800">{p.model}</dd></div>
                  <div><dt className="text-[10px] font-semibold uppercase text-slate-400">API Key</dt><dd className="font-mono text-slate-800">{p.keyPreview}</dd></div>
                  {p.baseUrl && <div className="col-span-2"><dt className="text-[10px] font-semibold uppercase text-slate-400">Base URL</dt><dd className="truncate font-mono text-slate-800">{p.baseUrl}</dd></div>}
                </dl>
                {p.lastTestedAt && (
                  <p className={cn("mt-3 flex items-center gap-1.5 text-[11.5px]", p.lastError ? "text-rose-600" : "text-emerald-700")}>
                    {p.lastError ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    {p.lastError ?? "Working"} · tested {new Date(p.lastTestedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <Button size="sm" variant="outline" onClick={() => action(p.id, "test", p)} disabled={!!busy}>
                    {busy === `${p.id}-test` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Test
                  </Button>
                  {!p.isDefault && (
                    <Button size="sm" variant="outline" onClick={() => action(p.id, "default", p)} disabled={!!busy}>
                      <Star className="h-3.5 w-3.5" /> Make default
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => action(p.id, "toggle", p)} disabled={!!busy}>
                    {p.isEnabled ? "Disable" : "Enable"}
                  </Button>
                  <Button size="sm" variant="ghost" className="ml-auto text-rose-600 hover:bg-rose-50" onClick={() => action(p.id, "delete", p)} disabled={!!busy}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {form && meta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
          <div className="absolute inset-0" onClick={() => setForm(null)} aria-hidden="true" />
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between rounded-t-2xl bg-slate-800 px-5 py-3">
              <h2 className="text-[14px] font-semibold text-white">{form.id ? "Edit AI Provider" : "Add AI Provider"}</h2>
              <button onClick={() => setForm(null)} className="text-slate-300 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <label className="block space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Provider</span>
                <select
                  value={form.provider}
                  disabled={!!form.id}
                  onChange={(e) => setForm({ ...emptyForm(e.target.value as ProviderId), label: form.label, apiKey: form.apiKey })}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] disabled:bg-slate-50"
                >
                  {(Object.keys(PROVIDERS) as ProviderId[]).map((id) => <option key={id} value={id}>{PROVIDERS[id].name}</option>)}
                </select>
              </label>
              <Input compact label="Name (optional)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder={meta.name} />
              <div>
                <Input
                  compact
                  label={form.id ? "API Key (leave empty to keep the saved key)" : "API Key"}
                  type="password"
                  autoComplete="new-password"
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  placeholder={meta.keyHint}
                />
                {meta.keyUrl && (
                  <a href={meta.keyUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold text-indigo-600 hover:underline">
                    Get an API key <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <Input compact label="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Model name, e.g. gpt-4.1-mini" />
              {meta.needsBaseUrl && (
                <Input compact label="Base URL" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="https://api.groq.com/openai/v1" />
              )}
              <p className="text-[11px] text-slate-400">Use any model your account has access to. Bigger models write better resumes but cost more per update.</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
            </div>
          </div>
        </div>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </>
  );
}
