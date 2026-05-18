import { z } from "zod";

const configSchema = z.object({
  deploymentMode: z.enum(["lite", "full"]),
  databaseUrl: z.string(),
  accessPin: z.string().optional(),
  encryptionKey: z.string().length(64),
  port: z.coerce.number().default(3000),
  nodeEnv: z.enum(["development", "production", "test"]).default("development"),

  openaiApiKey: z.string().optional(),
  openaiBaseUrl: z.string().optional(),
  openaiDefaultModel: z.string().optional(),
  openaiTtsModel: z.string().optional(),
  openaiTtsVoice: z.string().optional(),

  anthropicApiKey: z.string().optional(),
  anthropicBaseUrl: z.string().optional(),
  anthropicDefaultModel: z.string().optional(),

  geminiApiKey: z.string().optional(),
  geminiDefaultModel: z.string().optional(),

  groqApiKey: z.string().optional(),
  groqDefaultModel: z.string().optional(),

  openrouterApiKey: z.string().optional(),
  openrouterDefaultModel: z.string().optional(),

  ollamaBaseUrl: z.string().default("http://localhost:11434"),
  ollamaDefaultModel: z.string().optional(),

  sttProvider: z.enum(["deepgram", "whisper"]).default("deepgram"),
  ttsProvider: z.enum(["openai", "kokoro"]).default("openai"),
  deepgramApiKey: z.string().optional(),
  deepgramModel: z.string().optional(),
  deepgramLanguage: z.string().optional(),
  whisperModelSize: z.string().optional(),
  whisperDevice: z.string().optional(),
  kokoroModelPath: z.string().optional(),
  kokoroVoice: z.string().optional(),

  sessionMaxDurationMinutes: z.coerce.number().default(60),
  sessionMaxQuestions: z.coerce.number().default(15),
  answerMaxDurationSeconds: z.coerce.number().default(300),
  silenceThresholdMs: z.coerce.number().default(2000),
  fillerWords: z.string().optional(),

  judge0Url: z.string().default("http://localhost:2358"),
  judge0ApiKey: z.string().optional(),
  judge0MaxCpuTime: z.coerce.number().default(5),
  judge0MaxMemoryKb: z.coerce.number().default(128000),

  rateLimitWindowMs: z.coerce.number().default(60000),
  rateLimitMaxRequests: z.coerce.number().default(100),

  logLevel: z.string().default("info"),
  logFormat: z.string().default("json"),
});

export type AppConfig = z.infer<typeof configSchema>;

export const config: AppConfig = configSchema.parse({
  deploymentMode: process.env.DEPLOYMENT_MODE,
  databaseUrl: process.env.DATABASE_URL,
  accessPin: process.env.PRAXO_ACCESS_PIN,
  encryptionKey: process.env.ENCRYPTION_KEY,
  port: process.env.PORT,
  nodeEnv: process.env.NODE_ENV,

  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiBaseUrl: process.env.OPENAI_BASE_URL,
  openaiDefaultModel: process.env.OPENAI_DEFAULT_MODEL,
  openaiTtsModel: process.env.OPENAI_TTS_MODEL,
  openaiTtsVoice: process.env.OPENAI_TTS_VOICE,

  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL,
  anthropicDefaultModel: process.env.ANTHROPIC_DEFAULT_MODEL,

  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiDefaultModel: process.env.GEMINI_DEFAULT_MODEL,

  groqApiKey: process.env.GROQ_API_KEY,
  groqDefaultModel: process.env.GROQ_DEFAULT_MODEL,

  openrouterApiKey: process.env.OPENROUTER_API_KEY,
  openrouterDefaultModel: process.env.OPENROUTER_DEFAULT_MODEL,

  ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
  ollamaDefaultModel: process.env.OLLAMA_DEFAULT_MODEL,

  sttProvider: process.env.STT_PROVIDER,
  ttsProvider: process.env.TTS_PROVIDER,
  deepgramApiKey: process.env.DEEPGRAM_API_KEY,
  deepgramModel: process.env.DEEPGRAM_MODEL,
  deepgramLanguage: process.env.DEEPGRAM_LANGUAGE,
  whisperModelSize: process.env.WHISPER_MODEL_SIZE,
  whisperDevice: process.env.WHISPER_DEVICE,
  kokoroModelPath: process.env.KOKORO_MODEL_PATH,
  kokoroVoice: process.env.KOKORO_VOICE,

  sessionMaxDurationMinutes: process.env.SESSION_MAX_DURATION_MINUTES,
  sessionMaxQuestions: process.env.SESSION_MAX_QUESTIONS,
  answerMaxDurationSeconds: process.env.ANSWER_MAX_DURATION_SECONDS,
  silenceThresholdMs: process.env.SILENCE_THRESHOLD_MS,
  fillerWords: process.env.FILLER_WORDS,

  judge0Url: process.env.JUDGE0_URL,
  judge0ApiKey: process.env.JUDGE0_API_KEY,
  judge0MaxCpuTime: process.env.JUDGE0_MAX_CPU_TIME,
  judge0MaxMemoryKb: process.env.JUDGE0_MAX_MEMORY_KB,

  rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS,
  rateLimitMaxRequests: process.env.RATE_LIMIT_MAX_REQUESTS,

  logLevel: process.env.LOG_LEVEL,
  logFormat: process.env.LOG_FORMAT,
});
