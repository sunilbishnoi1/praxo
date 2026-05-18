import { LLMError } from "../errors";
import type { ConnectionTestResult } from "../types";
import { OpenAIAdapter } from "./openai.adapter";

export class OllamaAdapter extends OpenAIAdapter {
  readonly id = "ollama" as const;
  readonly name = "Ollama (Local)";
  readonly maxContextTokens: Record<string, number> = {
    "llama3.1": 128000,
    "llama3.2": 128000,
  };

  constructor(baseUrl: string, defaultModel?: string) {
    super("ollama", {
      baseUrl: `${baseUrl.replace(/\/$/, "")}/v1`,
      defaultModel,
    });
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const startedAt = Date.now();
    const tagsUrl = this.baseUrl.replace(/\/v1$/, "") + "/api/tags";

    try {
      const response = await fetch(tagsUrl);

      if (!response.ok) {
        throw new LLMError(
          "Failed to connect to Ollama.",
          this.id,
          "NETWORK_ERROR",
          false
        );
      }

      const payload: unknown = await response.json();
      const data = payload as { models?: { name?: string }[] } | null;
      const model = data?.models?.[0]?.name ?? this.resolveDefaultModel();

      return {
        success: true,
        latencyMs: Date.now() - startedAt,
        model,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      return {
        success: false,
        latencyMs: Date.now() - startedAt,
        model: this.defaultModel ?? "unknown",
        error: message,
      };
    }
  }
}
