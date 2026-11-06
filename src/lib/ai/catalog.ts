// Supported AI providers. No server imports: the AI Settings page uses this list too.

export type ProviderId = "openai" | "anthropic" | "gemini" | "openai-compatible";

export const PROVIDERS: Record<ProviderId, {
  name: string;
  /** Pre-filled model; admins can type any model the account has access to */
  defaultModel: string;
  keyHint: string;
  keyUrl?: string;
  needsBaseUrl?: boolean;
}> = {
  openai: { name: "OpenAI (ChatGPT)", defaultModel: "gpt-4.1-mini", keyHint: "sk-…", keyUrl: "https://platform.openai.com/api-keys" },
  anthropic: { name: "Anthropic (Claude)", defaultModel: "claude-sonnet-5-5", keyHint: "sk-ant-…", keyUrl: "https://console.anthropic.com/settings/keys" },
  gemini: { name: "Google Gemini", defaultModel: "gemini-2.5-flash", keyHint: "AIza…", keyUrl: "https://aistudio.google.com/apikey" },
  "openai-compatible": {
    name: "OpenAI-compatible (Azure, Groq, DeepSeek, OpenRouter…)",
    defaultModel: "",
    keyHint: "API key",
    needsBaseUrl: true,
  },
};

export const isProviderId = (v: unknown): v is ProviderId => typeof v === "string" && v in PROVIDERS;
