import { config } from "@/lib/config";
import { rateLimit } from "@/lib/rate-limit";
import { getClientId } from "@/lib/request";
import { verifyAccessPin } from "@/lib/access";

import {
  ProviderConfigError,
  providerConfigSchema,
  providerIdSchema,
  saveProviderConfig,
  deleteProviderConfig,
} from "@/features/llm";

export async function PUT(
  request: Request,
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

  const payload = providerConfigSchema.safeParse(body);
  if (!payload.success) {
    return Response.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid provider configuration.",
          details: payload.error.flatten(),
        },
      },
      { status: 400 }
    );
  }

  try {
    const result = await saveProviderConfig({
      provider: providerResult.data,
      apiKey: payload.data.apiKey,
      baseUrl: payload.data.baseUrl,
      model: payload.data.model,
    });

    return Response.json({ success: true, data: result });
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
          message: "Failed to save provider.",
          details: { message },
        },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    await deleteProviderConfig(providerResult.data);

    return Response.json({
      success: true,
      data: { message: "Provider configuration removed" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return Response.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to delete provider.",
          details: { message },
        },
      },
      { status: 500 }
    );
  }
}
