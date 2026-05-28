"use client";

import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Check, AlertCircle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  defaultVoiceConversationMode: string;
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
  options?: string[];
};

const PROVIDER_FIELDS: Record<ProviderId, ProviderField[]> = {
  openai: [
    { key: "apiKey", label: "API Key", type: "password", helper: "Stored securely. Re-enter to replace." },
    { key: "baseUrl", label: "Base URL", helper: "Optional. Leave blank to use server defaults." },
    { key: "model", label: "Default Model", helper: "Optional." },
  ],
  anthropic: [
    { key: "apiKey", label: "API Key", type: "password", helper: "Stored securely. Re-enter to replace." },
    { key: "baseUrl", label: "Base URL", helper: "Optional." },
    { key: "model", label: "Default Model", helper: "Optional." },
  ],
  gemini: [
    { key: "apiKey", label: "API Key", type: "password", helper: "Stored securely. Re-enter to replace." },
    { key: "model", label: "Default Model", helper: "Optional." },
  ],
  groq: [
    { key: "apiKey", label: "API Key", type: "password", helper: "Stored securely. Re-enter to replace." },
    { key: "model", label: "Default Model", helper: "Optional." },
  ],
  openrouter: [
    { key: "apiKey", label: "API Key", type: "password", helper: "Stored securely. Re-enter to replace." },
    { key: "model", label: "Default Model", helper: "Optional." },
  ],
  ollama: [
    { key: "baseUrl", label: "Base URL", helper: "Local Ollama server URL (e.g., http://localhost:11434)." },
    { key: "model", label: "Default Model", helper: "Optional." },
  ],
  deepgram: [
    { key: "apiKey", label: "API Key", type: "password", helper: "Stored securely. Re-enter to replace." },
    { key: "model", label: "Default Model", helper: "Optional." },
  ],
};

const GEMINI_REALTIME_MODELS = [
  "gemini-3.1-flash-live-preview",
  "gemini-2.5-flash-native-audio-preview-12-2025",
];

const GEMINI_STANDARD_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.1-flash",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
];

const OPENAI_REALTIME_MODELS = [
  "gpt-4o-realtime-preview",
  "gpt-4o-mini-realtime-preview",
];

const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
  groq: "Groq",
  openrouter: "OpenRouter",
  ollama: "Ollama",
  deepgram: "Deepgram",
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

function sanitizeValue(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  let payload: unknown;

  try {
    payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
  } catch (error) {
    throw new Error("Failed to read server response.");
  }

  if (!response.ok) {
    const errorMessage =
      typeof payload === "object" && payload !== null
        ? (payload as { error?: { message?: string } })?.error?.message
        : undefined;
    if (errorMessage) throw new Error(errorMessage);

    const statusLabel = `${response.status} ${response.statusText}`.trim();
    throw new Error(`Request failed (${statusLabel}).`);
  }

  return (payload as { data: T }).data;
}

