import { NextRequest, NextResponse } from "next/server";

import { config } from "@/lib/config";
import { verifyAccessPin } from "@/lib/access";
import { getDefaultUserId } from "@/features/llm";
import {
  synthesizeWithDeepgram,
  synthesizeWithOpenAi,
  synthesizeWithKokoro,
} from "@/features/voice";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const access = await verifyAccessPin();
  if (!access.allowed) {
    return access.response as NextResponse;
  }

  try {
    const userId = await getDefaultUserId();
    const body = (await request.json()) as { text?: string; voice?: string | null };

    if (!body.text || body.text.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "text is required." } },
        { status: 400 }
      );
    }

    if (config.ttsProvider === "deepgram") {
      const result = await synthesizeWithDeepgram(userId, body.text, body.voice ?? undefined);
      return new NextResponse(result.audio, {
        status: 200,
        headers: {
          "Content-Type": result.mimeType,
          "Cache-Control": "no-store",
        },
      });
    }

    if (config.ttsProvider === "openai") {
      const result = await synthesizeWithOpenAi(userId, body.text, body.voice ?? undefined);
      return new NextResponse(result.audio, {
        status: 200,
        headers: {
          "Content-Type": result.mimeType,
          "Cache-Control": "no-store",
        },
      });
    }

    const kokoro = await synthesizeWithKokoro(body.text, body.voice ?? undefined);
    if (kokoro.audio) {
      return new NextResponse(kokoro.audio, {
        status: 200,
        headers: {
          "Content-Type": kokoro.mimeType ?? "audio/mpeg",
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "TTS_ERROR",
          message: "Kokoro synthesis is not available in this environment. Falling back to browser speech synthesis.",
        },
      },
      { status: 502 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Text-to-speech failed.";
    return NextResponse.json(
      { success: false, error: { code: "TTS_ERROR", message } },
      { status: 502 }
    );
  }
}
