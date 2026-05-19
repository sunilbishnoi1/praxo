import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { decryptText, encryptText } from "@/lib/encryption";

import { createLLMProvider } from "./registry";
import {
  LLM_PROVIDERS,
  type LLMProvider,
  type LLMProviderId,
  type ProviderConfigInput,
  type ProviderId,
  type ProviderSaveResult,
  type ProviderStatus,
  type ProviderTestResult,
} from "./types";
import { testDeepgramConnection } from "@/features/voice/stt/deepgram.adapter";

export class ProviderConfigError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function getDefaultUserId(): Promise<string> {
  const existing = await prisma.user.findFirst({ select: { id: true } });

  if (existing) {
    return existing.id;
  }

  const created = await prisma.user.create({
    data: { name: "User" },
    select: { id: true },
  });

  return created.id;
}

function resolveDefaultModel(provider: ProviderId): string | undefined {
  switch (provider) {
    case "openai":
      return config.openaiDefaultModel;
    case "anthropic":
      return config.anthropicDefaultModel;
    case "gemini":
      return config.geminiDefaultModel;
    case "groq":
      return config.groqDefaultModel;
    case "openrouter":
      return config.openrouterDefaultModel;
    case "ollama":
      return config.ollamaDefaultModel;
    case "deepgram":
      return config.deepgramModel;
    default:
      return undefined;
  }
}

function resolveDefaultBaseUrl(provider: ProviderId): string | undefined {
  switch (provider) {
    case "openai":
      return config.openaiBaseUrl;
    case "anthropic":
      return config.anthropicBaseUrl;
    case "gemini":
      return undefined;
    case "ollama":
      return config.ollamaBaseUrl;
    default:
      return undefined;
  }
}

function requiresApiKey(provider: ProviderId): boolean {
  return provider !== "ollama";
}

function isLlmProvider(provider: ProviderId): provider is LLMProviderId {
  return (LLM_PROVIDERS as readonly string[]).includes(provider);
}

export async function listProviderStatuses(): Promise<ProviderStatus[]> {
  const userId = await getDefaultUserId();
  const configs = await prisma.providerConfig.findMany({
    where: { userId },
  });
  const configMap = new Map(configs.map((config) => [config.provider, config]));

  return configMap.size === 0
    ? (LLM_PROVIDERS as unknown as ProviderId[]).concat("deepgram").map((provider) => ({
        provider,
        isConfigured: false,
        isValid: false,
        model: resolveDefaultModel(provider) ?? null,
        lastTestedAt: null,
      }))
    : (LLM_PROVIDERS as unknown as ProviderId[]).concat("deepgram").map((provider) => {
        const configEntry = configMap.get(provider) ?? null;
        const hasKey = Boolean(configEntry?.apiKey);

        return {
          provider,
          isConfigured: Boolean(configEntry) && (provider === "ollama" || hasKey),
          isValid: configEntry?.isValid ?? false,
          model: configEntry?.model ?? resolveDefaultModel(provider) ?? null,
          lastTestedAt: configEntry?.lastTestedAt
            ? configEntry.lastTestedAt.toISOString()
            : null,
        };
      });
}

export async function saveProviderConfig(
  input: ProviderConfigInput
): Promise<ProviderSaveResult> {
  const userId = await getDefaultUserId();
  const existing = await prisma.providerConfig.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: input.provider,
      },
    },
  });

  const apiKeyProvided = Boolean(input.apiKey && input.apiKey.length > 0);
  const needsKey = requiresApiKey(input.provider);

  if (!apiKeyProvided && needsKey && !existing?.apiKey) {
    throw new ProviderConfigError(
      "API key is required for this provider.",
      "API_KEY_REQUIRED",
      400
    );
  }

  const encryptedKey = apiKeyProvided
    ? encryptText(input.apiKey ?? "", config.encryptionKey)
    : existing?.apiKey ?? "";

  const baseUrl = input.baseUrl ?? existing?.baseUrl ?? null;
  const model = input.model ?? existing?.model ?? resolveDefaultModel(input.provider) ?? null;
  const shouldInvalidate = apiKeyProvided || input.baseUrl !== undefined || input.model !== undefined;

  await prisma.providerConfig.upsert({
    where: {
      userId_provider: {
        userId,
        provider: input.provider,
      },
    },
    update: {
      apiKey: input.provider === "ollama" ? existing?.apiKey ?? "" : encryptedKey,
      baseUrl,
      model,
      isValid: shouldInvalidate ? false : existing?.isValid ?? false,
      lastTestedAt: shouldInvalidate ? null : existing?.lastTestedAt,
      lastError: shouldInvalidate ? null : existing?.lastError,
    },
    create: {
      userId,
      provider: input.provider,
      apiKey: input.provider === "ollama" ? "" : encryptedKey,
      baseUrl,
      model,
      isValid: false,
    },
  });

  return {
    provider: input.provider,
    isConfigured: true,
    isValid: shouldInvalidate ? false : existing?.isValid ?? false,
    message: "Provider saved. Run a test to validate.",
  };
}

export async function deleteProviderConfig(provider: ProviderId): Promise<void> {
  const userId = await getDefaultUserId();

  await prisma.providerConfig.deleteMany({
    where: {
      userId,
      provider,
    },
  });
}

