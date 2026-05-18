import { cookies } from "next/headers";

import { config } from "@/lib/config";

type AccessCheckResult = {
  allowed: boolean;
  response?: Response;
};

export async function verifyAccessPin(): Promise<AccessCheckResult> {
  if (!config.accessPin) {
    return { allowed: true };
  }

  const cookieStore = await cookies();
  const providedPin = cookieStore.get("PRAXO_ACCESS_PIN")?.value;

  if (providedPin === config.accessPin) {
    return { allowed: true };
  }

  return {
    allowed: false,
    response: Response.json(
      {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Access PIN required.",
        },
      },
      { status: 401 }
    ),
  };
}
