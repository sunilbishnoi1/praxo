import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import type { HealthResponse, ServiceHealth } from "./types";
import packageJson from "../../../package.json";

function resolveOptionalService(configured: boolean): ServiceHealth {
  if (!configured) {
    return { status: "unconfigured" };
  }

  return { status: "degraded", error: "Not checked yet" };
}

function resolveOverallStatus(services: ServiceHealth[]): "healthy" | "degraded" {
  const hasIssue = services.some(
    (service) => service.status === "down" || service.status === "degraded"
  );

  return hasIssue ? "degraded" : "healthy";
}

async function checkDatabase(): Promise<ServiceHealth> {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return {
      status: "up",
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return {
      status: "down",
      error: message,
    };
  }
}

function resolveJudge0Status(): ServiceHealth {
  if (config.deploymentMode !== "full") {
    return { status: "unconfigured" };
  }

  return { status: "degraded", error: "Not checked yet" };
}

export async function getHealthStatus(): Promise<HealthResponse> {
  const database = await checkDatabase();
  const judge0 = resolveJudge0Status();
  const deepgram = resolveOptionalService(Boolean(config.deepgramApiKey));
  const ollama = resolveOptionalService(Boolean(config.ollamaBaseUrl));
  const services = { database, judge0, deepgram, ollama };

  return {
    status: resolveOverallStatus(Object.values(services)),
    version: packageJson.version,
    deploymentMode: config.deploymentMode,
    services,
    timestamp: new Date().toISOString(),
  };
}
