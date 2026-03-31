export interface Model {
  id: string;
  label: string;
  provider: string;
  supportsVision: boolean;
}

export const DEFAULT_MODEL_ID = "google/gemini-3-flash-preview";

export const models: Model[] = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", provider: "Google", supportsVision: true },
  { id: "google/gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash Lite", provider: "Google", supportsVision: true },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", provider: "Google", supportsVision: true },
  { id: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6", provider: "Anthropic", supportsVision: true },
  { id: "anthropic/claude-opus-4.6", label: "Claude Opus 4.6", provider: "Anthropic", supportsVision: true },
  { id: "openai/gpt-5.4", label: "GPT-5.4", provider: "OpenAI", supportsVision: true },
  { id: "openai/gpt-5.4-mini", label: "GPT-5.4 Mini", provider: "OpenAI", supportsVision: true },
  { id: "openai/gpt-5.4-pro", label: "GPT-5.4 Pro", provider: "OpenAI", supportsVision: true },
  { id: "x-ai/grok-4.20", label: "Grok 4.20", provider: "xAI", supportsVision: true },
];

export function modelSupportsVision(modelId: string): boolean {
  const model = models.find((m) => m.id === modelId);
  return model?.supportsVision ?? true;
}
