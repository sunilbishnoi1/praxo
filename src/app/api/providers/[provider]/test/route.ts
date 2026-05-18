import { config } from "@/lib/config";
import { rateLimit } from "@/lib/rate-limit";
import { getClientId } from "@/lib/request";
import { verifyAccessPin } from "@/lib/access";

import {
  ProviderConfigError,
  providerIdSchema,
  testProviderConnection,
} from "@/features/llm";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> }
): Promise<Response> {
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

  const { provider } = await params;
  const providerResult = providerIdSchema.safeParse(provider);

  if (!providerResult.success) {
    return Response.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Unknown provider.",
          details: providerResult.error.flatten(),
        },
      },
      { status: 400 }
    );
  }

  try {
    const result = await testProviderConnection(providerResult.data);

    if (!result.isValid) {
      return Response.json(
        {
          success: false,
          error: {
            code: "PROVIDER_TEST_FAILED",
            message: result.message,
            details: {
              latencyMs: result.latencyMs,
              model: result.model,
            },
          },
        },
        { status: 422 }
      );
    }

    return Response.json({
      success: true,
      data: {
        provider: result.provider,
        isValid: result.isValid,
        latencyMs: result.latencyMs,
        model: result.model,
        message: result.message,
      },
    });
  } catch (error) {
    if (error instanceof ProviderConfigError) {
      return Response.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.status }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";

    return Response.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to test provider.",
          details: { message },
        },
      },
      { status: 500 }
    );
  }
}
