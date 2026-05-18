import { headers } from "next/headers";

import { getHealthStatus } from "@/features/health";
import { config } from "@/lib/config";
import { rateLimit } from "@/lib/rate-limit";

async function getClientId(): Promise<string> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const realIp = headerList.get("x-real-ip");

  return forwardedFor?.split(",")[0]?.trim() || realIp || "local";
}

export async function GET(): Promise<Response> {
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
    const health = await getHealthStatus();

    return Response.json({ success: true, data: health });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return Response.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Health check failed.",
          details: { message },
        },
      },
      { status: 500 }
    );
  }
}
