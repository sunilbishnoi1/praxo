export type LLMErrorCode =
  | "INVALID_API_KEY"
  | "RATE_LIMITED"
  | "CONTEXT_TOO_LONG"
  | "CONTENT_FILTERED"
  | "MODEL_NOT_FOUND"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "PROVIDER_ERROR"
  | "INVALID_RESPONSE";

export class LLMError extends Error {
  readonly provider: string;
  readonly code: LLMErrorCode;
  readonly retryable: boolean;
  readonly cause?: Error;

  constructor(
    message: string,
    provider: string,
    code: LLMErrorCode,
    retryable: boolean,
    cause?: Error
  ) {
    super(message);
    this.provider = provider;
    this.code = code;
    this.retryable = retryable;
    this.cause = cause;
  }
}

export const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: ["RATE_LIMITED", "NETWORK_ERROR", "TIMEOUT"] as const,
};

export function isRetryableError(code: LLMErrorCode): boolean {
  return RETRY_CONFIG.retryableErrors.includes(code);
}

export function mapHttpStatusToErrorCode(status: number): LLMErrorCode {
  if (status === 401 || status === 403) {
    return "INVALID_API_KEY";
  }

  if (status === 404) {
    return "MODEL_NOT_FOUND";
  }

  if (status === 429) {
    return "RATE_LIMITED";
  }

  if (status >= 500) {
    return "PROVIDER_ERROR";
  }

  return "INVALID_RESPONSE";
}
