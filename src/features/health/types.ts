export type ServiceStatus = "up" | "down" | "unconfigured" | "degraded";

export type ServiceHealth = {
  status: ServiceStatus;
  latencyMs?: number;
  error?: string;
};

export type HealthResponse = {
  status: "healthy" | "degraded";
  version: string;
  deploymentMode: string;
  services: {
    database: ServiceHealth;
    judge0: ServiceHealth;
    deepgram: ServiceHealth;
    ollama: ServiceHealth;
  };
  timestamp: string;
};
