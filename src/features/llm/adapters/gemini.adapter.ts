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

const geminiResponseSchema = z.object({
  candidates: z.array(
    z.object({
      content: z.object({
        parts: z.array(
          z.object({
            text: z.string().optional(),
          })
        ),
      }),
      finishReason: z.string().optional(),
    })
  ),
  usageMetadata: z
    .object({
      promptTokenCount: z.number().int().nonnegative().optional(),
      candidatesTokenCount: z.number().int().nonnegative().optional(),
      totalTokenCount: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

const geminiErrorSchema = z.object({
  error: z.object({
    message: z.string().optional(),
  }),
});

const DEFAULT_TOKEN_RATIO = 4;

export class GeminiAdapter implements LLMProvider {
  readonly id = "gemini" as const;
  readonly name = "Google Gemini";
  readonly supportsStreaming = false;
  readonly maxContextTokens: Record<string, number> = {
    "gemini-2.5-pro": 1048576,
    "gemini-2.5-flash": 1048576,
    "gemini-2.0-flash": 1048576,
  };

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel?: string;

  constructor(apiKey: string, baseUrl?: string, defaultModel?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
    this.defaultModel = defaultModel;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startedAt = Date.now();
    const model = request.model === "default" || !request.model ? this.resolveDefaultModel() : request.model;
    const systemPrompt = this.buildSystemPrompt(request);
    const contents = request.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      }));

    const response = await fetch(
      `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents,
          systemInstruction: systemPrompt
            ? { parts: [{ text: systemPrompt }] }
            : undefined,
          generationConfig: {
            temperature: request.temperature ?? 0.7,
            maxOutputTokens: request.maxTokens,
          },
        }),
      }
    );

    if (!response.ok) {
      throw await this.buildError(response, "Gemini request failed.");
    }

    const payload: unknown = await response.json();
    const parsed = geminiResponseSchema.safeParse(payload);

    if (!parsed.success) {
      throw new LLMError(
        "Invalid response from Gemini.",
        this.id,
        "INVALID_RESPONSE",
        false
      );
    }

    const candidate = parsed.data.candidates[0];
    const content = candidate?.content.parts
      .map((part) => part.text ?? "")
      .join("");
    const usage = parsed.data.usageMetadata;

    return {
      content: content ?? "",
      model,
      usage: {
        promptTokens: usage?.promptTokenCount ?? 0,
        completionTokens: usage?.candidatesTokenCount ?? 0,
        totalTokens: usage?.totalTokenCount ?? 0,
      },
      finishReason: this.mapFinishReason(candidate?.finishReason),
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

  private buildSystemPrompt(request: ChatRequest): string {
    const systemMessages = request.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content);

    return [request.systemPrompt, ...systemMessages].filter(Boolean).join("\n");
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

  private mapFinishReason(reason?: string): ChatResponse["finishReason"] {
    if (reason === "MAX_TOKENS") {
      return "length";
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
      const parsed = geminiErrorSchema.safeParse(payload);
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
