export interface Model {
  id: string;
  label: string;
  provider: string;
}

export const DEFAULT_MODEL_ID = "google/gemini-2.0-flash-001";

export const models: Model[] = [
  { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash", provider: "Google" },
  { id: "google/gemini-2.5-flash-preview-05-20", label: "Gemini 2.5 Flash", provider: "Google" },
  { id: "google/gemini-2.5-pro-preview-06-05", label: "Gemini 2.5 Pro", provider: "Google" },
  { id: "anthropic/claude-sonnet-4-20250514", label: "Claude Sonnet 4", provider: "Anthropic" },
  { id: "anthropic/claude-3.5-haiku-20241022", label: "Claude 3.5 Haiku", provider: "Anthropic" },
  { id: "openai/gpt-4o", label: "GPT-4o", provider: "OpenAI" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI" },
  { id: "deepseek/deepseek-chat-v3-0324", label: "DeepSeek V3", provider: "DeepSeek" },
  { id: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick", provider: "Meta" },
];
