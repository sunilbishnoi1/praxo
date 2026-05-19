import { config } from "@/lib/config";

import { resolveDeepgramApiKey } from "../deepgram";

export type DeepgramConnectionTestResult = {
  success: boolean;
  latencyMs: number;
  model: string;
  error?: string;
};

export type DeepgramTranscriptionResult = {
  transcript: string;
  provider: "deepgram";
  confidence: number;
};

export async function testDeepgramConnection(
  apiKey: string
): Promise<DeepgramConnectionTestResult> {
  const startedAt = Date.now();

  try {
    const response = await fetch("https://api.deepgram.com/v1/projects", {
      method: "GET",
      headers: {
        Authorization: `Token ${apiKey}`,
        Accept: "application/json",
      },
    });

    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      const message = await response.text();
      return {
        success: false,
        latencyMs,
        model: config.deepgramModel ?? "nova-2",
        error: message || `Deepgram returned ${response.status}.`,
      };
    }

    return {
      success: true,
      latencyMs,
      model: config.deepgramModel ?? "nova-2",
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    return {
      success: false,
      latencyMs,
      model: config.deepgramModel ?? "nova-2",
      error: error instanceof Error ? error.message : "Deepgram connection failed.",
    };
  }
}

export async function transcribeWithDeepgram(
  userId: string,
  audio: Blob,
  language?: string | null
): Promise<DeepgramTranscriptionResult> {
  const apiKey = await resolveDeepgramApiKey(userId);
  if (!apiKey) {
    throw new Error("Deepgram is not configured.");
  }

  const url = new URL("https://api.deepgram.com/v1/listen");
  url.searchParams.set("model", config.deepgramModel ?? "nova-2");
  url.searchParams.set("smart_format", "true");
  url.searchParams.set("punctuate", "true");
  url.searchParams.set("interim_results", "false");
  url.searchParams.set("utterances", "false");
  url.searchParams.set("filler_words", "true");
  if (language ?? config.deepgramLanguage) {
    url.searchParams.set("language", language ?? config.deepgramLanguage ?? "en-US");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": audio.type || "audio/webm",
    },
    body: audio,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Deepgram transcription failed.");
  }

  const payload = (await response.json()) as {
    results?: {
      channels?: Array<{
        alternatives?: Array<{
          transcript?: string;
          confidence?: number;
        }>;
      }>;
    };
  };

  const alternative = payload.results?.channels?.[0]?.alternatives?.[0];

  return {
    transcript: alternative?.transcript ?? "",
    confidence: alternative?.confidence ?? 0,
    provider: "deepgram",
  };
}