export function ProviderSettings({
  initialProviders,
  defaultLlmProvider,
  defaultVoiceConversationMode,
}: ProviderSettingsProps): ReactElement {
  const [providers, setProviders] = useState<ProviderStatus[]>(initialProviders);
  const [defaultProvider, setDefaultProvider] = useState<string | null>(defaultLlmProvider);
  const [defaultVoiceMode, setDefaultVoiceMode] = useState<string>(defaultVoiceConversationMode);
  
  const [globalMessage, setGlobalMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [lastCascadedProvider, setLastCascadedProvider] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lastCascadedProvider");
      if (saved) {
        setLastCascadedProvider(saved);
      }
    }
  }, []);

  const [activeProvider, setActiveProvider] = useState<ProviderId>(() => {
    if (defaultVoiceConversationMode === "realtime") {
      return (defaultLlmProvider === "openai" || defaultLlmProvider === "gemini") 
        ? (defaultLlmProvider as ProviderId) 
        : "gemini";
    }
    const configured = initialProviders.find(p => p.isConfigured && p.provider !== "deepgram");
    return (defaultLlmProvider as ProviderId) || configured?.provider || "openrouter";
  });

  const configuredProviders = useMemo(() => {
    return providers.filter((p) => p.isConfigured && p.provider !== "deepgram");
  }, [providers]);

  const handleSetDefault = useCallback(async (providerId: string) => {
    setGlobalMessage(null);
    try {
      const response = await fetch("/api/providers/default", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId }),
      });
      const json = await response.json();
      if (json.success) {
        setDefaultProvider(providerId);
        setGlobalMessage({ type: "success", text: `Active provider set to ${PROVIDER_LABELS[providerId as ProviderId]}.` });
      } else {
        setGlobalMessage({ type: "error", text: json.error?.message || "Failed to update preferred provider." });
      }
    } catch (err) {
      setGlobalMessage({ type: "error", text: "An error occurred while updating preferred provider." });
    }
  }, []);

  const handleSetVoiceMode = useCallback(async (mode: string) => {
    setGlobalMessage(null);
    try {
      const response = await fetch("/api/providers/default", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceConversationMode: mode }),
      });
      const json = await response.json();
      if (json.success) {
        setDefaultVoiceMode(mode);
        if (mode === "realtime") {
          if (defaultProvider && defaultProvider !== "gemini" && defaultProvider !== "openai") {
            setLastCascadedProvider(defaultProvider);
            if (typeof window !== "undefined") localStorage.setItem("lastCascadedProvider", defaultProvider);
          }
          const newDefault = (defaultProvider === "openai" || defaultProvider === "gemini") ? defaultProvider : "gemini";
          if (defaultProvider !== newDefault) {
            await handleSetDefault(newDefault);
          }
          setActiveProvider(newDefault as ProviderId);
        } else if (mode === "cascaded") {
          const toRestore = lastCascadedProvider || "openrouter";
          if (defaultProvider !== toRestore) {
            await handleSetDefault(toRestore);
          }
          setActiveProvider(toRestore as ProviderId);
        }
      } else {
        setGlobalMessage({ type: "error", text: json.error?.message || "Failed to update voice mode." });
      }
    } catch (err) {
      setGlobalMessage({ type: "error", text: "An error occurred while updating voice mode." });
    }
  }, [defaultProvider, handleSetDefault, lastCascadedProvider]);

  const [formState, setFormState] = useState<Record<string, ProviderFormState>>(() => {
    const next: Record<string, ProviderFormState> = {};
    initialProviders.forEach((provider) => {
      next[provider.provider] = {
        apiKey: "",
        baseUrl: "",
        model: provider.model ?? "",
      };
    });
    return next;
  });

  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Record<string, ProviderMessage | undefined>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [customModelMode, setCustomModelMode] = useState<Record<string, boolean>>({});
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setHasMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const providerMap = useMemo(
    () => new Map(providers.map((provider) => [provider.provider, provider])),
    [providers],
  );

  const activeProviderStatus = providerMap.get(activeProvider) || providerMap.get("gemini")!;
  const deepgramProvider = providerMap.get("deepgram");

  const refreshProviders = useCallback(async () => {
    const response = await fetch("/api/providers", { cache: "no-store" });
    const data = await parseResponse<{ providers: ProviderStatus[] }>(response);

    setProviders(data.providers);
    setFormState((prev) => {
      const next = { ...prev };
      data.providers.forEach((provider) => {
        const current = next[provider.provider] ?? { apiKey: "", baseUrl: "", model: "" };
        next[provider.provider] = { ...current, model: current.model || provider.model || "" };
      });
      return next;
    });
  }, []);

  const setPendingState = useCallback((provider: ProviderId, value: boolean) => {
    setPending((prev) => ({ ...prev, [provider]: value }));
  }, []);

  const setProviderMessage = useCallback((provider: ProviderId, message?: ProviderMessage) => {
    setMessages((prev) => ({ ...prev, [provider]: message }));
  }, []);

  const toggleSecret = useCallback((provider: ProviderId) => {
    setShowSecrets((prev) => ({ ...prev, [provider]: !prev[provider] }));
  }, []);

  const handleFieldChange = useCallback((provider: ProviderId, field: keyof ProviderFormState, value: string) => {
    setFormState((prev) => ({
      ...prev,
      [provider]: {
        apiKey: prev[provider]?.apiKey ?? "",
        baseUrl: prev[provider]?.baseUrl ?? "",
        model: prev[provider]?.model ?? "",
        [field]: value,
      },
    }));
  }, []);

  const handleSave = useCallback(async (provider: ProviderId) => {
    setPendingState(provider, true);
    setProviderMessage(provider, undefined);
    try {
      const values = formState[provider] ?? { apiKey: "", baseUrl: "", model: "" };
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
        [provider]: { ...prev[provider], apiKey: "" },
      }));

      setProviderMessage(provider, { type: "success", text: "Saved successfully. Run a test to validate." });
      await refreshProviders();
    } catch (error) {
      setProviderMessage(provider, { type: "error", text: error instanceof Error ? error.message : "Save failed." });
    } finally {
      setPendingState(provider, false);
    }
  }, [formState, refreshProviders, setPendingState, setProviderMessage]);

  const handleTest = useCallback(async (provider: ProviderId) => {
    setPendingState(provider, true);
    setProviderMessage(provider, undefined);

    const configuredModel = formState[provider]?.model?.trim() || providers.find(p => p.provider === provider)?.model || "";

    if (provider === "gemini" && configuredModel) {
      const isLiveModel = GEMINI_REALTIME_MODELS.includes(configuredModel);
      if (defaultVoiceMode === "realtime" && !isLiveModel) {
        setProviderMessage(provider, { type: "error", text: "Realtime mode requires a Gemini Live model." });
        setPendingState(provider, false);
        return;
      }
      if (defaultVoiceMode !== "realtime" && isLiveModel) {
        setProviderMessage(provider, { type: "error", text: "Cascaded mode requires a standard Gemini model." });
        setPendingState(provider, false);
        return;
      }
    }

    try {
      const response = await fetch(`/api/providers/${provider}/test`, { method: "POST" });
      const result = await parseResponse<ProviderTestResult>(response);
      setProviderMessage(provider, { type: "success", text: `Connection successful (${result.latencyMs}ms).` });
      await refreshProviders();
    } catch (error) {
      setProviderMessage(provider, { type: "error", text: error instanceof Error ? error.message : "Test failed." });
    } finally {
      setPendingState(provider, false);
    }
  }, [defaultVoiceMode, formState, providers, refreshProviders, setPendingState, setProviderMessage]);

  const handleDelete = useCallback(async (provider: ProviderId) => {
    setPendingState(provider, true);
    setProviderMessage(provider, undefined);
    try {
      await parseResponse(await fetch(`/api/providers/${provider}`, { method: "DELETE" }));
      setFormState((prev) => ({
        ...prev,
        [provider]: { apiKey: "", baseUrl: "", model: "" },
      }));
      setProviderMessage(provider, { type: "success", text: "Credentials removed." });
      await refreshProviders();
    } catch (error) {
      setProviderMessage(provider, { type: "error", text: error instanceof Error ? error.message : "Delete failed." });
    } finally {
      setPendingState(provider, false);
    }
  }, [refreshProviders, setPendingState, setProviderMessage]);

  if (!activeProviderStatus) return <></>;

  const renderProviderConfig = (provider: ProviderStatus) => {
    const baseFields = PROVIDER_FIELDS[provider.provider];
    const fields = (() => {
      if (provider.provider === "gemini") {
        const modelOptions = defaultVoiceMode === "realtime" ? GEMINI_REALTIME_MODELS : GEMINI_STANDARD_MODELS;
        const helper = defaultVoiceMode === "realtime" ? "Required for Live API." : "Optional standard models.";
        return baseFields.map((f) => f.key === "model" ? { ...f, options: modelOptions, helper } : f);
      } else if (defaultVoiceMode === "realtime" && provider.provider === "openai") {
        return baseFields.map((f) => f.key === "model" ? { ...f, options: OPENAI_REALTIME_MODELS, helper: "Required for Live API." } : f);
      }
      return baseFields;
    })();

    const values = formState[provider.provider] ?? { apiKey: "", baseUrl: "", model: "" };
    const isPending = pending[provider.provider];
    const message = messages[provider.provider];
    const canTest = hasMounted && TESTABLE_PROVIDERS.includes(provider.provider) && provider.isConfigured;
    const showApiKey = Boolean(showSecrets[provider.provider]);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg font-medium text-foreground">{PROVIDER_LABELS[provider.provider]}</h4>
            <p className="text-sm text-muted-foreground">
              {provider.isConfigured ? "Configured and securely stored" : "No credentials stored"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {provider.isConfigured && provider.isValid && (
              <span className="flex items-center gap-1.5 text-caption font-medium text-score-excellent bg-score-excellent/10 px-2.5 py-1 rounded-badge">
                <CheckCircle2 className="w-3.5 h-3.5" /> Ready
              </span>
            )}
            {provider.isConfigured && !provider.isValid && (
              <span className="flex items-center gap-1.5 text-caption font-medium text-score-average bg-score-average/10 px-2.5 py-1 rounded-badge">
                <AlertCircle className="w-3.5 h-3.5" /> Needs Test
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {fields.map((field) => {
            const isApiKey = field.key === "apiKey";
            const placeholder = isApiKey && provider.isConfigured && !values.apiKey
              ? "••••••••••••••••••••••••••••••••" : "";
            const helperText = isApiKey && !provider.isConfigured ? "" : field.helper;

            return (
              <div key={`${provider.provider}-${field.key}`} className="flex flex-col gap-1.5">
                <Label htmlFor={`${provider.provider}-${field.key}`} className="text-body font-medium">
                  {field.label}
                </Label>
                <div className="relative">
                  {field.options && field.options.length > 0 ? (
                    customModelMode[provider.provider] || (values[field.key] && !field.options.includes(values[field.key])) ? (
                      <div className="flex gap-2 w-full">
                        <Input
                          id={`${provider.provider}-${field.key}`}
                          value={values[field.key] || ""}
                          onChange={(e) => handleFieldChange(provider.provider, field.key, e.target.value)}
                          className="rounded-button flex-1"
                          placeholder="Type custom model name..."
                          autoFocus
                        />
                        <Button 
                          type="button" 
                          variant="ghost" 
                          onClick={() => {
                            setCustomModelMode((prev) => ({ ...prev, [provider.provider]: false }));
                            handleFieldChange(provider.provider, field.key, "");
                          }}
                        >
                          Clear
                        </Button>
                      </div>
                    ) : (
                      <select
                        id={`${provider.provider}-${field.key}`}
                        value={values[field.key] || ""}
                        onChange={(e) => {
                          if (e.target.value === "__custom__") {
                            setCustomModelMode((prev) => ({ ...prev, [provider.provider]: true }));
                            handleFieldChange(provider.provider, field.key, "");
                          } else {
                            handleFieldChange(provider.provider, field.key, e.target.value);
                          }
                        }}
                        className="w-full rounded-button border border-border bg-background px-3 py-2 text-body text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/40 transition-shadow"
                      >
                        <option value="">{provider.model ? `Current: ${provider.model}` : "Select a model..."}</option>
                        {field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        <option value="__custom__">Custom Model...</option>
                      </select>
                    )
                  ) : (
                    <Input
                      id={`${provider.provider}-${field.key}`}
                      type={isApiKey ? (showApiKey ? "text" : "password") : (field.type ?? "text")}
                      value={values[field.key]}
                      onChange={(e) => handleFieldChange(provider.provider, field.key, e.target.value)}
                      className={cn("rounded-button", isApiKey && "pr-10")}
                      placeholder={field.key === "model" ? (provider.model ?? "Use server default") : placeholder}
                    />
                  )}
                  {isApiKey && (values.apiKey.length > 0 || (provider.isConfigured && values.apiKey.length === 0)) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => toggleSecret(provider.provider)}
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
                {helperText && <p className="text-caption text-muted-foreground">{helperText}</p>}
              </div>
            );
          })}

          {message && (
            <div className={cn("px-3 py-2.5 rounded-card text-body font-medium", 
              message.type === "success" ? "bg-score-excellent/10 text-score-excellent" : "bg-score-bad/10 text-score-bad"
            )}>
              {message.text}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={() => handleSave(provider.provider)} disabled={isPending} className="bg-brand-500 text-white hover:bg-brand-600 font-medium rounded-button px-5">
            Save
          </Button>
          <Button variant="secondary" onClick={() => handleTest(provider.provider)} disabled={isPending || !canTest} className="font-medium rounded-button px-5">
            Test
          </Button>
          <Button variant="ghost" onClick={() => handleDelete(provider.provider)} disabled={isPending || !hasMounted || !provider.isConfigured} className="text-score-bad hover:bg-score-bad/10 hover:text-score-bad font-medium rounded-button px-5 ml-auto">
            Remove
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl space-y-10">
      {globalMessage && (
        <div className={cn("px-4 py-3 rounded-card flex items-center gap-3 text-body font-medium animate-in slide-in-from-top-2",
          globalMessage.type === "success" ? "bg-score-excellent/10 text-score-excellent" : "bg-score-bad/10 text-score-bad"
        )}>
          {globalMessage.type === "success" ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          {globalMessage.text}
        </div>
      )}

      {/* Preferences Section */}
      <section className="space-y-6">
        <h3 className="text-caption font-semibold text-muted-foreground uppercase tracking-widest mb-4">Preferences</h3>
        
        {/* Voice Pipeline Mode */}
        <div className="space-y-3">
          <Label className="text-subheading font-heading">Voice Pipeline</Label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-surface rounded-card border border-border">
            <button
              onClick={() => handleSetVoiceMode("cascaded")}
              className={cn("px-4 py-3 rounded-button text-body font-medium transition-default flex items-center justify-center gap-2", 
                defaultVoiceMode === "cascaded" ? "bg-background shadow-sm text-brand-500" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              Cascaded
            </button>
            <button
              onClick={() => handleSetVoiceMode("realtime")}
              className={cn("px-4 py-3 rounded-button text-body font-medium transition-default flex items-center justify-center gap-2", 
                defaultVoiceMode === "realtime" ? "bg-background shadow-sm text-brand-500" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              Real-Time
            </button>
          </div>
          <p className="text-caption text-muted-foreground px-1">
            {defaultVoiceMode === "cascaded" 
              ? "Standard model chaining with separate Speech-to-Text. Compatible with all models."
              : "Low-latency bidirectional streaming. Requires Gemini Live or OpenAI Realtime models."}
          </p>
        </div>

        {/* Active Provider Grid */}
        <div className="space-y-3 pt-4">
          <Label className="text-subheading font-heading">Active Agent</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-element">
            {(defaultVoiceMode === "realtime" ? ["gemini", "openai"] : AI_PROVIDER_ORDER).map((provId) => {
              const status = providers.find((p) => p.provider === provId);
              const isSelected = defaultProvider === provId;
              const isConfigured = status?.isConfigured;
              const isReady = isConfigured && status?.isValid;

              return (
                <button
                  key={provId}
                  onClick={() => handleSetDefault(provId)}
                  className={cn("w-full flex items-center justify-between p-4 text-left transition-default rounded-card border", 
                    isSelected ? "border-brand-500 bg-brand-50/50 shadow-sm" : "border-border bg-card hover:bg-surface-raised hover:-translate-y-[1px]"
                  )}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className={cn("font-heading text-body", isSelected ? "text-brand-700" : "text-foreground")}>{PROVIDER_LABELS[provId as ProviderId]}</span>
                    <span className="text-caption text-muted-foreground">
                      {isReady ? "Ready to use" : isConfigured ? "Configured (Needs Test)" : "Not configured"}
                    </span>
                  </div>
                  {isSelected && <CheckCircle2 className="h-5 w-5 text-brand-500" />}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <hr className="border-border" />

      {/* Configuration Section */}
      <section className="space-y-6">
        <h3 className="text-caption font-semibold text-muted-foreground uppercase tracking-widest mb-4">Platform Credentials</h3>
        
        {/* Pill Navigation for Providers */}
        <div className="flex flex-wrap gap-2">
          {(defaultVoiceMode === "realtime" ? ["gemini", "openai"] : AI_PROVIDER_ORDER).map((provId) => {
            const status = providers.find((p) => p.provider === provId);
            if (!status) return null;
            const isActive = activeProvider === provId;
            const isConfigured = status.isConfigured;

            return (
              <button
                key={provId}
                onClick={() => setActiveProvider(provId as ProviderId)}
                className={cn("px-4 py-2 rounded-badge text-body font-medium transition-default flex items-center gap-2", 
                  isActive ? "bg-brand-500 text-white shadow-sm" : "bg-surface text-muted-foreground hover:bg-surface-raised hover:text-foreground border border-border"
                )}
              >
                {PROVIDER_LABELS[provId as ProviderId]}
                {isConfigured && <span className={cn("h-1.5 w-1.5 rounded-full", isActive ? "bg-white" : "bg-score-excellent")} />}
              </button>
            );
          })}
        </div>

        {/* Active Provider Config Form */}
        <div className="rounded-card border border-border bg-card p-6 md:p-8">
          {renderProviderConfig(activeProviderStatus)}
        </div>

        {/* Deepgram Extra Config for Cascaded */}
        {defaultVoiceMode === "cascaded" && deepgramProvider && (
          <div className="pt-6">
            <h4 className="text-subheading font-heading mb-3">Speech Processing (Deepgram)</h4>
            <div className="rounded-card border border-border bg-card p-6 md:p-8">
              {renderProviderConfig(deepgramProvider)}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
