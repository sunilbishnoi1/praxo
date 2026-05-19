import { config } from "@/lib/config";

import { resolveDeepgramApiKey } from "../deepgram";

export type DeepgramTtsResult = {
  audio: ArrayBuffer;
  mimeType: string;
};

function resolveDeepgramTtsModel(voice?: string | null): string {
  return voice?.trim() || config.deepgramTtsModel || "aura-asteria-en";
}

export async function synthesizeWithDeepgram(
  userId: string,
  text: string,
  voice?: string | null
): Promise<DeepgramTtsResult> {
  const apiKey = await resolveDeepgramApiKey(userId);
  if (!apiKey) {
    throw new Error("Deepgram TTS is not configured.");
  }

  const url = new URL("https://api.deepgram.com/v1/speak");
  url.searchParams.set("model", resolveDeepgramTtsModel(voice));
  // Deepgram expects `encoding` to be a codec (e.g. linear16, opus)
  // and `container` to be a wrapper like `wav` or `ogg`.
  url.searchParams.set("encoding", "linear16");
  url.searchParams.set("container", "wav");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "audio/wav",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Deepgram TTS failed.");
  }

  return {
    audio: await response.arrayBuffer(),
    mimeType: "audio/wav",
  };
}