export async function testProviderConnection(
  provider: ProviderId
): Promise<ProviderTestResult> {
  if (provider === "deepgram") {
    const userId = await getDefaultUserId();
    const configEntry = await prisma.providerConfig.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });

    if (!configEntry) {
      throw new ProviderConfigError(
        "Provider is not configured.",
        "PROVIDER_NOT_CONFIGURED",
        400
      );
    }

    const apiKey = configEntry.apiKey ? decryptText(configEntry.apiKey, config.encryptionKey) : config.deepgramApiKey;

    if (!apiKey) {
      throw new ProviderConfigError(
        "API key is missing for this provider.",
        "API_KEY_MISSING",
        400
      );
    }

    const result = await testDeepgramConnection(apiKey);
    const now = new Date();

    await prisma.providerConfig.update({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
      data: {
        isValid: result.success,
        lastTestedAt: now,
        lastError: result.success ? null : result.error ?? "Test failed.",
        model: configEntry.model ?? result.model,
      },
    });

    return {
      provider,
      isValid: result.success,
      latencyMs: result.latencyMs,
      model: result.model,
      message: result.success ? "Connection successful" : result.error ?? "Test failed.",
    };
  }

  if (!isLlmProvider(provider)) {
    throw new ProviderConfigError(
      "Provider testing is not supported yet.",
      "PROVIDER_UNSUPPORTED",
      400
    );
  }

  const userId = await getDefaultUserId();
  const configEntry = await prisma.providerConfig.findUnique({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
  });

  if (!configEntry) {
    throw new ProviderConfigError(
      "Provider is not configured.",
      "PROVIDER_NOT_CONFIGURED",
      400
    );
  }

  const apiKey = provider === "ollama"
    ? ""
    : decryptText(configEntry.apiKey, config.encryptionKey);

  const baseUrl = configEntry.baseUrl ?? resolveDefaultBaseUrl(provider);
  const model = configEntry.model ?? resolveDefaultModel(provider);

  if (!model) {
    throw new ProviderConfigError(
      "Provider model is missing.",
      "MODEL_MISSING",
      400
    );
  }

  const adapter = createLLMProvider(provider, {
    apiKey,
    baseUrl,
    defaultModel: model,
  });

  const result = await adapter.testConnection();
  const now = new Date();

  await prisma.providerConfig.update({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
    data: {
      isValid: result.success,
      lastTestedAt: now,
      lastError: result.success ? null : result.error ?? "Test failed.",
      model: configEntry.model ?? result.model,
    },
  });

  return {
    provider,
    isValid: result.success,
    latencyMs: result.latencyMs,
    model: result.model,
    message: result.message ?? (result.success ? "Connection successful" : result.error ?? "Test failed."),
  };
}

export async function getActiveLLMProvider(): Promise<{ providerId: LLMProviderId; adapter: LLMProvider }> {
  const userId = await getDefaultUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { defaultLlmProvider: true }
  });

  let providerId: LLMProviderId | null = null;
  if (user?.defaultLlmProvider) {
    providerId = user.defaultLlmProvider as LLMProviderId;
  } else {
    // Check first valid provider config
    const validConfig = await prisma.providerConfig.findFirst({
      where: { userId, isValid: true, provider: { in: [...LLM_PROVIDERS] } }
    });
    if (validConfig) {
      providerId = validConfig.provider as LLMProviderId;
    } else {
      // Check any configured provider
      const anyConfig = await prisma.providerConfig.findFirst({
        where: { userId, provider: { in: [...LLM_PROVIDERS] } }
      });
      if (anyConfig) {
        providerId = anyConfig.provider as LLMProviderId;
      }
    }
  }

  // Fallback to first provider with an API key in config (env var) if still null
  if (!providerId) {
    if (config.openaiApiKey) providerId = "openai";
    else if (config.geminiApiKey) providerId = "gemini";
    else if (config.anthropicApiKey) providerId = "anthropic";
    else if (config.groqApiKey) providerId = "groq";
    else if (config.openrouterApiKey) providerId = "openrouter";
    else providerId = "ollama"; // default local
  }

  // Load config for this provider
  const configEntry = await prisma.providerConfig.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: providerId,
      },
    },
  });

  const apiKey = providerId === "ollama"
    ? ""
    : configEntry 
      ? decryptText(configEntry.apiKey, config.encryptionKey)
      : (providerId === "openai" ? config.openaiApiKey :
         providerId === "gemini" ? config.geminiApiKey :
         providerId === "anthropic" ? config.anthropicApiKey :
         providerId === "groq" ? config.groqApiKey :
         providerId === "openrouter" ? config.openrouterApiKey : "");

  const baseUrl = configEntry?.baseUrl ?? resolveDefaultBaseUrl(providerId);
  const model = configEntry?.model ?? resolveDefaultModel(providerId);

  if (!model) {
    throw new ProviderConfigError(
      `Model for provider ${providerId} is missing.`,
      "MODEL_MISSING",
      400
    );
  }

  const adapter = createLLMProvider(providerId, {
    apiKey,
    baseUrl,
    defaultModel: model,
  });

  return { providerId, adapter };
}
