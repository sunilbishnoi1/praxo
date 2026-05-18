import { z } from "zod";

import {
  ChatRequest,
  ChatResponse,
  ConnectionTestResult,
  LLMProvider,
  ModelInfo,
  StreamChunk,
} from "../types";
import { LLMError, mapHttpStatusToErrorCode } from "../errors";

const anthropicResponseSchema = z.object({
  model: z.string(),
  content: z.array(
    z.object({
      type: z.string(),
      text: z.string().optional(),
    })
  ),
  stop_reason: z.string().nullable().optional(),
  usage: z.object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
  }),
});

const anthropicErrorSchema = z.object({
  error: z.object({
    message: z.string().optional(),
    type: z.string().optional(),
  }),
});

const DEFAULT_TOKEN_RATIO = 4;

export class AnthropicAdapter implements LLMProvider {
  readonly id = "anthropic" as const;
  readonly name = "Anthropic";
  readonly supportsStreaming = false;
  readonly maxContextTokens: Record<string, number> = {
    "claude-sonnet-4-20250514": 200000,
    "claude-opus-4-20250514": 200000,
    "claude-3-5-haiku-20241022": 200000,
  };

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel?: string;

  constructor(apiKey: string, baseUrl?: string, defaultModel?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl ?? "https://api.anthropic.com/v1";
    this.defaultModel = defaultModel;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startedAt = Date.now();
    const model = request.model === "default" || !request.model ? this.resolveDefaultModel() : request.model;
    const { systemPrompt, messages } = this.splitMessages(request);

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        system: systemPrompt || undefined,
        messages,
        max_tokens: request.maxTokens ?? 1024,
        temperature: request.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      throw await this.buildError(response, "Anthropic request failed.");
    }

    const payload: unknown = await response.json();
    const parsed = anthropicResponseSchema.safeParse(payload);

    if (!parsed.success) {
      throw new LLMError(
        "Invalid response from Anthropic.",
        this.id,
        "INVALID_RESPONSE",
        false
      );
    }

    const textContent = parsed.data.content
      .map((part) => part.text ?? "")
      .join("");

    return {
      content: textContent,
      model: parsed.data.model,
      usage: {
        promptTokens: parsed.data.usage.input_tokens,
        completionTokens: parsed.data.usage.output_tokens,
        totalTokens:
          parsed.data.usage.input_tokens + parsed.data.usage.output_tokens,
      },
      finishReason: this.mapFinishReason(parsed.data.stop_reason),
      latencyMs: Date.now() - startedAt,
    };
  }

  async *chatStream(request: ChatRequest): AsyncGenerator<StreamChunk> {
    const response = await this.chat(request);
    yield {
      content: response.content,
      done: true,
      usage: response.usage,
    };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const model = this.resolveDefaultModel();
    const startedAt = Date.now();

    try {
      await this.chat({
        model,
        messages: [{ role: "user", content: "ping" }],
        maxTokens: 1,
        temperature: 0,
      });

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
        model,
        error: message,
      };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    return Object.entries(this.maxContextTokens).map(([id, contextWindow]) => ({
      id,
      name: id,
      contextWindow,
      supportsJson: true,
    }));
  }

  countTokens(text: string, _model: string): number {
    return Math.ceil(text.length / DEFAULT_TOKEN_RATIO);
  }

  private splitMessages(request: ChatRequest): {
    systemPrompt: string;
    messages: { role: "user" | "assistant"; content: string }[];
  } {
    const systemMessages = request.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content);

    const systemPrompt = [request.systemPrompt, ...systemMessages]
      .filter(Boolean)
      .join("\n");

    const messages = request.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: (message.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        content: message.content,
      }));

    return { systemPrompt, messages };
  }

  private resolveDefaultModel(): string {
    if (this.defaultModel) {
      return this.defaultModel;
    }

    const fallbackModel = Object.keys(this.maxContextTokens)[0];

    if (!fallbackModel) {
      throw new LLMError(
        "No default model configured.",
        this.id,
        "MODEL_NOT_FOUND",
        false
      );
    }

    return fallbackModel;
  }

  private mapFinishReason(reason?: string | null): ChatResponse["finishReason"] {
    if (reason === "max_tokens") {
      return "length";
    }

    if (reason === "content_filtered") {
      return "content_filter";
    }

    return "stop";
  }

  private async buildError(
    response: Response,
    fallbackMessage: string
  ): Promise<LLMError> {
    const status = response.status;
    let message = fallbackMessage;

    try {
      const payload: unknown = await response.json();
      const parsed = anthropicErrorSchema.safeParse(payload);
      if (parsed.success && parsed.data.error.message) {
        message = parsed.data.error.message;
      }
    } catch (error) {
      if (error instanceof Error) {
        message = error.message || message;
      }
    }

    const code = mapHttpStatusToErrorCode(status);

    return new LLMError(message, this.id, code, code === "RATE_LIMITED");
  }
}
