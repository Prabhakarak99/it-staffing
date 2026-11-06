import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/gmail/crypto";
import { PROVIDERS, type ProviderId } from "./catalog";

export interface AiConfig {
  id: string;
  provider: ProviderId;
  label: string;
  model: string;
  apiKey: string;
  baseUrl: string | null;
}

export class AiError extends Error {}

/** The admin's default enabled provider, otherwise the first enabled one */
export async function getActiveAi(): Promise<AiConfig | null> {
  const row = await prisma.aiProvider.findFirst({
    where: { isEnabled: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  if (!row || !(row.provider in PROVIDERS)) return null;
  return {
    id: row.id,
    provider: row.provider as ProviderId,
    label: row.label,
    model: row.model,
    apiKey: decrypt(row.apiKeyEnc),
    baseUrl: row.baseUrl,
  };
}

/** Pulls the JSON object out of a model reply (some wrap it in ``` fences or add a sentence) */
function parseJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new AiError("The AI did not return JSON");
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    throw new AiError("The AI returned malformed JSON. Please try again.");
  }
}

async function post(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  }).catch((err: unknown) => {
    throw new AiError(err instanceof Error && err.name === "TimeoutError" ? "The AI took too long to answer" : "Could not reach the AI service");
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const e = json?.error as { message?: string } | string | undefined;
    const message = typeof e === "string" ? e : e?.message;
    throw new AiError(`AI request failed (${res.status})${message ? `: ${message}` : ""}`);
  }
  return json ?? {};
}

/** One JSON-only completion with whichever provider is configured */
export async function aiJson<T>(cfg: AiConfig, opts: { system: string; user: string; maxTokens?: number; timeoutMs?: number }): Promise<T> {
  const maxTokens = opts.maxTokens ?? 4000;
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const system = `${opts.system}\n\nRespond with a single JSON object only, no other text.`;

  switch (cfg.provider) {
    case "openai":
    case "openai-compatible": {
      const base = cfg.provider === "openai" ? "https://api.openai.com/v1" : (cfg.baseUrl ?? "").replace(/\/$/, "");
      if (!base) throw new AiError("This provider needs a Base URL");
      const json = await post(
        `${base}/chat/completions`,
        { Authorization: `Bearer ${cfg.apiKey}` },
        {
          model: cfg.model,
          messages: [{ role: "system", content: system }, { role: "user", content: opts.user }],
          response_format: { type: "json_object" },
          // OpenAI's newer models only accept max_completion_tokens; compatible APIs mostly take max_tokens
          ...(cfg.provider === "openai" ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }),
        },
        timeoutMs,
      );
      const choice = (json.choices as { message?: { content?: string } }[] | undefined)?.[0];
      return parseJson<T>(choice?.message?.content ?? "");
    }
    case "anthropic": {
      const json = await post(
        "https://api.anthropic.com/v1/messages",
        { "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01" },
        { model: cfg.model, max_tokens: maxTokens, system, messages: [{ role: "user", content: opts.user }] },
        timeoutMs,
      );
      const text = ((json.content as { type: string; text?: string }[] | undefined) ?? [])
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("");
      return parseJson<T>(text);
    }
    case "gemini": {
      const json = await post(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`,
        { "x-goog-api-key": cfg.apiKey },
        {
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: opts.user }] }],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: maxTokens },
        },
        timeoutMs,
      );
      const parts = (json.candidates as { content?: { parts?: { text?: string }[] } }[] | undefined)?.[0]?.content?.parts ?? [];
      return parseJson<T>(parts.map((p) => p.text ?? "").join(""));
    }
  }
}

/** Short round trip used by the "Test" button in AI Settings */
export async function testAi(cfg: AiConfig) {
  const reply = await aiJson<{ ok?: boolean }>(cfg, {
    system: "You are a connectivity check.",
    user: 'Reply with {"ok": true}',
    maxTokens: 50,
    timeoutMs: 30_000,
  });
  if (reply.ok !== true) throw new AiError("The AI answered, but not as expected");
}
