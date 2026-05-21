"use client";

import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Plug, ShieldCheck, ShieldX, Key, Cpu, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type {
  ProviderId,
  ProviderStatus,
  ProviderTestResult,
} from "@/features/llm";

type ProviderSettingsProps = {
  initialProviders: ProviderStatus[];
  defaultLlmProvider: string | null;
};

type ProviderFormState = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

type ProviderMessage = {
  type: "success" | "error";
  text: string;
};

type ProviderField = {
  key: keyof ProviderFormState;
  label: string;
  type?: string;
  helper?: string;
};

const PROVIDER_FIELDS: Record<ProviderId, ProviderField[]> = {
  openai: [
    {
      key: "apiKey",
      label: "API Key",
      type: "password",
      helper: "Stored encrypted. Re-enter to replace.",
    },
    {
      key: "baseUrl",
      label: "Base URL",
      helper: "Leave blank to use server defaults.",
    },
    {
      key: "model",
      label: "Default Model",
      helper: "Optional. Overrides server default.",
    },
  ],
  anthropic: [
    {
      key: "apiKey",
      label: "API Key",
      type: "password",
      helper: "Stored encrypted. Re-enter to replace.",
    },
    {
      key: "baseUrl",
      label: "Base URL",
      helper: "Leave blank to use server defaults.",
    },
    {
      key: "model",
      label: "Default Model",
      helper: "Optional. Overrides server default.",
    },
  ],
  gemini: [
    {
      key: "apiKey",
      label: "API Key",
      type: "password",
      helper: "Stored encrypted. Re-enter to replace.",
    },
    {
      key: "model",
      label: "Default Model",
      helper: "Optional. Overrides server default.",
    },
  ],
  groq: [
    {
      key: "apiKey",
      label: "API Key",
      type: "password",
      helper: "Stored encrypted. Re-enter to replace.",
    },
    {
      key: "model",
      label: "Default Model",
      helper: "Optional. Overrides server default.",
    },
  ],
  openrouter: [
    {
      key: "apiKey",
      label: "API Key",
      type: "password",
      helper: "Stored encrypted. Re-enter to replace.",
    },
    {
      key: "model",
      label: "Default Model",
      helper: "Optional. Overrides server default.",
    },
  ],
  ollama: [
    { key: "baseUrl", label: "Base URL", helper: "Local Ollama server URL." },
    {
      key: "model",
      label: "Default Model",
      helper: "Optional. Overrides server default.",
    },
  ],
  deepgram: [
    {
      key: "apiKey",
      label: "API Key",
      type: "password",
      helper: "Stored encrypted. Re-enter to replace.",
    },
    {
      key: "model",
      label: "Default Model",
      helper: "Optional. Overrides server default.",
    },
  ],
};

const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
  groq: "Groq",
  openrouter: "OpenRouter",
  ollama: "Ollama (Local)",
  deepgram: "Deepgram",
};

const PROVIDER_DESCRIPTIONS: Record<ProviderId, string> = {
  openai: "Primary OpenAI models and embeddings.",
  anthropic: "Claude models from Anthropic.",
  gemini: "Google Gemini models.",
  groq: "Low-latency Groq-hosted models.",
  openrouter: "Unified gateway for multiple models.",
  ollama: "Local Ollama runtime.",
  deepgram: "Shared speech provider for live transcription and realistic TTS.",
};

const AI_PROVIDER_ORDER: ProviderId[] = [
  "openrouter",
  "groq",
  "gemini",
  "openai",
  "anthropic",
  "ollama",
];

const TESTABLE_PROVIDERS: ProviderId[] = [
  "openai",
  "anthropic",
  "gemini",
  "groq",
  "openrouter",
  "ollama",
  "deepgram",
];

