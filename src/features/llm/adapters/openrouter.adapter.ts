import { ChatRequest, ChatResponse, StreamChunk } from "../types";
import { OpenAIAdapter } from "./openai.adapter";

export class OpenRouterAdapter extends OpenAIAdapter {
  readonly id = "openrouter" as const;
  readonly name = "OpenRouter";
  readonly maxContextTokens: Record<string, number> = {
    "meta-llama/llama-3.3-70b-instruct:free": 131072,
    "meta-llama/llama-3.2-3b-instruct:free": 8192,
    "deepseek/deepseek-v4-flash:free": 65536,
    "openai/gpt-oss-20b:free": 16384,
    "openrouter/free": 131072,
  };

  constructor(apiKey: string, defaultModel?: string) {
    super(apiKey, {
      baseUrl: "https://openrouter.ai/api/v1",
      defaultModel:
        !defaultModel || defaultModel === "openrouter/free" || defaultModel === "default"
          ? "meta-llama/llama-3.2-3b-instruct:free"
          : defaultModel,
      extraHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Praxo",
      },
    });
  }

  private mapModel(model?: string): string {
    if (!model || model === "default") {
      return this.resolveDefaultModel();
    }
    if (model === "openrouter/free" || model === "free") {
      return "meta-llama/llama-3.2-3b-instruct:free";
    }
    return model;
  }

  override async chat(request: ChatRequest): Promise<ChatResponse> {
    const primaryModel = this.mapModel(request.model);
    
    // Active free models to try sequentially
    const fallbacks = [
      "meta-llama/llama-3.2-3b-instruct:free",
      "deepseek/deepseek-v4-flash:free",
      "openai/gpt-oss-20b:free",
      "openrouter/free"
    ];

    const modelsToTry = [primaryModel, ...fallbacks.filter(m => m !== primaryModel)];

    let lastError: any = null;
    for (const modelToTry of modelsToTry) {
      try {
        if (modelToTry !== primaryModel) {
          console.warn(`[OpenRouter] Primary model failed or rate-limited. Retrying chat completion with fallback model: ${modelToTry}`);
        }
        return await super.chat({
          ...request,
          model: modelToTry,
        });
      } catch (error) {
        console.warn(`[OpenRouter] Model ${modelToTry} chat completion failed:`, error);
        lastError = error;
      }
    }

    throw lastError || new Error("All OpenRouter models failed.");
  }

  override async *chatStream(request: ChatRequest): AsyncGenerator<StreamChunk> {
    const primaryModel = this.mapModel(request.model);
    
    const fallbacks = [
      "meta-llama/llama-3.2-3b-instruct:free",
      "deepseek/deepseek-v4-flash:free",
      "openai/gpt-oss-20b:free",
      "openrouter/free"
    ];

    const modelsToTry = [primaryModel, ...fallbacks.filter(m => m !== primaryModel)];

    let lastError: any = null;
    for (const modelToTry of modelsToTry) {
      try {
        if (modelToTry !== primaryModel) {
          console.warn(`[OpenRouter] Primary model failed or rate-limited. Retrying stream with fallback model: ${modelToTry}`);
        }
        yield* super.chatStream({
          ...request,
          model: modelToTry,
        });
        return;
      } catch (error) {
        console.warn(`[OpenRouter] Model ${modelToTry} stream failed:`, error);
        lastError = error;
      }
    }

    throw lastError || new Error("All OpenRouter streaming models failed.");
  }
}
