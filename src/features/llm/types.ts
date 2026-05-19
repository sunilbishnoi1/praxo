export const LLM_PROVIDERS = [
  "openai",
  "anthropic",
  "gemini",
  "groq",
  "openrouter",
  "ollama",
] as const;

export type LLMProviderId = (typeof LLM_PROVIDERS)[number];

export const PROVIDER_IDS = [...LLM_PROVIDERS, "deepgram"] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json";
  systemPrompt?: string;
};

export type ChatResponse = {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: "stop" | "length" | "content_filter" | "error";
  latencyMs: number;
};

export type StreamChunk = {
  content: string;
  done: boolean;
  usage?: ChatResponse["usage"];
};

export type ConnectionTestResult = {
  success: boolean;
  latencyMs: number;
  model: string;
  error?: string;
  message?: string;
};

export type ModelInfo = {
  id: string;
  name: string;
  contextWindow: number;
  supportsJson: boolean;
};

export interface LLMProvider {
  readonly id: LLMProviderId;
  readonly name: string;
  readonly supportsStreaming: boolean;
  readonly maxContextTokens: Record<string, number>;

  chat(request: ChatRequest): Promise<ChatResponse>;
  chatStream(request: ChatRequest): AsyncGenerator<StreamChunk>;
  testConnection(): Promise<ConnectionTestResult>;
  listModels(): Promise<ModelInfo[]>;
  countTokens(text: string, model: string): number;
}

export type ProviderStatus = {
  provider: ProviderId;
  isConfigured: boolean;
  isValid: boolean;
  model: string | null;
  lastTestedAt: string | null;
};

export type ProviderConfigInput = {
  provider: ProviderId;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

export type ProviderTestResult = {
  provider: ProviderId;
  isValid: boolean;
  latencyMs: number;
  model: string;
  message: string;
};

export type ProviderSaveResult = {
  provider: ProviderId;
  isConfigured: boolean;
  isValid: boolean;
  message: string;
};
