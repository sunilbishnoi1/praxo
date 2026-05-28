// Client-side Low-Latency Real-Time Voice Connection Manager
// Implements PCM Audio Capture (16kHz mono) and gapless Audio Playback Queue (24kHz mono)

export class PCMPlayer {
  private audioCtx: AudioContext | null = null;
  private nextPlayTime: number = 0;
  private sampleRate: number = 24000; // Gemini/OpenAI return 24kHz mono PCM
  private activeSources: AudioBufferSourceNode[] = [];

  constructor() {
    // Lazy initialized on first chunk to satisfy browser gesture requirements
  }

  private initAudio() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass({ sampleRate: this.sampleRate });
      this.nextPlayTime = this.audioCtx.currentTime;
    }
    if (this.audioCtx.state === "suspended") {
      void this.audioCtx.resume();
    }
  }

  public playChunk(base64Data: string) {
    this.initAudio();
    if (!this.audioCtx) return;

    try {
      // Decode base64 to binary buffer
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert Uint8Array to little-endian Int16 and then to Float32 (-1.0 to 1.0)
      const dataView = new DataView(bytes.buffer);
      const float32Data = new Float32Array(len / 2);
      
      for (let i = 0; i < len / 2; i++) {
        const int16 = dataView.getInt16(i * 2, true); // true = little-endian
        float32Data[i] = int16 / 32768.0;
      }

      // Schedule gapless playback
      const audioBuffer = this.audioCtx.createBuffer(1, float32Data.length, this.sampleRate);
      audioBuffer.getChannelData(0).set(float32Data);

      const bufferSource = this.audioCtx.createBufferSource();
      bufferSource.buffer = audioBuffer;
      bufferSource.connect(this.audioCtx.destination);

      const currentTime = this.audioCtx.currentTime;
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime;
      }

      bufferSource.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration;

      // Track active sources for interruption
      this.activeSources.push(bufferSource);
      bufferSource.onended = () => {
        this.activeSources = this.activeSources.filter(s => s !== bufferSource);
      };
    } catch (err) {
      console.error("[Realtime Voice] Playback chunk error:", err);
    }
  }

  public stopAll() {
    // Stop all currently playing sources
    for (const source of this.activeSources) {
      try { source.stop(); } catch {}
    }
    this.activeSources = [];

    if (this.audioCtx) {
      void this.audioCtx.close();
      this.audioCtx = null;
    }
    this.nextPlayTime = 0;
  }

  public interrupt() {
    // Stop playing sources but keep context alive
    for (const source of this.activeSources) {
      try { source.stop(); } catch {}
    }
    this.activeSources = [];
    if (this.audioCtx) {
      this.nextPlayTime = this.audioCtx.currentTime;
    }
  }
}

export type RealtimeVoiceController = {
  stop: () => void;
  sendInterruption: () => void;
  sendText: (text: string) => void;
};

export type RealtimeVoiceOptions = {
  wsUrl: string;
  onTranscriptChange?: (speaker: "candidate" | "interviewer", text: string, isFinal: boolean) => void;
  onStatusChange?: (status: "connecting" | "ai_speaking" | "listening" | "processing" | "error") => void;
  onLevelSample?: (level: number, speaking: boolean) => void;
  onError?: (err: string) => void;
};