function formatLastTested(value: string | null): string {
  if (!value) {
    return "Not tested";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not tested";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function sanitizeValue(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json();

  if (!response.ok) {
    const errorMessage =
      (payload as { error?: { message?: string } })?.error?.message ||
      "Request failed.";
    throw new Error(errorMessage);
  }

  return (payload as { data: T }).data;
}

export function ProviderSettings({
  initialProviders,
  defaultLlmProvider,
}: ProviderSettingsProps): ReactElement {
  const [providers, setProviders] =
    useState<ProviderStatus[]>(initialProviders);
  const [defaultProvider, setDefaultProvider] = useState<string | null>(defaultLlmProvider);

  const configuredProviders = useMemo(() => {
    return providers.filter(
      (p) => p.isConfigured && p.provider !== "deepgram"
    );
  }, [providers]);

  const handleSetDefault = useCallback(async (providerId: string) => {
    try {
      const response = await fetch("/api/providers/default", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId }),
      });
      const json = await response.json();
      if (json.success) {
        setDefaultProvider(providerId);
      } else {
        alert(json.error?.message || "Failed to update preferred provider.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while updating preferred provider.");
    }
  }, []);
  const [formState, setFormState] = useState<Record<string, ProviderFormState>>(
    () => {
      const next: Record<string, ProviderFormState> = {};
      initialProviders.forEach((provider) => {
        next[provider.provider] = {
          apiKey: "",
          baseUrl: "",
          model: provider.model ?? "",
        };
      });
      return next;
    },
  );
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<
    Record<string, ProviderMessage | undefined>
  >({});
  const [activeProvider, setActiveProvider] = useState<ProviderId>(
    AI_PROVIDER_ORDER[0],
  );
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHasMounted(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const providerMap = useMemo(
    () => new Map(providers.map((provider) => [provider.provider, provider])),
    [providers],
  );

  const aiProviders = useMemo(
    () =>
      AI_PROVIDER_ORDER.map((providerId) => providerMap.get(providerId)).filter(
        (provider): provider is ProviderStatus => Boolean(provider),
      ),
    [providerMap],
  );

  const activeProviderStatus =
    providerMap.get(activeProvider) ?? aiProviders[0];
  const deepgramProvider = providerMap.get("deepgram");

  const refreshProviders = useCallback(async () => {
    const response = await fetch("/api/providers", { cache: "no-store" });
    const data = await parseResponse<{ providers: ProviderStatus[] }>(response);

    setProviders(data.providers);
    setFormState((prev) => {
      const next = { ...prev };
      data.providers.forEach((provider) => {
        const current = next[provider.provider] ?? {
          apiKey: "",
          baseUrl: "",
          model: "",
        };

        next[provider.provider] = {
          ...current,
          model: current.model || provider.model || "",
        };
      });
      return next;
    });
  }, []);

  const setPendingState = useCallback(
    (provider: ProviderId, value: boolean) => {
      setPending((prev) => ({ ...prev, [provider]: value }));
    },
    [],
  );

  const setProviderMessage = useCallback(
    (provider: ProviderId, message?: ProviderMessage) => {
      setMessages((prev) => ({ ...prev, [provider]: message }));
    },
    [],
  );

  const toggleSecret = useCallback((provider: ProviderId) => {
    setShowSecrets((prev) => ({ ...prev, [provider]: !prev[provider] }));
  }, []);

  const handleFieldChange = useCallback(
    (provider: ProviderId, field: keyof ProviderFormState, value: string) => {
      setFormState((prev) => ({
        ...prev,
        [provider]: {
          apiKey: prev[provider]?.apiKey ?? "",
          baseUrl: prev[provider]?.baseUrl ?? "",
          model: prev[provider]?.model ?? "",
          [field]: value,
        },
      }));
    },
    [],
  );

  const handleSave = useCallback(
    async (provider: ProviderId) => {
      setPendingState(provider, true);
      setProviderMessage(provider, undefined);

      try {
        const values = formState[provider] ?? {
          apiKey: "",
          baseUrl: "",
          model: "",
        };

        await parseResponse(
          await fetch(`/api/providers/${provider}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              apiKey: sanitizeValue(values.apiKey),
              baseUrl: sanitizeValue(values.baseUrl),
              model: sanitizeValue(values.model),
            }),
          }),
        );

        setFormState((prev) => ({
          ...prev,
          [provider]: {
            ...prev[provider],
            apiKey: "",
          },
        }));

        setProviderMessage(provider, {
          type: "success",
          text: "Provider saved. Run a test to validate.",
        });
        await refreshProviders();
      } catch (error) {
        setProviderMessage(provider, {
          type: "error",
          text: error instanceof Error ? error.message : "Save failed.",
        });
      } finally {
        setPendingState(provider, false);
      }
    },
    [formState, refreshProviders, setPendingState, setProviderMessage],
  );

  const handleTest = useCallback(
    async (provider: ProviderId) => {
      setPendingState(provider, true);
      setProviderMessage(provider, undefined);

      try {
        const response = await fetch(`/api/providers/${provider}/test`, {
          method: "POST",
        });
        const result = await parseResponse<ProviderTestResult>(response);
        setProviderMessage(provider, {
          type: "success",
          text: `Connection successful (${result.latencyMs}ms).`,
        });
        await refreshProviders();
      } catch (error) {
        setProviderMessage(provider, {
          type: "error",
          text: error instanceof Error ? error.message : "Test failed.",
        });
      } finally {
        setPendingState(provider, false);
      }
    },
    [refreshProviders, setPendingState, setProviderMessage],
  );

  const handleDelete = useCallback(
    async (provider: ProviderId) => {
      setPendingState(provider, true);
      setProviderMessage(provider, undefined);

      try {
        await parseResponse(
          await fetch(`/api/providers/${provider}`, { method: "DELETE" }),
        );
        setFormState((prev) => ({
          ...prev,
          [provider]: {
            apiKey: "",
            baseUrl: "",
            model: "",
          },
        }));
        setProviderMessage(provider, {
          type: "success",
          text: "Provider removed.",
        });
        await refreshProviders();
      } catch (error) {
        setProviderMessage(provider, {
          type: "error",
          text: error instanceof Error ? error.message : "Delete failed.",
        });
      } finally {
        setPendingState(provider, false);
      }
    },
    [refreshProviders, setPendingState, setProviderMessage],
  );

  if (!activeProviderStatus) {
    return (
      <section className="rounded-lg border border-dashed border-border bg-card px-card py-card text-body text-muted-foreground">
        Provider settings are unavailable.
      </section>
    );
  }

  const renderProviderCard = (provider: ProviderStatus): ReactElement => {
    const fields = PROVIDER_FIELDS[provider.provider];
    const values = formState[provider.provider] ?? {
      apiKey: "",
      baseUrl: "",
      model: "",
    };
    const isPending = pending[provider.provider];
    const message = messages[provider.provider];
    const canTest =
      hasMounted && TESTABLE_PROVIDERS.includes(provider.provider) && provider.isConfigured;
    const showApiKey = Boolean(showSecrets[provider.provider]);

    return (
      <Card key={provider.provider} className="flex h-full flex-col border-border bg-card">
        <CardHeader className="gap-3 border-b border-border bg-muted/20">
          <div className="flex items-start justify-between gap-element">
            <div>
              <CardTitle className="font-display text-xl font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-brand-500" />
                {PROVIDER_LABELS[provider.provider]}
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-1">
                {PROVIDER_DESCRIPTIONS[provider.provider]}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={provider.isConfigured ? "success" : "muted"} className="text-[10px] font-semibold">
                {provider.isConfigured ? "Configured" : "Not Configured"}
              </Badge>
              {provider.isConfigured ? (
                <Badge variant={provider.isValid ? "success" : "warning"} className="text-[10px] font-semibold">
                  {provider.isValid ? "Validated" : "Needs Test"}
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-element text-caption text-muted-foreground pt-1">
            <div className="flex items-center gap-2 font-medium">
              <Cpu className="h-4 w-4 text-accent-600" aria-hidden />
              <span>Model: {provider.model ?? "Use server default"}</span>
            </div>
            <div className="flex items-center gap-2 font-medium">
              {provider.isValid ? (
                <ShieldCheck className="h-4 w-4 text-emerald-500" aria-hidden />
              ) : (
                <ShieldX className="h-4 w-4 text-amber-500" aria-hidden />
              )}
              <span>Last Test: {formatLastTested(provider.lastTestedAt)}</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-card pt-6">
          {fields.map((field) => {
            const isApiKey = field.key === "apiKey";
            const placeholder =
              isApiKey && provider.isConfigured && values.apiKey.length === 0
                ? "••••••••••••••••••••••••••••••••"
                : "";
            const helperText =
              isApiKey && !provider.isConfigured ? "" : field.helper;

            return (
              <div key={`${provider.provider}-${field.key}`} className="flex flex-col gap-1.5">
                <Label htmlFor={`${provider.provider}-${field.key}`} className="font-semibold text-body">
                  {field.label}
                </Label>
                <div className="relative">
                  <Input
                    id={`${provider.provider}-${field.key}`}
                    type={
                      isApiKey
                        ? showApiKey
                          ? "text"
                          : "password"
                        : (field.type ?? "text")
                    }
                    value={values[field.key]}
                    onChange={(event) =>
                      handleFieldChange(
                        provider.provider,
                        field.key,
                        event.target.value,
                      )
                    }
                    className={cn(isApiKey && "pr-10")}
                    placeholder={
                      field.key === "model"
                        ? (provider.model ?? "Use server default")
                        : placeholder
                    }
                    aria-label={`${PROVIDER_LABELS[provider.provider]} ${field.label}`}
                  />
                  {isApiKey && (values.apiKey.length > 0 || (provider.isConfigured && values.apiKey.length === 0)) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => toggleSecret(provider.provider)}
                      aria-label={
                        showApiKey
                          ? `Hide ${PROVIDER_LABELS[provider.provider]} API key`
                          : `Show ${PROVIDER_LABELS[provider.provider]} API key`
                      }
                    >
                      {showApiKey ? (
                        <EyeOff className="h-4 w-4" aria-hidden />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden />
                      )}
                    </Button>
                  ) : null}
                </div>
                {helperText ? (
                  <p className="text-caption text-muted-foreground">
                    {helperText}
                  </p>
                ) : null}
              </div>
            );
          })}

          {message ? (
            <div
              className={`rounded-lg border px-3 py-2 text-caption font-medium ${
                message.type === "success"
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
              }`}
              role="status"
            >
              {message.text}
            </div>
          ) : null}
        </CardContent>

        <CardFooter className="mt-auto flex flex-wrap gap-element p-card border-t border-border bg-muted/10">
          <Button
            onClick={() => handleSave(provider.provider)}
            disabled={isPending}
            className="bg-brand-500 hover:bg-brand-600 text-white font-semibold"
          >
            Save Credentials
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleTest(provider.provider)}
            disabled={isPending || !canTest}
            className="font-semibold"
          >
            Test Connection
          </Button>
          <Button
            variant="ghost"
            onClick={() => handleDelete(provider.provider)}
            disabled={isPending || !hasMounted || !provider.isConfigured}
            className="text-red-500 hover:text-red-600 hover:bg-red-500/10 font-semibold"
          >
            Remove
          </Button>
        </CardFooter>
      </Card>
    );
  };

  return (
    <section className="flex flex-col gap-element">
      <div className="space-y-2 border-b border-border pb-stack-md">
        <h2 className="font-display text-2xl font-bold flex items-center gap-2">
          <Key className="h-6 w-6 text-brand-700" />
          AI Provider Settings
        </h2>
        <p className="text-body text-muted-foreground">
          Manage your external LLM endpoints, credentials, models, and latency settings.
        </p>
      </div>

      {configuredProviders.length > 1 && (
        <Card className="border-brand-500/20 bg-brand-500/5 shadow-sm mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-brand-500" />
              Preferred AI Provider
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-1">
              Multiple AI providers are configured. Select which one should be used for your interviews.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {configuredProviders.map((provider) => (
                <button
                  key={provider.provider}
                  type="button"
                  onClick={() => handleSetDefault(provider.provider)}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-4 text-left transition-all active:scale-98 cursor-pointer w-full",
                    defaultProvider === provider.provider
                      ? "border-brand-500 bg-brand-500/10 text-brand-700 shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <span className="font-semibold">{PROVIDER_LABELS[provider.provider]}</span>
                  {defaultProvider === provider.provider && (
                    <span className="rounded-full bg-brand-500 text-white p-1 text-[10px] font-bold leading-none flex items-center justify-center h-5 w-5">✓</span>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        {aiProviders.map((provider) => {
          const isActive = provider.provider === activeProvider;

          return (
            <button
              key={provider.provider}
              type="button"
              onClick={() => setActiveProvider(provider.provider)}
              className={cn(
                "rounded-lg border px-4 py-2 text-body transition-all active:scale-98 font-semibold cursor-pointer",
                isActive
                  ? "border-brand-500/40 bg-brand-500/10 text-brand-700 shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              aria-pressed={isActive}
            >
              {PROVIDER_LABELS[provider.provider]}
            </button>
          );
        })}
      </div>

      <div className="pt-2">
        {renderProviderCard(activeProviderStatus)}
      </div>

      {deepgramProvider ? (
        <div className="space-y-3 pt-stack-lg border-t border-border mt-4">
          <div>
            <h3 className="font-display text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent-600" />
              Voice Service Integration
            </h3>
            <p className="text-body text-muted-foreground">
              Configure Deepgram credentials for low-latency voice detection and speech generation.
            </p>
          </div>
          {renderProviderCard(deepgramProvider)}
        </div>
      ) : null}

      <p className="text-caption text-muted-foreground/80 mt-2 font-medium">
        Changes take effect immediately. Connectivity metrics represent live latency scores to API host nodes.
      </p>
    </section>
  );
}
