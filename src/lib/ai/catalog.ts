// Supported AI providers. No server imports: the AI Settings page uses this list too.

export type ProviderId = "openai" | "anthropic" | "gemini" | "openai-compatible";

export const PROVIDERS: Record<ProviderId, {
  name: string;
  /** Pre-filled model; admins can type any model the account has access to */
  defaultModel: string;
  /** Offered in the Model dropdown (an "Other" choice allows any other model name) */
  models: { id: string; note: string }[];
  keyHint: string;
  keyUrl?: string;
  needsBaseUrl?: boolean;
}> = {
  openai: {
    name: "OpenAI (ChatGPT)", defaultModel: "gpt-4.1-mini", keyHint: "sk-…", keyUrl: "https://platform.openai.com/api-keys",
    models: [
      { id: "gpt-4.1-mini", note: "Recommended: good and fast, about 1¢ per resume" },
      { id: "gpt-4.1", note: "Best writing, about 5¢ per resume" },
      { id: "gpt-4.1-nano", note: "Cheapest, basic quality" },
      { id: "gpt-4o", note: "Previous generation, strong" },
      { id: "gpt-4o-mini", note: "Previous generation, cheap" },
      { id: "o4-mini", note: "Reasoning model, slower" },
    ],
  },
  anthropic: {
    name: "Anthropic (Claude)", defaultModel: "claude-sonnet-5-5", keyHint: "sk-ant-…", keyUrl: "https://console.anthropic.com/settings/keys",
    models: [
      { id: "claude-sonnet-5-5", note: "Recommended: strong writing at a fair price" },
      { id: "claude-opus-5-5", note: "Most capable, costs more" },
      { id: "claude-haiku-5-5", note: "Fastest and cheapest" },
      { id: "claude-fable-5-1", note: "Most capable Claude model, costs the most" },
    ],
  },
  gemini: {
    name: "Google Gemini", defaultModel: "gemini-2.5-flash", keyHint: "AIza…", keyUrl: "https://aistudio.google.com/apikey",
    models: [
      { id: "gemini-2.5-flash", note: "Recommended: fast and cheap" },
      { id: "gemini-2.5-pro", note: "Best quality, costs more" },
      { id: "gemini-2.5-flash-lite", note: "Cheapest, basic quality" },
    ],
  },
  "openai-compatible": {
    name: "OpenAI-compatible (Azure, Groq, DeepSeek, OpenRouter…)",
    defaultModel: "",
    models: [],
    keyHint: "API key",
    needsBaseUrl: true,
  },
};

export const isProviderId = (v: unknown): v is ProviderId => typeof v === "string" && v in PROVIDERS;
