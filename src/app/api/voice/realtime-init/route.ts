import { NextRequest, NextResponse } from "next/server";
import { verifyAccessPin } from "@/lib/access";
import { prisma } from "@/lib/db";
import { getDefaultUserId } from "@/features/llm/providers.service";
import { config } from "@/lib/config";
import { decryptText } from "@/lib/encryption";
import { LLM_PROVIDERS } from "@/features/llm/types";
import { normalizeGeminiModel, isGeminiLiveModel } from "@/features/llm/adapters/gemini.adapter";
import { WebSocketServer, WebSocket as WSWebSocket } from "ws";

// Extend global type to store the singleton WebSocket server
declare global {
  var wss: WebSocketServer | undefined;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const access = await verifyAccessPin();
  if (!access.allowed) {
    return access.response as NextResponse;
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "sessionId is required." } },
      { status: 400 }
    );
  }

  try {
    const userId = await getDefaultUserId();

    // Check that session exists and belongs to user
    const session = await prisma.session.findUnique({
      where: { id: sessionId, userId, deletedAt: null },
      include: {
        resume: true,
        jobDescription: true,
        questions: { orderBy: { orderIndex: "asc" } },
      },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Session not found." } },
        { status: 404 }
      );
    }

    // Lazy initialize the singleton WebSocket Server on port 3001
    if (!globalThis.wss) {
      console.log("[WSS Proxy] Initializing WebSocket Server on port 3001...");
      const server = new WebSocketServer({ port: 3001 });
      globalThis.wss = server;
    }

    // Always clear old connection listeners and register the newest one to support Next.js Hot Module Replacement (HMR)
    globalThis.wss.removeAllListeners("connection");
    globalThis.wss.on("connection", async (clientWs, req) => {
      console.log("[WSS Proxy] Client connected to proxy server.");
        
        // Parse sessionId from client query string
        const clientUrl = new URL(req.url || "", `http://${req.headers.host}`);
        const connectionSessionId = clientUrl.searchParams.get("sessionId");
        
        if (!connectionSessionId) {
          console.error("[WSS Proxy] Connection rejected: missing sessionId.");
          clientWs.close(4001, "Missing sessionId");
          return;
        }

        try {
          // Fetch session configurations for connection
          const connSession = await prisma.session.findUnique({
            where: { id: connectionSessionId, deletedAt: null },
            include: {
              resume: true,
              jobDescription: true,
              questions: { orderBy: { orderIndex: "asc" } },
              user: true,
            },
          });

          if (!connSession) {
            console.error("[WSS Proxy] Connection rejected: Session not found in DB.");
            clientWs.close(4004, "Session not found");
            return;
          }

          const connUserId = connSession.userId;
          const preferredProvider = connSession.llmProvider || connSession.user.defaultLlmProvider || "gemini";

          console.log(`[WSS Proxy] Session active. Preferred provider: ${preferredProvider}`);

          // Retrieve and decrypt the API key
          const configEntry = await prisma.providerConfig.findUnique({
            where: {
              userId_provider: {
                userId: connUserId,
                provider: preferredProvider,
              },
            },
          });

          const apiKey = preferredProvider === "ollama"
            ? ""
            : configEntry 
              ? decryptText(configEntry.apiKey, config.encryptionKey)
              : (preferredProvider === "openai" ? config.openaiApiKey :
                 preferredProvider === "gemini" ? config.geminiApiKey :
                 preferredProvider === "anthropic" ? config.anthropicApiKey : "");

          if (!apiKey && preferredProvider !== "ollama") {
            console.error(`[WSS Proxy] API Key not found or configured for ${preferredProvider}.`);
            clientWs.close(4003, `API Key missing for ${preferredProvider}`);
            return;
          }

          let providerWsUrl = "";
          let outboundHeaders: Record<string, string> = {};

          // Construct the session system instructions
          const questionsList = connSession.questions.map((q, idx) => `${idx + 1}. ${q.text}`).join("\n");
          const resumeText = connSession.resume?.rawText || "Not provided";
          const jdText = connSession.jobDescription?.rawText || "Not provided";

          const systemInstructions = `
You are Praxo's premium AI interviewer. Your voice is warm, natural, and highly professional.
You are conducting a live interactive audio interview for a candidate.

INTERVIEW CONFIGURATION:
- Round Type: ${connSession.roundType}
- Difficulty: ${connSession.difficulty}
- Target YOE: ${connSession.yearsOfExperience ?? "Not specified"}
- Target Company Tier: ${connSession.targetCompanyTier ?? "General"}

CANDIDATE PROFILE:
- Resume Background:
${resumeText}

JOB PROFILE:
- Target Job Description:
${jdText}

STRUCTURED INTERVIEW QUESTIONS:
You MUST cover these questions during the interview, in order.
${questionsList}

CRITICAL GUIDELINES:
1. Speak clearly, warmly, and empathetically.
2. Ask one question at a time. Let the candidate answer fully before responding.
3. You may ask AT MOST 1-2 brief follow-up probes per question if the candidate's answer is shallow or incomplete. Do NOT keep probing the same question indefinitely.
4. IMPORTANT: When moving to the next question, clearly signal the transition. For example say "Great, let's move on" or "Now, for the next question" before asking it. This clear transition is critical for our post-interview analysis.
5. Ask each structured question in a way that preserves its core intent, even if you rephrase it slightly for conversational flow.
6. If they ask for clarification, explain nicely and concisely.
7. Once all questions have been covered, wrap up the interview gracefully: thank the candidate, briefly summarize what was discussed, and let them know the system will analyze their responses.
8. NEVER speak in long text walls. Keep your conversational turns concise, conversational, and direct.
9. Do NOT repeat questions that have already been answered.
          `.trim();

          let outboundWs: WSWebSocket;

          // Resolve the user-configured model, fall back to stable defaults
          const rawRealtimeModel = configEntry?.model ?? (
            preferredProvider === "gemini" ? "gemini-2.5-flash-native-audio-preview-12-2025" : "gpt-4o-realtime-preview"
          );
          const realtimeModel = preferredProvider === "gemini"
            ? normalizeGeminiModel(rawRealtimeModel)
            : rawRealtimeModel;
          console.log(`[WSS Proxy] Using model: ${realtimeModel}`);

          if (preferredProvider === "openai") {
            providerWsUrl = `wss://api.openai.com/v1/realtime?model=${realtimeModel}`;
            outboundHeaders = {
              "Authorization": `Bearer ${apiKey}`,
              "OpenAI-Beta": "realtime=v1",
            };

            console.log(`[WSS Proxy] Connecting to OpenAI Realtime Gateway: ${providerWsUrl}`);
            outboundWs = new WSWebSocket(providerWsUrl, { headers: outboundHeaders });

            outboundWs.on("open", () => {
              console.log("[WSS Proxy] Connected to OpenAI Realtime Gateway.");
              // Send session setup configuration
              const setupEvent = {
                type: "session.update",
                session: {
                  modalities: ["audio", "text"],
                  instructions: systemInstructions,
                  voice: "alloy",
                  input_audio_format: "pcm16",
                  output_audio_format: "pcm16",
                  turn_detection: {
                    type: "server_vad",
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 500,
                  },
                },
              };
              outboundWs.send(JSON.stringify(setupEvent));
            });

          } else {
            // Multimodal Live API currently always requires v1alpha
            const wsApiVersion = "v1alpha";
            providerWsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${wsApiVersion}.GenerativeService.BidiGenerateContent?key=${apiKey}`;

            console.log(`[WSS Proxy] Connecting to Gemini Live Gateway (${wsApiVersion})...`);
            outboundWs = new WSWebSocket(providerWsUrl);

            outboundWs.on("open", () => {
              console.log("[WSS Proxy] Connected to Gemini Multimodal Live Gateway.");
              // Send setup payload with input/output transcription enabled
              const setupEvent = {
                setup: {
                  model: realtimeModel.startsWith("models/") ? realtimeModel : `models/${realtimeModel}`,
                  generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                      voiceConfig: {
                        prebuiltVoiceConfig: {
                          voiceName: "Puck",
                        },
                      },
                    },
                  },
                  systemInstruction: {
                    parts: [
                      { text: systemInstructions }
                    ]
                  },
                  // Enable transcription so we get text for both speakers
                  inputAudioTranscription: {},
                  outputAudioTranscription: {},
                },
              };
              console.log("[WSS Proxy] Sending Gemini setup payload:", JSON.stringify(setupEvent, null, 2).slice(0, 800));
              outboundWs.send(JSON.stringify(setupEvent));
            });
          }

          // Track whether we've sent setup_complete to avoid duplicates
          let setupCompleteSent = false;

          // Timeout: if Gemini doesn't complete setup within 15s, close with error
          const setupTimeout = setTimeout(() => {
            if (!setupCompleteSent) {
              console.error("[WSS Proxy] Gemini setup timed out after 15 seconds.");
              clientWs.send(JSON.stringify({
                type: "error",
                message: "Voice gateway setup timed out. Please check your API key and model configuration.",
              }));
              clientWs.close(4008, "Setup timeout");
              if (outboundWs.readyState === WSWebSocket.OPEN || outboundWs.readyState === WSWebSocket.CONNECTING) {
                outboundWs.close();
              }
            }
          }, 15000);

          // Handle outbound WS messages and pipe back to the client
          outboundWs.on("message", (data) => {
            if (clientWs.readyState === WSWebSocket.OPEN) {
              // Gemini sometimes sends JSON payloads inside binary WebSocket frames.
              // Convert all payloads to string since both Gemini and OpenAI use JSON-based protocols.
              const text = Buffer.isBuffer(data) ? data.toString("utf8") : data.toString();
              
              try {
                const parsed = JSON.parse(text);
                  
                  // Debug: log all incoming messages from Gemini (truncated)
                  const keys = Object.keys(parsed);
                  console.log(`[WSS Proxy] Gemini message received. Keys: [${keys.join(", ")}]`, text.slice(0, 500));
                  
                  // Log server-side errors from Gemini or OpenAI
                  if (parsed.error) {
                    console.error("[WSS Proxy] Received gateway error:", JSON.stringify(parsed.error, null, 2));
                  }
                  
                  // Detect Gemini's setupComplete (check both camelCase and snake_case)
                  if ((parsed.setupComplete !== undefined || parsed.setup_complete !== undefined) && !setupCompleteSent) {
                    setupCompleteSent = true;
                    clearTimeout(setupTimeout);
                    console.log("[WSS Proxy] Gemini setup complete. Notifying client.");
                    clientWs.send(JSON.stringify({ type: "setup_complete" }));
                    // Don't forward the raw setupComplete to client, we sent our own
                    return;
                  }
                  // Forward all other JSON messages to client
                  clientWs.send(text);
                } catch {
                  // non-JSON, forward raw
                  clientWs.send(text);
                }
            }
          });

          outboundWs.on("close", (code, reason) => {
            clearTimeout(setupTimeout);
            const reasonStr = reason ? reason.toString() : "";
            console.log(`[WSS Proxy] Outbound WS closed (code: ${code}, reason: ${reasonStr}).`);
            if (!setupCompleteSent) {
              // Setup never completed — send error to client
              clientWs.send(JSON.stringify({
                type: "error",
                message: `Voice gateway connection failed (code: ${code}). Check your Gemini API key and model.`,
              }));
            }
            clientWs.close(1000, "Outbound closed");
          });

          outboundWs.on("error", (err) => {
            clearTimeout(setupTimeout);
            const errMsg = err instanceof Error ? err.message : "Unknown connection error";
            console.error("[WSS Proxy] Outbound WS Error:", errMsg);
            clientWs.send(JSON.stringify({
              type: "error",
              message: `Voice gateway connection error: ${errMsg}`,
            }));
          });

          // Handle client incoming messages and pipe to outbound gateway
          clientWs.on("message", (message, isBinary) => {
            if (outboundWs.readyState !== WSWebSocket.OPEN) return;

            if (isBinary) {
              // Binary data is 16kHz raw PCM. We need to encapsulate it
              const base64Audio = message.toString("base64");
              if (preferredProvider === "openai") {
                outboundWs.send(JSON.stringify({
                  type: "input_audio_buffer.append",
                  audio: base64Audio,
                }));
              } else {
                outboundWs.send(JSON.stringify({
                  realtimeInput: {
                    mediaChunks: [
                      {
                        data: base64Audio,
                        mimeType: "audio/pcm;rate=16000",
                      },
                    ],
                  },
                }));
              }
            } else {
              // Parse control messages
              try {
                const textMsg = message.toString();
                const parsed = JSON.parse(textMsg);
                
                if (parsed.type === "interruption" || parsed.type === "response.cancel") {
                  console.log("[WSS Proxy] Client interrupted AI voice output.");
                  if (preferredProvider === "openai") {
                    outboundWs.send(JSON.stringify({ type: "response.cancel" }));
                  } else {
                    // Gemini interruption is done by sending a clientContent with empty/interruption part or restarting turn
                    // The Gemini live protocol automatically handles silence input. Sending an empty chunk clears outbound.
                    outboundWs.send(JSON.stringify({
                      clientContent: {
                        turns: [
                          {
                            role: "user",
                            parts: [{ text: "" }],
                          },
                        ],
                        turnComplete: true
                      }
                    }));
                  }
                } else if (parsed.type === "client_text" && typeof parsed.text === "string") {
                  if (preferredProvider === "openai") {
                    outboundWs.send(JSON.stringify({
                      type: "conversation.item.create",
                      item: {
                        type: "message",
                        role: "user",
                        content: [{ type: "input_text", text: parsed.text }],
                      },
                    }));
                    outboundWs.send(JSON.stringify({
                      type: "response.create",
                      response: {
                        modalities: ["audio", "text"],
                      },
                    }));
                  } else {
                    outboundWs.send(JSON.stringify({
                      clientContent: {
                        turns: [
                          {
                            role: "user",
                            parts: [{ text: parsed.text }],
                          },
                        ],
                        turnComplete: true,
                      },
                    }));
                  }
                } else if (parsed.type === "audio_stream_end") {
                  if (preferredProvider !== "openai") {
                    outboundWs.send(JSON.stringify({
                      realtimeInput: {
                        audioStreamEnd: true,
                      },
                    }));
                  }
                } else {
                  // Forward custom JSON text payloads directly
                  outboundWs.send(textMsg);
                }
              } catch {
                // Forward plain text string directly
                outboundWs.send(message.toString());
              }
            }
          });

          clientWs.on("close", () => {
            clearTimeout(setupTimeout);
            console.log("[WSS Proxy] Client disconnected.");
            if (outboundWs.readyState === WSWebSocket.OPEN || outboundWs.readyState === WSWebSocket.CONNECTING) {
              outboundWs.close();
            }
          });

          clientWs.on("error", (err) => {
            console.error("[WSS Proxy] Client WS Error:", err);
            if (outboundWs.readyState === WSWebSocket.OPEN || outboundWs.readyState === WSWebSocket.CONNECTING) {
              outboundWs.close();
            }
          });

        } catch (err: unknown) {
          console.error("[WSS Proxy] Error setting up session proxy connection:", err);
          const message = err instanceof Error ? err.message : "Internal server error";
          clientWs.close(1011, message);
        }
      });

    return NextResponse.json({
      success: true,
      data: {
        url: `ws://localhost:3001?sessionId=${sessionId}`,
      },
    });
  } catch (err: unknown) {
    console.error("GET /api/voice/realtime-init failed:", err);
    const message = err instanceof Error ? err.message : "Failed to initialize voice session socket.";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
