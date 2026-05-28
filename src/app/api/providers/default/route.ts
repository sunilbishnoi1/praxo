import { config } from "@/lib/config";
import { rateLimit } from "@/lib/rate-limit";
import { getClientId } from "@/lib/request";
import { verifyAccessPin } from "@/lib/access";
import { prisma } from "@/lib/db";
import { getDefaultUserId } from "@/features/llm/providers.service";
import { LLM_PROVIDERS } from "@/features/llm/types";

export async function PUT(request: Request): Promise<Response> {
  const access = await verifyAccessPin();
  if (!access.allowed) {
    return access.response ?? Response.json(
      {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Access PIN required.",
        },
      },
      { status: 401 }
    );
  }

  const clientId = await getClientId();
  const limit = rateLimit(
    clientId,
    config.rateLimitMaxRequests,
    config.rateLimitWindowMs
  );

  if (!limit.allowed) {
    return Response.json(
      {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests.",
          details: { resetAt: new Date(limit.resetAt).toISOString() },
        },
      },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: {
          code: "INVALID_JSON",
          message: "Request body must be valid JSON.",
        },
      },
      { status: 400 }
    );
  }

  const { providerId, voiceConversationMode } = body as { providerId?: string; voiceConversationMode?: string };

  if (!providerId && !voiceConversationMode) {
    return Response.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Either providerId or voiceConversationMode must be provided.",
        },
      },
      { status: 400 }
    );
  }

  const updateData: any = {};

  if (providerId) {
    if (!LLM_PROVIDERS.includes(providerId as any)) {
      return Response.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid providerId.",
          },
        },
        { status: 400 }
      );
    }
    updateData.defaultLlmProvider = providerId;
  }

  if (voiceConversationMode) {
    if (!["cascaded", "realtime"].includes(voiceConversationMode)) {
      return Response.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid voiceConversationMode.",
          },
        },
        { status: 400 }
      );
    }
    updateData.defaultVoiceConversationMode = voiceConversationMode;
  }

  try {
    const userId = await getDefaultUserId();
    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return Response.json({ success: true, data: updateData });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return Response.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to update default provider.",
          details: { message },
        },
      },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<Response> {
  const access = await verifyAccessPin();
  if (!access.allowed) {
    return access.response ?? Response.json(
      {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Access PIN required.",
        },
      },
      { status: 401 }
    );
  }

  try {
    const userId = await getDefaultUserId();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        defaultLlmProvider: true,
        defaultVoiceConversationMode: true,
      },
    });

    return Response.json({
      success: true,
      data: {
        defaultLlmProvider: user?.defaultLlmProvider ?? null,
        defaultVoiceConversationMode: user?.defaultVoiceConversationMode ?? "cascaded",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to retrieve defaults.",
          details: { message },
        },
      },
      { status: 500 }
    );
  }
}
