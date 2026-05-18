import { config } from "@/lib/config";
import { rateLimit } from "@/lib/rate-limit";
import { getClientId } from "@/lib/request";
import { verifyAccessPin } from "@/lib/access";

import { listProviderStatuses } from "@/features/llm";

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

  try {
    const providers = await listProviderStatuses();

    return Response.json({ success: true, data: { providers } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return Response.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to load providers.",
          details: { message },
        },
      },
      { status: 500 }
    );
  }
}
