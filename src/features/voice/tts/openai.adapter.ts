import { config } from "@/lib/config";
import { decryptText } from "@/lib/encryption";
import { prisma } from "@/lib/db";

export type OpenAITtsResult = {
  audio: ArrayBuffer;
  mimeType: string;
};

async function resolveOpenAiKey(userId: string): Promise<string | null> {
  const savedConfig = await prisma.providerConfig.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: "openai",
      },
    },
  });

  if (savedConfig?.apiKey) {
    return decryptText(savedConfig.apiKey, config.encryptionKey);
  }

  return config.openaiApiKey ?? null;
}

export async function synthesizeWithOpenAi(
  userId: string,
  text: string,
  voice?: string | null
): Promise<OpenAITtsResult> {
  const apiKey = await resolveOpenAiKey(userId);
  if (!apiKey) {
    throw new Error("OpenAI TTS is not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.openaiTtsModel ?? "tts-1",
      voice: voice ?? config.openaiTtsVoice ?? "alloy",
      input: text,
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "OpenAI TTS failed.");
  }

  return {
    audio: await response.arrayBuffer(),
    mimeType: "audio/mpeg",
  };
}
