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

  const { providerId } = body as { providerId?: string };

  if (!providerId || !LLM_PROVIDERS.includes(providerId as any)) {
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

  try {
    const userId = await getDefaultUserId();
    await prisma.user.update({
      where: { id: userId },
      data: { defaultLlmProvider: providerId },
    });

    return Response.json({ success: true, data: { defaultLlmProvider: providerId } });
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