export async function startRealtimeVoice(
  options: RealtimeVoiceOptions
): Promise<RealtimeVoiceController> {
  const { wsUrl, onTranscriptChange, onStatusChange, onLevelSample, onError } = options;

  onStatusChange?.("connecting");

  const ws = new WebSocket(wsUrl);
  const player = new PCMPlayer();
  
  let audioStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let processor: ScriptProcessorNode | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let analyser: AnalyserNode | null = null;
  
  // State tracking
  let isSetupComplete = false;
  let isAISpeaking = false;
  let isRecording = false;
  let isStopped = false;
  const pendingText: string[] = [];

  // Setup timeout: if setup_complete doesn't arrive within 15s, fire error
  const setupTimeoutId = setTimeout(() => {
    if (!isSetupComplete && !isStopped) {
      console.error("[Realtime Client] Setup timed out after 15 seconds.");
      onError?.("Voice gateway setup timed out. Please check your API key and model configuration, then try again.");
      onStatusChange?.("error");
      isStopped = true;
      ws.close();
      player.stopAll();
      stopTracks();
    }
  }, 15000);

  ws.binaryType = "arraybuffer";

  const flushPendingText = () => {
    if (!isSetupComplete || ws.readyState !== WebSocket.OPEN) {
      return;
    }
    while (pendingText.length > 0) {
      const next = pendingText.shift();
      if (!next) {
        continue;
      }
      console.log("[Realtime Client] Flushing pending text to server.");
      ws.send(JSON.stringify({ type: "client_text", text: next }));
    }
  };

  const startRecording = async () => {
    if (isRecording || isStopped) return;
    
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContext = new AudioContextClass({ sampleRate: 16000 }); // Downsample to 16kHz for LLMs
      
      sourceNode = audioContext.createMediaStreamSource(audioStream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      sourceNode.connect(analyser);

      // Capture buffer size of 2048
      processor = audioContext.createScriptProcessor(2048, 1, 1);
      
      const buffer = new Float32Array(analyser.fftSize);
      const speechThreshold = 0.15;
      
      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN || isStopped) return;

        // VAD (Voice Activity Detection) Level Calculations
        analyser?.getFloatTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i] * buffer[i];
        }
        const rms = Math.sqrt(sum / buffer.length);
        const level = Math.min(rms * 10, 1.0);
        const speaking = level >= speechThreshold;

        onLevelSample?.(level, speaking);

        // Do NOT manually drop audio while AI is speaking.
        // Gemini's server-side VAD handles turn detection naturally;
        // we must stream continuously so the server can hear interruptions.

        // Convert Float32 microphone data to Int16 PCM little-endian
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Send binary PCM frame to WS Proxy
        ws.send(pcmData.buffer);
      };

      sourceNode.connect(processor);
      processor.connect(audioContext.destination);
      isRecording = true;
      console.log("[Realtime Client] Microphone recording started.");

    } catch (err: unknown) {
      console.error("[Realtime Voice] Mic capture error:", err);
      onError?.("Microphone access is required for real-time voice interviews.");
    }
  };

  ws.onopen = () => {
    console.log("[Realtime Client] Connected to WebSocket proxy server.");
  };

  ws.onmessage = (event) => {
    try {
      if (typeof event.data === "string") {
        const parsed = JSON.parse(event.data);
        
        // Handle setup completion from proxy
        if (parsed.type === "setup_complete") {
          console.log("[Realtime Client] Setup complete signal received.");
          isSetupComplete = true;
          clearTimeout(setupTimeoutId);
          // Flush any queued text (e.g., the initial "ask first question" prompt)
          flushPendingText();
          // Do NOT start recording yet — wait until AI finishes speaking the first question
          return;
        }

        // Handle Gemini serverContent responses
        if (parsed.serverContent) {
          const parts = parsed.serverContent.modelTurn?.parts || [];
          for (const part of parts) {
            // Text delta from the model (only present with TEXT in responseModalities)
            if (part.text) {
              onTranscriptChange?.("interviewer", part.text, false);
            }
            // Inline audio chunk from the model
            if (part.inlineData && part.inlineData.data) {
              if (!isAISpeaking) {
                isAISpeaking = true;
                onStatusChange?.("ai_speaking");
                console.log("[Realtime Client] AI started speaking.");
              }
              player.playChunk(part.inlineData.data);
            }
          }

          // Handle output transcription (text of what the AI is saying)
          if (parsed.serverContent.outputTranscription?.text) {
            onTranscriptChange?.("interviewer", parsed.serverContent.outputTranscription.text, false);
          }

          // Handle input transcription (text of what the user said)
          if (parsed.serverContent.inputTranscription?.text) {
            onTranscriptChange?.("candidate", parsed.serverContent.inputTranscription.text, false);
          }

          // turnComplete signals the AI is done with its response
          if (parsed.serverContent.turnComplete) {
            console.log("[Realtime Client] AI turn complete. Switching to listening.");
            isAISpeaking = false;
            onStatusChange?.("listening");
            
            // Start recording if not already recording
            if (!isRecording && !isStopped) {
              void startRecording();
            }
          }

          // Handle interruption signal from Gemini
          if (parsed.serverContent.interrupted) {
            console.log("[Realtime Client] AI was interrupted by user speech.");
            isAISpeaking = false;
            player.interrupt();
            onStatusChange?.("listening");
          }
        }
        
        // Handle OpenAI Realtime responses
        if (parsed.type === "response.audio.delta" && parsed.delta) {
          if (!isAISpeaking) {
            isAISpeaking = true;
            onStatusChange?.("ai_speaking");
          }
          player.playChunk(parsed.delta);
        }
        if (parsed.type === "response.audio_transcript.delta" && parsed.delta) {
          onTranscriptChange?.("interviewer", parsed.delta, false);
        }
        if (parsed.type === "response.done") {
          isAISpeaking = false;
          onStatusChange?.("listening");
          if (!isRecording && !isStopped) {
            void startRecording();
          }
        }
        if (parsed.type === "input_audio_buffer.speech_started") {
          // Client interrupted the AI
          isAISpeaking = false;
          player.interrupt();
          onStatusChange?.("listening");
        }

        // Handle proxy and gateway errors (Gemini/OpenAI)
        if (parsed.error) {
          const errMsg = parsed.error.message || JSON.stringify(parsed.error);
          console.error("[Realtime Client] Gateway error:", errMsg);
          onError?.(errMsg);
          return;
        }
        if (parsed.type === "error") {
          console.error("[Realtime Client] Server error:", parsed.message);
          onError?.(parsed.message || "Server error");
        }
      }
    } catch (err) {
      console.error("[Realtime Voice] Socket message parsing error:", err);
    }
  };

  ws.onclose = (ev) => {
    console.log(`[Realtime Client] Connection closed (code: ${ev.code}, reason: ${ev.reason}).`);
    clearTimeout(setupTimeoutId);
    const wasStopped = isStopped;
    isStopped = true;
    player.stopAll();
    stopTracks();
    // If we weren't intentionally stopped and setup hadn't completed, surface error
    if (!wasStopped && !isSetupComplete) {
      onError?.(`Voice connection closed unexpectedly (code: ${ev.code}). Please try again.`);
      onStatusChange?.("error");
    }
  };

  ws.onerror = (ev) => {
    console.error("[Realtime Client] Connection error:", ev);
    clearTimeout(setupTimeoutId);
    onError?.("WebSocket connection failure. Check your network and try again.");
    onStatusChange?.("error");
  };

  const stopTracks = () => {
    isRecording = false;
    if (processor) {
      processor.onaudioprocess = null;
      processor.disconnect();
      processor = null;
    }
    if (sourceNode) {
      sourceNode.disconnect();
      sourceNode = null;
    }
    if (audioContext) {
      void audioContext.close();
      audioContext = null;
    }
    if (audioStream) {
      audioStream.getTracks().forEach((t) => t.stop());
      audioStream = null;
    }
  };

  return {
    stop: () => {
      isStopped = true;
      clearTimeout(setupTimeoutId);
      ws.close();
      player.stopAll();
      stopTracks();
    },
    sendInterruption: () => {
      // Send an interruption signal to clear AI generation queues
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "interruption" }));
      }
      isAISpeaking = false;
      player.interrupt();
    },
    sendText: (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      if (!isSetupComplete || ws.readyState !== WebSocket.OPEN) {
        pendingText.push(trimmed);
        return;
      }
      ws.send(JSON.stringify({ type: "client_text", text: trimmed }));
    },
  };
}
