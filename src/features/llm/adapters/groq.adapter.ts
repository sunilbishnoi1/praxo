import { OpenAIAdapter } from "./openai.adapter";

export class GroqAdapter extends OpenAIAdapter {
  readonly id = "groq" as const;
  readonly name = "Groq";
  readonly maxContextTokens: Record<string, number> = {
    "llama-3.3-70b-versatile": 128000,
    "llama-3.1-8b-instant": 128000,
    "mixtral-8x7b-32768": 32768,
  };

  constructor(apiKey: string, defaultModel?: string) {
    super(apiKey, {
      baseUrl: "https://api.groq.com/openai/v1",
      defaultModel,
    });
  }
}
