"use client";

import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Eye, EyeOff, Plug, ShieldCheck, ShieldX } from "lucide-react";

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
      label: "API key",
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
      label: "Default model",
      helper: "Optional. Overrides server default.",
    },
  ],
  anthropic: [
    {
      key: "apiKey",
      label: "API key",
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
      label: "Default model",
      helper: "Optional. Overrides server default.",
    },
  ],
  gemini: [
    {
      key: "apiKey",
      label: "API key",
      type: "password",
      helper: "Stored encrypted. Re-enter to replace.",
    },
    {
      key: "model",
      label: "Default model",
      helper: "Optional. Overrides server default.",
    },
  ],
  groq: [
    {
      key: "apiKey",
      label: "API key",
      type: "password",
      helper: "Stored encrypted. Re-enter to replace.",
    },
    {
      key: "model",
      label: "Default model",
      helper: "Optional. Overrides server default.",
    },
  ],
  openrouter: [
    {
      key: "apiKey",
      label: "API key",
      type: "password",
      helper: "Stored encrypted. Re-enter to replace.",
    },
    {
      key: "model",
      label: "Default model",
      helper: "Optional. Overrides server default.",
    },
  ],
  ollama: [
    { key: "baseUrl", label: "Base URL", helper: "Local Ollama server URL." },
    {
      key: "model",
      label: "Default model",
      helper: "Optional. Overrides server default.",
    },
  ],
  deepgram: [
    {
      key: "apiKey",
      label: "API key",
      type: "password",
      helper: "Stored encrypted. Re-enter to replace.",
    },
    {
      key: "model",
      label: "Default model",
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
}: ProviderSettingsProps): ReactElement {
  const [providers, setProviders] =
    useState<ProviderStatus[]>(initialProviders);
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
      <section className="rounded-card border border-dashed border-border bg-surface px-card py-card text-body text-muted-foreground">
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
      <Card key={provider.provider} className="flex h-full flex-col">
        <CardHeader className="gap-3">
          <div className="flex items-start justify-between gap-element">
            <div>
              <CardTitle>{PROVIDER_LABELS[provider.provider]}</CardTitle>
              <CardDescription>
                {PROVIDER_DESCRIPTIONS[provider.provider]}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={provider.isConfigured ? "default" : "muted"}>
                {provider.isConfigured ? "Configured" : "Not configured"}
              </Badge>
              {provider.isConfigured ? (
                <Badge variant={provider.isValid ? "success" : "warning"}>
                  {provider.isValid ? "Validated" : "Needs test"}
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-element text-caption text-muted-foreground">
            <div className="flex items-center gap-2">
              <Plug className="h-4 w-4" aria-hidden />
              <span>Model: {provider.model ?? "Use server default"}</span>
            </div>
            <div className="flex items-center gap-2">
              {provider.isValid ? (
                <ShieldCheck
                  className="h-4 w-4 text-score-excellent"
                  aria-hidden
                />
              ) : (
                <ShieldX className="h-4 w-4 text-score-average" aria-hidden />
              )}
              <span>Last test: {formatLastTested(provider.lastTestedAt)}</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {fields.map((field) => {
            const isApiKey = field.key === "apiKey";
            const placeholder =
              isApiKey && provider.isConfigured && values.apiKey.length === 0
                ? "Saved (hidden)"
                : "";
            const helperText =
              isApiKey && !provider.isConfigured ? "" : field.helper;

            return (
              <div key={`${provider.provider}-${field.key}`}>
                <Label htmlFor={`${provider.provider}-${field.key}`}>
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
                  {isApiKey && values.apiKey.length > 0 ? (
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
                  <p className="mt-1 text-caption text-muted-foreground">
                    {helperText}
                  </p>
                ) : null}
              </div>
            );
          })}

          {message ? (
            <div
              className={`rounded-button border px-3 py-2 text-caption ${
                message.type === "success"
                  ? "border-score-excellent/30 bg-score-excellent/10 text-score-excellent"
                  : "border-score-bad/30 bg-score-bad/10 text-score-bad"
              }`}
              role="status"
            >
              {message.text}
            </div>
          ) : null}
        </CardContent>

        <CardFooter className="mt-auto flex flex-wrap gap-element">
          <Button
            onClick={() => handleSave(provider.provider)}
            disabled={isPending}
          >
            Save
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleTest(provider.provider)}
            disabled={isPending || !canTest}
          >
            Test connection
          </Button>
          <Button
            variant="ghost"
            onClick={() => handleDelete(provider.provider)}
            disabled={isPending || !hasMounted || !provider.isConfigured}
          >
            Remove
          </Button>
        </CardFooter>
      </Card>
    );
  };

  return (
    <section className="flex flex-col gap-element">
      <div className="space-y-2">
        <h2 className="text-subheading">Provider status</h2>
        <p className="text-body text-muted-foreground">
          Connect an LLM provider, set defaults, and verify connectivity.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {aiProviders.map((provider) => {
          const isActive = provider.provider === activeProvider;

          return (
            <button
              key={provider.provider}
              type="button"
              onClick={() => setActiveProvider(provider.provider)}
              className={cn(
                "rounded-button border px-3 py-2 text-body transition-colors",
                isActive
                  ? "border-border bg-surface-raised text-foreground shadow-sm"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={isActive}
            >
              {PROVIDER_LABELS[provider.provider]}
            </button>
          );
        })}
      </div>

      {renderProviderCard(activeProviderStatus)}

      {deepgramProvider ? (
        <div className="space-y-3">
          <div>
            <h3 className="text-subheading">Voice provider</h3>
            <p className="text-body text-muted-foreground">
              Configure the shared Deepgram key used for transcription and text-to-speech.
            </p>
          </div>
          {renderProviderCard(deepgramProvider)}
        </div>
      ) : null}

      <p className="text-caption text-muted-foreground">
        Changes are saved immediately. Test connectivity after updating keys or
        models.
      </p>
    </section>
  );
}
