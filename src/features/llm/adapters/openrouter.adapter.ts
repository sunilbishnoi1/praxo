import { OpenAIAdapter } from "./openai.adapter";

export class OpenRouterAdapter extends OpenAIAdapter {
  readonly id = "openrouter" as const;
  readonly name = "OpenRouter";
  readonly maxContextTokens: Record<string, number> = {};

  constructor(apiKey: string, defaultModel?: string) {
    super(apiKey, {
      baseUrl: "https://openrouter.ai/api/v1",
      defaultModel,
      extraHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Praxo",
      },
    });
  }
}
