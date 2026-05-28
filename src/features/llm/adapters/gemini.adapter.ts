import { z } from "zod";

import {
  ChatRequest,
  ChatResponse,
  ConnectionTestResult,
  LLMProvider,
  ModelInfo,
  StreamChunk,
} from "../types";
import { LLMError, RETRY_CONFIG, isRetryableError, mapHttpStatusToErrorCode } from "../errors";

const geminiResponseSchema = z.object({
  candidates: z.array(
    z.object({
      content: z
        .object({
          parts: z
            .array(
              z.object({
                text: z.string().optional(),
              })
            )
            .optional(),
        })
        .optional(),
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

const GEMINI_DEPRECATED_MODELS = new Set<string>([
  "gemini-2.5-flash-live-preview",
  "gemini-2.5-flash-preview-native-audio-dialog",
  "models/gemini-2.5-flash-preview-native-audio-dialog",
  "gemini-2.0-flash-live-001",
]);

export function normalizeGeminiModel(model: string): string {
  const trimmed = model.trim();
  if (!trimmed) {
    return trimmed;
  }

  const withoutPrefix = trimmed.startsWith("models/")
    ? trimmed.slice("models/".length)
    : trimmed;

  if (GEMINI_DEPRECATED_MODELS.has(withoutPrefix)) {
    console.warn(`[Gemini Adapter] Model '${model}' is deprecated. Proceeding anyway.`);
  }

  return withoutPrefix;
}

// Gemini Live API (realtime/multimodal) models require v1alpha API version
const GEMINI_LIVE_API_MODELS = new Set([
  "gemini-3.1-flash-live-preview",
  "gemini-2.5-flash-native-audio-preview-12-2025",
]);

const GEMINI_LIVE_MODEL_HINT = /(live|native-audio)/i;

export function isGeminiLiveModel(model: string): boolean {
  try {
    const normalized = normalizeGeminiModel(model);
    return GEMINI_LIVE_API_MODELS.has(normalized) || GEMINI_LIVE_MODEL_HINT.test(normalized);
  } catch {
    return false;
  }
}

export class GeminiAdapter implements LLMProvider {
  readonly id = "gemini" as const;
  readonly name = "Google Gemini";
  readonly supportsStreaming = false;
  readonly maxContextTokens: Record<string, number> = {
    "gemini-3.5-flash": 1000000,
    "gemini-3.1-flash": 1000000,
    "gemini-3.1-flash-live-preview": 128000,
    "gemini-2.5-pro": 1048576,
    "gemini-2.5-flash": 1000000,
    "gemini-2.5-flash-native-audio-preview-12-2025": 128000,
    "gemini-2.0-flash": 1048576,
  };

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel?: string;

  constructor(apiKey: string, baseUrl?: string, defaultModel?: string) {
    this.apiKey = apiKey;
    const normalizedDefaultModel = defaultModel
      ? normalizeGeminiModel(defaultModel)
      : undefined;
    // Use v1alpha for Live API models, v1beta for standard models
    const apiVersion = normalizedDefaultModel && isGeminiLiveModel(normalizedDefaultModel)
      ? "v1alpha"
      : "v1beta";
    this.baseUrl = baseUrl ?? `https://generativelanguage.googleapis.com/${apiVersion}`;
    this.defaultModel = normalizedDefaultModel;
  }

  // Determine API version based on model name
  private getApiVersion(model: string): string {
    return isGeminiLiveModel(model) ? "v1alpha" : "v1beta";
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startedAt = Date.now();
    const resolvedModel = request.model === "default" || !request.model
      ? this.resolveDefaultModel()
      : request.model;
    const model = normalizeGeminiModel(resolvedModel);
    
    // Detect if this is a Live API model and build appropriate endpoint
    const apiVersion = this.getApiVersion(model);
    const baseUrl = this.baseUrl.includes("generativelanguage.googleapis.com")
      ? `https://generativelanguage.googleapis.com/${apiVersion}`
      : this.baseUrl;
    
    const systemPrompt = this.buildSystemPrompt(request);
    const contents = request.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      }));

    const response = await this.fetchWithRetry(
      `${baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
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
      },
      "Gemini request failed."
    );

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
    const content = candidate?.content?.parts
      ? candidate.content.parts.map((part) => part.text ?? "").join("")
      : "";
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
    const model = normalizeGeminiModel(this.resolveDefaultModel());
    const startedAt = Date.now();

    if (!model) {
      return {
        success: false,
        latencyMs: 0,
        model: "unknown",
        error: "No model configured for Gemini provider.",
      };
    }

    // Note: Live API models (gemini-*-live-*) require WebSocket connections
    // and cannot be tested via generateContent. Test passes if model name is valid.
    const isLiveModel = isGeminiLiveModel(model);
    if (isLiveModel) {
      try {
        await this.verifyModelAvailability(model);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return {
          success: false,
          latencyMs: Date.now() - startedAt,
          model,
          error: message,
        };
      }

      return {
        success: true,
        latencyMs: Date.now() - startedAt,
        model,
        message: `Live API model '${model}' configured. Use WebSocket connection (v1alpha) for realtime mode.`,
      };
    }

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

  private async verifyModelAvailability(model: string): Promise<void> {
    const apiVersion = this.getApiVersion(model);
    const baseUrl = this.baseUrl.includes("generativelanguage.googleapis.com")
      ? `https://generativelanguage.googleapis.com/${apiVersion}`
      : this.baseUrl;
    await this.fetchWithRetry(
      `${baseUrl}/models/${model}`,
      {
        headers: {
          "x-goog-api-key": this.apiKey,
        },
      },
      "Gemini model lookup failed."
    );
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

    return new LLMError(message, this.id, code, isRetryableError(code));
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    fallbackMessage: string
  ): Promise<Response> {
    let attempt = 0;
    let delayMs = RETRY_CONFIG.initialDelayMs;

    while (true) {
      try {
        const response = await fetch(url, options);
        if (!response.ok) {
          throw await this.buildError(response, fallbackMessage);
        }
        return response;
      } catch (error) {
        const normalized = this.normalizeFetchError(error, fallbackMessage);
        if (!isRetryableError(normalized.code) || attempt >= RETRY_CONFIG.maxRetries) {
          throw normalized;
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs = Math.min(delayMs * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs);
        attempt += 1;
      }
    }
  }

  private normalizeFetchError(error: unknown, fallbackMessage: string): LLMError {
    if (error instanceof LLMError) {
      return error;
    }

    const err = error instanceof Error ? error : new Error(fallbackMessage);
    const cause = (err as { cause?: { code?: string } }).cause;
    const causeCode = cause?.code;
    const isTimeout = causeCode === "UND_ERR_CONNECT_TIMEOUT" || causeCode === "UND_ERR_HEADERS_TIMEOUT";

    return new LLMError(
      err.message || fallbackMessage,
      this.id,
      isTimeout ? "TIMEOUT" : "NETWORK_ERROR",
      true,
      err
    );
  }
}
