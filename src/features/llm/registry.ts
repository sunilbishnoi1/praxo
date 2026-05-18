import type { LLMProvider, LLMProviderId } from "./types";
import { AnthropicAdapter } from "./adapters/anthropic.adapter";
import { GeminiAdapter } from "./adapters/gemini.adapter";
import { GroqAdapter } from "./adapters/groq.adapter";
import { OllamaAdapter } from "./adapters/ollama.adapter";
import { OpenAIAdapter } from "./adapters/openai.adapter";
import { OpenRouterAdapter } from "./adapters/openrouter.adapter";

export type LLMProviderOptions = {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
};

const adapterFactories: Record<
  LLMProviderId,
  (options: LLMProviderOptions) => LLMProvider
> = {
  openai: (options) =>
    new OpenAIAdapter(options.apiKey ?? "", {
      baseUrl: options.baseUrl,
      defaultModel: options.defaultModel,
    }),
  anthropic: (options) =>
    new AnthropicAdapter(
      options.apiKey ?? "",
      options.baseUrl,
      options.defaultModel
    ),
  gemini: (options) =>
    new GeminiAdapter(options.apiKey ?? "", options.baseUrl, options.defaultModel),
  groq: (options) => new GroqAdapter(options.apiKey ?? "", options.defaultModel),
  openrouter: (options) =>
    new OpenRouterAdapter(options.apiKey ?? "", options.defaultModel),
  ollama: (options) =>
    new OllamaAdapter(options.baseUrl ?? "http://localhost:11434", options.defaultModel),
};

export function createLLMProvider(
  providerId: LLMProviderId,
  options: LLMProviderOptions
): LLMProvider {
  const factory = adapterFactories[providerId];
  if (!factory) {
    throw new Error(
      `Unknown LLM provider: ${providerId}. Supported: ${Object.keys(
        adapterFactories
      ).join(", ")}`
    );
  }

  return factory(options);
}

export function getSupportedProviders(): LLMProviderId[] {
  return Object.keys(adapterFactories) as LLMProviderId[];
}
