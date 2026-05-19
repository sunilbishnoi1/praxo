import { NextRequest, NextResponse } from "next/server";

import { config } from "@/lib/config";
import { verifyAccessPin } from "@/lib/access";
import { getDefaultUserId } from "@/features/llm";
import { transcribeWithDeepgram, transcribeWithWhisper } from "@/features/voice";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const access = await verifyAccessPin();
  if (!access.allowed) {
    return access.response as NextResponse;
  }

  try {
    const formData = await request.formData();
    const transcriptValue = formData.get("transcript");
    const audioValue = formData.get("audio");
    const userId = await getDefaultUserId();

    if (typeof transcriptValue === "string" && transcriptValue.trim().length > 0) {
      return NextResponse.json({
        success: true,
        data: {
          transcript: transcriptValue.trim(),
          provider: "client",
          confidence: 1,
        },
      });
    }

    if (!(audioValue instanceof Blob)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "An audio blob or transcript is required." } },
        { status: 400 }
      );
    }

    if (config.sttProvider === "deepgram") {
      const result = await transcribeWithDeepgram(userId, audioValue, config.deepgramLanguage ?? undefined);
      return NextResponse.json({
        success: true,
        data: result,
      });
    }

    const result = await transcribeWithWhisper(audioValue, "");
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed.";
    return NextResponse.json(
      { success: false, error: { code: "STT_ERROR", message } },
      { status: 502 }
    );
  }
}
