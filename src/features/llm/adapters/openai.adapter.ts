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

const openAiUsageSchema = z.object({
  prompt_tokens: z.number().int().nonnegative().optional(),
  completion_tokens: z.number().int().nonnegative().optional(),
  total_tokens: z.number().int().nonnegative().optional(),
});

const openAiChoiceSchema = z.object({
  message: z
    .object({
      content: z.string().nullable().optional(),
    })
    .optional(),
  finish_reason: z.string().nullable().optional(),
});

const openAiChatResponseSchema = z.object({
  model: z.string(),
  choices: z.array(openAiChoiceSchema),
  usage: openAiUsageSchema.optional(),
});

const openAiStreamChunkSchema = z.object({
  choices: z.array(
    z.object({
      delta: z
        .object({
          content: z.string().optional(),
        })
        .optional(),
      finish_reason: z.string().nullable().optional(),
    })
  ),
  usage: openAiUsageSchema.optional(),
});

const openAiErrorSchema = z.object({
  error: z.object({
    message: z.string().optional(),
    type: z.string().optional(),
    code: z.string().optional(),
  }),
});

const DEFAULT_TOKEN_RATIO = 4;

type OpenAIAdapterOptions = {
  baseUrl?: string;
  defaultModel?: string;
  extraHeaders?: Record<string, string>;
};

export class OpenAIAdapter implements LLMProvider {
  readonly id = "openai" as const;
  readonly name = "OpenAI";
  readonly supportsStreaming = true;
  readonly maxContextTokens: Record<string, number> = {
    "gpt-4o": 128000,
    "gpt-4o-mini": 128000,
    "gpt-4-turbo": 128000,
    "gpt-3.5-turbo": 16385,
  };

  private readonly apiKey: string;
  protected readonly baseUrl: string;
  protected readonly defaultModel?: string;
  private readonly extraHeaders?: Record<string, string>;

  constructor(apiKey: string, options?: OpenAIAdapterOptions) {
    this.apiKey = apiKey;
    this.baseUrl = options?.baseUrl ?? "https://api.openai.com/v1";
    this.defaultModel = options?.defaultModel;
    this.extraHeaders = options?.extraHeaders;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startedAt = Date.now();
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: request.model,
        messages: this.formatMessages(request),
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        response_format:
          request.responseFormat === "json" ? { type: "json_object" } : undefined,
      }),
    });

    if (!response.ok) {
      throw await this.buildError(response, "Chat completion failed.");
    }

    const payload: unknown = await response.json();
    const parsed = openAiChatResponseSchema.safeParse(payload);

    if (!parsed.success) {
      throw new LLMError(
        "Invalid response from OpenAI.",
        this.id,
        "INVALID_RESPONSE",
        false
      );
    }

    const choice = parsed.data.choices[0];
    const usage = parsed.data.usage;

    return {
      content: choice?.message?.content ?? "",
      model: parsed.data.model,
      usage: {
        promptTokens: usage?.prompt_tokens ?? 0,
        completionTokens: usage?.completion_tokens ?? 0,
        totalTokens: usage?.total_tokens ?? 0,
      },
      finishReason: this.mapFinishReason(choice?.finish_reason),
      latencyMs: Date.now() - startedAt,
    };
  }

  async *chatStream(request: ChatRequest): AsyncGenerator<StreamChunk> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: request.model,
        messages: this.formatMessages(request),
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        stream: true,
        stream_options: { include_usage: true },
      }),
    });

    if (!response.ok) {
      throw await this.buildError(response, "Streaming chat failed.");
    }

    let finalUsage: StreamChunk["usage"] | undefined;

    for await (const data of this.iterateStream(response)) {
      if (data === "[DONE]") {
        yield { content: "", done: true, usage: finalUsage };
        return;
      }

      let parsedChunk: z.infer<typeof openAiStreamChunkSchema>;
      try {
        parsedChunk = openAiStreamChunkSchema.parse(JSON.parse(data));
      } catch (error) {
        throw new LLMError(
          "Invalid stream chunk from OpenAI.",
          this.id,
          "INVALID_RESPONSE",
          false,
          error instanceof Error ? error : undefined
        );
      }

      const chunkChoice = parsedChunk.choices[0];
      const content = chunkChoice?.delta?.content ?? "";
      const done = chunkChoice?.finish_reason != null;

      if (parsedChunk.usage) {
        finalUsage = {
          promptTokens: parsedChunk.usage.prompt_tokens ?? 0,
          completionTokens: parsedChunk.usage.completion_tokens ?? 0,
          totalTokens: parsedChunk.usage.total_tokens ?? 0,
        };
      }

      if (content || done) {
        yield { content, done };
      }
    }
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

  protected resolveDefaultModel(): string {
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

  protected getHeaders(): HeadersInit {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      ...this.extraHeaders,
    };
  }

  protected formatMessages(request: ChatRequest): ChatRequest["messages"] {
    if (!request.systemPrompt) {
      return request.messages;
    }

    return [{ role: "system", content: request.systemPrompt }, ...request.messages];
  }

  protected mapFinishReason(reason?: string | null): ChatResponse["finishReason"] {
    if (reason === "length") {
      return "length";
    }

    if (reason === "content_filter") {
      return "content_filter";
    }

    if (!reason) {
      return "stop";
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
      const parsed = openAiErrorSchema.safeParse(payload);

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

  private async *iterateStream(response: Response): AsyncGenerator<string> {
    const reader = response.body?.getReader();

    if (!reader) {
      throw new LLMError(
        "OpenAI stream is unavailable.",
        this.id,
        "INVALID_RESPONSE",
        false
      );
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n\n");

      while (boundary !== -1) {
        const chunk = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        for (const line of chunk.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) {
            continue;
          }

          const data = trimmed.slice("data:".length).trim();
          if (data) {
            yield data;
          }
        }

        boundary = buffer.indexOf("\n\n");
      }
    }

    const remaining = buffer.trim();
    if (remaining.startsWith("data:")) {
      const data = remaining.slice("data:".length).trim();
      if (data) {
        yield data;
      }
    }
  }
}
