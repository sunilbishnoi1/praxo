"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { ArrowLeft, Clock3, Loader2, Sparkles, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/shared/ErrorState";
import type {
  FluencySnapshot,
  NextQuestionResponse,
  SessionOverview,
  TranscriptMessage,
  VoiceLevelSample,
  VoiceSessionStatus,
} from "../types";
import { createVoiceCapture } from "../capture";
import { analyzeFluency } from "../fluency/analyzer";
import { TranscriptPanel } from "./TranscriptPanel";
import { VoiceControls } from "./VoiceControls";
import { VoiceVisualizer } from "./VoiceVisualizer";

type InterviewSessionProps = {
  sessionId: string;
};

type VoiceRecognitionResult = {
  isFinal: boolean;
  0?: {
    transcript?: string;
  };
};

type VoiceRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<VoiceRecognitionResult>;
};

type VoiceRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: VoiceRecognitionEvent) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
};

type VoiceRecognitionConstructor = {
  new (): VoiceRecognitionInstance;
};

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function getSpeechRecognitionConstructor():
  | VoiceRecognitionConstructor
  | undefined {
  const globalWindow = window as Window & {
    SpeechRecognition?: VoiceRecognitionConstructor;
    webkitSpeechRecognition?: VoiceRecognitionConstructor;
  };

  return globalWindow.SpeechRecognition ?? globalWindow.webkitSpeechRecognition;
}

export function InterviewSession({
  sessionId,
}: InterviewSessionProps): ReactElement {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionOverview | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [voiceStatus, setVoiceStatus] = useState<VoiceSessionStatus>("loading");
  const [level, setLevel] = useState<VoiceLevelSample>({
    level: 0,
    speaking: false,
    timestamp: Date.now(),
  });
  const [micActive, setMicActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [questionRevealed, setQuestionRevealed] = useState(false);
  const [thinkingLabel, setThinkingLabel] = useState("Preparing session");
  const [sessionComplete, setSessionComplete] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [generationStage, setGenerationStage] = useState("Initializing report engine...");
  const [generationProgress, setGenerationProgress] = useState(10);

  const chunksRef = useRef<Blob[]>([]);
  const captureRef = useRef<Awaited<
    ReturnType<typeof createVoiceCapture>
  > | null>(null);
  const recognitionRef = useRef<VoiceRecognitionInstance | null>(null);
  const lastSpeechAtRef = useRef<number>(Date.now());
  const currentQuestionRef = useRef<string>("");
  const interimTranscriptRef = useRef("");
  const localTranscriptRef = useRef("");
  const loadedOnceRef = useRef(false);
  const pausedRef = useRef(false);

  // Advanced synchronization refs for robust timing/async flows
  const sessionRef = useRef<SessionOverview | null>(null);
  const sessionCompleteRef = useRef<boolean>(false);
  const voiceStatusRef = useRef<VoiceSessionStatus>("loading");
  const silenceWatcherRef = useRef<number | null>(null);
  const hasSpokenRef = useRef<boolean>(false);

  const currentQuestion = session?.questions[currentQuestionIndex] ?? null;
  const currentQuestionText =
    currentQuestion?.text ?? "Loading the next prompt...";
  const transcriptMessages = useMemo(
    () =>
      [...messages].sort((left, right) =>
        left.timestamp.localeCompare(right.timestamp),
      ),
    [messages],
  );

  const changeVoiceStatus = useCallback((status: VoiceSessionStatus) => {
    setVoiceStatus(status);
    voiceStatusRef.current = status;
  }, []);

  const ensureMicCapture = useCallback(async (): Promise<boolean> => {
    if (captureRef.current) {
      return true;
    }

    try {
      const capture = await createVoiceCapture({
        onLevel: (sample) => {
          setLevel({
            level: sample.rms,
            speaking: sample.speaking,
            timestamp: Date.now(),
          });
          if (sample.speaking && voiceStatusRef.current === "listening") {
            lastSpeechAtRef.current = Date.now();
            hasSpokenRef.current = true;
          }
        },
        onChunk: (chunk) => {
          if (voiceStatusRef.current === "listening") {
            chunksRef.current.push(chunk);
          }
        },
      });

      captureRef.current = capture;
      setMicActive(true);
      return true;
    } catch (err) {
      console.error("Failed to start voice capture:", err);
      setError(
        "Microphone access is required for the voice interview. Please enable microphone permissions in your browser and try again.",
      );
      setMicActive(false);
      return false;
    }
  }, []);

  // Forward declarations of dynamic callbacks using refs to prevent circular dependencies
  const startListeningSessionRef = useRef<() => Promise<void>>(async () => {});
  const speakRef = useRef<(text: string) => Promise<void>>(async () => {});
  const submitTurnRef = useRef<
    (answerText: string, audioBlob?: Blob) => Promise<void>
  >(async () => {});

  const startListeningSession = useCallback(async (): Promise<void> => {
    if (pausedRef.current || sessionCompleteRef.current || !currentQuestionRef.current) {
      return;
    }

    const micStarted = await ensureMicCapture();
    if (!micStarted) {
      return;
    }

    setInterimTranscript("");
    chunksRef.current = [];
    localTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    lastSpeechAtRef.current = Date.now();
    hasSpokenRef.current = false;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    const recognitionConstructor = getSpeechRecognitionConstructor();
    if (recognitionConstructor) {
      const recognition =
        new recognitionConstructor() as VoiceRecognitionInstance;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        let finalTranscriptText = "";
        let interimText = "";

        for (
          let index = event.resultIndex;
          index < event.results.length;
          index += 1
        ) {
          const result = event.results[index];
          const transcriptText = result[0]?.transcript ?? "";

          if (result.isFinal) {
            finalTranscriptText += transcriptText;
          } else {
            interimText += transcriptText;
          }
        }

        if (finalTranscriptText) {
          localTranscriptRef.current =
            `${localTranscriptRef.current} ${finalTranscriptText}`.trim();
        }

        if (interimText) {
          interimTranscriptRef.current = interimText;
          setInterimTranscript(interimText);
        }
      };

      recognition.onerror = () => {
        recognition.stop();
      };

      recognition.onend = () => {
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch (err) {
        console.error("Failed to start Speech Recognition:", err);
      }
    }

    if (captureRef.current) {
      try {
        if (captureRef.current.mediaRecorder.state !== "inactive") {
          captureRef.current.mediaRecorder.stop();
        }
      } catch {}
      try {
        captureRef.current.mediaRecorder.start(250);
      } catch (err) {
        console.error("Failed to start MediaRecorder:", err);
      }
    }

    changeVoiceStatus("listening");
    setThinkingLabel("Listening for answer");

    if (silenceWatcherRef.current) {
      window.clearInterval(silenceWatcherRef.current);
    }

    silenceWatcherRef.current = window.setInterval(() => {
      if (!captureRef.current || pausedRef.current || sessionCompleteRef.current) {
        if (silenceWatcherRef.current) {
          window.clearInterval(silenceWatcherRef.current);
          silenceWatcherRef.current = null;
        }
        return;
      }

      const elapsedSinceSpeech = Date.now() - lastSpeechAtRef.current;
      const hasSpoken =
        localTranscriptRef.current.trim().length > 0 ||
        interimTranscriptRef.current.trim().length > 0 ||
        hasSpokenRef.current;

      const silenceThreshold = hasSpoken ? 2000 : 7000;

      if (elapsedSinceSpeech >= silenceThreshold) {
        if (silenceWatcherRef.current) {
          window.clearInterval(silenceWatcherRef.current);
          silenceWatcherRef.current = null;
        }

        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch {}
          recognitionRef.current = null;
        }

        if (captureRef.current && captureRef.current.mediaRecorder.state !== "inactive") {
          try {
            captureRef.current.mediaRecorder.stop();
          } catch {}
        }

        const audioBlob =
          chunksRef.current.length > 0
            ? new Blob(chunksRef.current, {
                type: chunksRef.current[0]?.type || "audio/webm",
              })
            : undefined;
        const transcript =
          localTranscriptRef.current || interimTranscriptRef.current;
        void submitTurnRef.current(transcript, audioBlob);
      }
    }, 300);
  }, [ensureMicCapture, changeVoiceStatus]);

  startListeningSessionRef.current = startListeningSession;

  const speak = useCallback(
    async (text: string): Promise<void> => {
      if (!text.trim()) {
        return;
      }

      currentQuestionRef.current = text;
      changeVoiceStatus("ai_speaking");
      setThinkingLabel("Interviewer speaking");

      try {
        const response = await fetch("/api/voice/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, text }),
        });

        if (
          response.ok &&
          response.headers.get("content-type")?.includes("audio/")
        ) {
          const audio = await response.blob();
          const url = URL.createObjectURL(audio);
          const element = new Audio(url);
          await new Promise<void>((resolve) => {
            element.onended = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            element.onerror = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            void element.play();
          });
        } else if (typeof window !== "undefined" && window.speechSynthesis) {
          await new Promise<void>((resolve) => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1;
            utterance.pitch = 1;
            utterance.onend = () => resolve();
            utterance.onerror = () => resolve();
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
          });
        }
      } catch {
        if (typeof window !== "undefined" && window.speechSynthesis) {
          await new Promise<void>((resolve) => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.onend = () => resolve();
            utterance.onerror = () => resolve();
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
          });
        }
      } finally {
        if (!pausedRef.current && !sessionCompleteRef.current) {
          void startListeningSessionRef.current();
        } else {
          changeVoiceStatus(pausedRef.current ? "paused" : "idle");
        }
      }
    },
    [sessionId, changeVoiceStatus],
  );

  speakRef.current = speak;

  const loadSession = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      const json = (await response.json()) as {
        success: boolean;
        data?: { session: SessionOverview };
        error?: { message?: string };
      };

      if (!json.success || !json.data) {
        throw new Error(json.error?.message || "Failed to load session.");
      }

      let loadedSession = json.data.session;
      setSession(loadedSession);
      sessionRef.current = loadedSession;
      setCurrentQuestionIndex(0);

      if (loadedSession.status === "configuring") {
        setThinkingLabel("Starting interview");
        const startResponse = await fetch(`/api/sessions/${sessionId}/start`, {
          method: "POST",
        });
        const startJson = (await startResponse.json()) as {
          success: boolean;
          error?: { message?: string };
        };

        if (!startJson.success) {
          throw new Error(
            startJson.error?.message || "Failed to start session.",
          );
        }

        const refreshed = await fetch(`/api/sessions/${sessionId}`);
        const refreshedJson = (await refreshed.json()) as {
          success: boolean;
          data?: { session: SessionOverview };
        };
        if (refreshedJson.success && refreshedJson.data) {
          loadedSession = refreshedJson.data.session;
          setSession(loadedSession);
          sessionRef.current = loadedSession;
        }
      }

      if (!loadedOnceRef.current && loadedSession.questions[0]) {
        const firstQuestion = loadedSession.questions[0];
        const introMessage: TranscriptMessage = {
          id: createId("interviewer"),
          speaker: "interviewer",
          text: firstQuestion.text,
          timestamp: new Date().toISOString(),
          questionId: firstQuestion.id,
        };
        setMessages([introMessage]);
        loadedOnceRef.current = true;

        // Auto-request mic permission immediately at start
        setThinkingLabel("Requesting microphone access");
        const micStarted = await ensureMicCapture();
        if (micStarted) {
          setThinkingLabel("Interviewer speaking");
          if (captureRef.current && captureRef.current.mediaRecorder.state !== "inactive") {
            try {
              captureRef.current.mediaRecorder.stop();
            } catch {}
          }
        }
        setLoading(false);
        void speakRef.current(firstQuestion.text);
      }
    } catch (exception) {
      const message =
        exception instanceof Error
          ? exception.message
          : "Unable to load interview session.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [sessionId, ensureMicCapture]);

  async function submitTurn(
    answerText: string,
    audioBlob?: Blob,
  ): Promise<void> {
    if (!currentQuestion) {
      return;
    }

    changeVoiceStatus("processing");
    setThinkingLabel("Deciding next prompt");

    const transcript = answerText.trim();
    if (!transcript && audioBlob) {
      try {
        const formData = new FormData();
        formData.append("sessionId", sessionId);
        formData.append("audio", audioBlob, "answer.webm");

        const response = await fetch("/api/voice/transcribe", {
          method: "POST",
          body: formData,
        });

        const json = (await response.json()) as {
          success: boolean;
          data?: { transcript: string };
          error?: { message?: string };
        };
        if (json.success && json.data?.transcript) {
          await submitTurnRef.current(json.data.transcript);
          return;
        }
      } catch {
        // fall through to empty transcript handling
      }
    }

    const cleanedTranscript =
      transcript || localTranscriptRef.current || interimTranscriptRef.current;
    const nextMessage: TranscriptMessage = {
      id: createId("candidate"),
      speaker: "candidate",
      text: cleanedTranscript || "[No transcript captured]",
      timestamp: new Date().toISOString(),
      questionId: currentQuestion.id,
    };

    setMessages((currentMessages) => [...currentMessages, nextMessage]);

    const fluencySnapshot = analyzeFluency({
      transcript: cleanedTranscript,
      audioDurationMs: Math.max(elapsedMs, 1),
      silenceDurationsMs: [],
    });

    const nextResponse = await fetch("/api/voice/next-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        questionId: currentQuestion.id,
        answerText: cleanedTranscript,
        fluency: fluencySnapshot satisfies FluencySnapshot,
      }),
    });

    const nextJson = (await nextResponse.json()) as NextQuestionResponse;
    if (!nextJson.success || !nextJson.data) {
      throw new Error(
        nextJson.error?.message || "Could not compute the next question.",
      );
    }

    const nextData = nextJson.data;

    if (nextData.completed) {
      setThinkingLabel(nextData.reason);
      await endSessionAndGenerateReport("completed");
      return;
    }

    const assistantMessage: TranscriptMessage = {
      id: createId("interviewer"),
      speaker: "interviewer",
      text: nextData.question.text,
      timestamp: new Date().toISOString(),
      questionId: nextData.question.id,
    };

    setCurrentQuestionIndex((currentIndex) => {
      const nextIndex = currentIndex + 1;
      return nextData.promptType === "follow_up"
        ? currentIndex
        : Math.min(nextIndex, sessionRef.current?.questions.length ?? nextIndex);
    });
    setMessages((currentMessages) => [...currentMessages, assistantMessage]);
    await speakRef.current(nextData.question.text);
  }

  submitTurnRef.current = submitTurn;

  async function stopCapture(): Promise<void> {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (silenceWatcherRef.current) {
      window.clearInterval(silenceWatcherRef.current);
      silenceWatcherRef.current = null;
    }
    if (captureRef.current) {
      captureRef.current.stop();
      captureRef.current = null;
    }
    setMicActive(false);
  }

  async function toggleMic(): Promise<void> {
    if (micActive) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
        recognitionRef.current = null;
      }
      if (silenceWatcherRef.current) {
        window.clearInterval(silenceWatcherRef.current);
        silenceWatcherRef.current = null;
      }
      if (captureRef.current) {
        captureRef.current.stop();
        captureRef.current = null;
      }
      setMicActive(false);
      changeVoiceStatus(paused ? "paused" : "idle");
      return;
    }

    const micStarted = await ensureMicCapture();
    if (micStarted && voiceStatusRef.current === "listening") {
      void startListeningSessionRef.current();
    }
  }

  async function pauseInterview(): Promise<void> {
    if (paused) {
      setPaused(false);
      pausedRef.current = false;
      if (micActive) {
        void startListeningSessionRef.current();
      } else {
        changeVoiceStatus("idle");
      }
      return;
    }

    setPaused(true);
    pausedRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (silenceWatcherRef.current) {
      window.clearInterval(silenceWatcherRef.current);
      silenceWatcherRef.current = null;
    }
    changeVoiceStatus("paused");
  }

  async function endSessionAndGenerateReport(reason: "completed" | "abandoned"): Promise<void> {
    setGeneratingReport(true);
    setSessionComplete(true);
    sessionCompleteRef.current = true;
    await stopCapture();
    changeVoiceStatus("completed");

    const interval = setInterval(() => {
      setGenerationProgress((p) => {
        if (p >= 90) return p;
        const nextProgress = p + Math.floor(Math.random() * 15) + 5;
        if (nextProgress < 30) setGenerationStage("Analyzing vocal delivery & WPM pacing...");
        else if (nextProgress < 60) setGenerationStage("Evaluating technical correctness & algorithm parameters...");
        else if (nextProgress < 85) setGenerationStage("Correlating response depth with target job requirements...");
        else setGenerationStage("Assembling final grades and study roadmap...");
        return Math.min(nextProgress, 90);
      });
    }, 1500);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await response.json();
      clearInterval(interval);
      setGenerationProgress(100);
      setGenerationStage("Report ready! Redirecting...");

      if (json.success && json.data?.reportId) {
        setTimeout(() => {
          router.push(`/reports/${json.data.reportId}`);
        }, 800);
      } else {
        router.push("/");
      }
    } catch (err) {
      console.error(err);
      clearInterval(interval);
      router.push("/");
    }
  }

  async function endInterview(): Promise<void> {
    await endSessionAndGenerateReport("completed");
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSession();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      void stopCapture();
      if (typeof window !== "undefined") {
        window.speechSynthesis?.cancel();
      }
    };
  }, [loadSession]);

  useEffect(() => {
    if (!session || loading || sessionComplete) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedMs((value) => value + 1000);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [session, loading, sessionComplete]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-element text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" aria-hidden />
        <p className="text-body font-semibold">Configuring voice socket...</p>
      </div>
    );
  }

  if (generatingReport) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(167,58,0,0.08)_0%,_rgba(167,58,0,0)_70%)] animate-pulse"
        />
        <div className="max-w-md w-full px-6 text-center space-y-6 z-10">
          <div className="relative flex justify-center">
            <Loader2 className="h-16 w-16 animate-spin text-brand-500" />
            <Sparkles className="absolute h-6 w-6 text-accent-500 animate-bounce top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div className="space-y-2">
            <h2 className="font-display text-3xl font-bold text-foreground tracking-tight">
              Generating Final Report
            </h2>
            <p className="text-body text-muted-foreground animate-pulse font-medium h-6">
              {generationStage}
            </p>
          </div>
          <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
            <div 
              className="h-full bg-brand-500 transition-all duration-500 ease-out" 
              style={{ width: `${generationProgress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Unable to start voice session"
        message={error}
        action={
          <Button asChild className="bg-brand-500 hover:bg-brand-600 text-white font-semibold">
            <Link href="/session/new">Back to Configuration</Link>
          </Button>
        }
      />
    );
  }

  if (!session) {
    return (
      <ErrorState
        title="Session not found"
        message="The requested interview session could not be loaded."
        action={
          <Button asChild className="bg-brand-500 hover:bg-brand-600 text-white font-semibold">
            <Link href="/session/new">Start New Session</Link>
          </Button>
        }
      />
    );
  }

  const sessionLabel = `${session.roundType.replace(/-/g, " ")} · ${session.difficulty}`;

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden bg-background">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 px-6 py-4 backdrop-blur flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="rounded-full border border-brand-500/20 bg-brand-500/10 px-3 py-1 font-bold text-caption text-brand-700 uppercase tracking-wider">
            {session.roundType.replace(/-/g, " ")}
          </span>
          <span className="rounded-full border border-border bg-card px-3 py-1 font-semibold text-caption text-muted-foreground uppercase tracking-wider">
            {session.difficulty}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 font-mono text-body-md font-bold text-foreground">
            <Clock3 className="h-4 w-4 text-brand-500" aria-hidden />
            {new Date(Math.max(elapsedMs, 0)).toISOString().slice(14, 19)}
          </div>
          <Button variant="outline" className="border-red-500 text-red-500 hover:bg-red-500/10 font-semibold" onClick={endInterview}>
            End Session
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 px-6 py-4 flex flex-col justify-between overflow-hidden">
        {/* Main Grid */}
        <div className="grid gap-stack-md lg:grid-cols-[7fr_5fr] items-stretch flex-1 min-h-0">
          <div className="flex flex-col gap-stack-md justify-between min-h-0 h-full">
            <div className="rounded-lg border border-border bg-card p-stack-md flex flex-col gap-4 shrink-0">
              <div className="flex items-center justify-between gap-element">
                <Button variant="ghost" size="sm" asChild className="hover:bg-muted font-semibold">
                  <Link href="/session/new">
                    <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />
                    Configure
                  </Link>
                </Button>
                <div className="flex items-center gap-1.5 font-semibold text-caption text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-accent-600 animate-pulse" aria-hidden />
                  {thinkingLabel}
                </div>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setQuestionRevealed((current) => !current)}
                  className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/20 hover:bg-muted/40 px-4 py-3 text-left transition-colors duration-200 cursor-pointer"
                >
                  <span className="text-body font-bold text-foreground">
                    Reveal Live Prompt
                  </span>
                  <span className="text-caption text-muted-foreground font-semibold flex items-center gap-1">
                    {questionRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {questionRevealed ? "Hide Prompt" : "Show Prompt"}
                  </span>
                </button>

                {questionRevealed && (
                  <div className="p-4 rounded-lg border border-brand-500/20 bg-brand-500/5 transition-all duration-300">
                    <p className="text-[10px] uppercase tracking-wider text-brand-700 font-bold">
                      Active Question
                    </p>
                    <p className="mt-2 text-body font-medium text-foreground leading-relaxed">
                      {currentQuestionText}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-center min-h-0">
              <VoiceVisualizer
                status={voiceStatus}
                level={level}
                questionText={currentQuestionText}
              />
            </div>
          </div>

          {/* Scrollable live transcript */}
          <div className="h-full border border-border rounded-lg bg-card overflow-hidden flex flex-col min-h-0">
            <TranscriptPanel
              messages={transcriptMessages}
              interimTranscript={interimTranscript}
            />
          </div>
        </div>
      </main>

      {/* Bottom Dashboard Controller */}
      <div className="border-t border-border bg-background/95 px-6 py-4 shadow-md shrink-0">
        <div className="max-w-[1200px] mx-auto flex w-full flex-col gap-3">
          <VoiceControls
            micActive={micActive}
            paused={paused}
            onToggleMic={() => void toggleMic()}
            onPause={() => void pauseInterview()}
            onEndSession={() => void endInterview()}
            statusLabel={
              voiceStatus === "ai_speaking"
                ? "AI speaking..."
                : voiceStatus === "listening"
                  ? "Listening for your answer"
                  : voiceStatus === "processing"
                    ? "Processing your response"
                    : voiceStatus === "paused"
                      ? "Paused"
                      : sessionComplete
                        ? "Session complete"
                        : "Standby"
            }
            meterLevel={level.level}
          />
          <div className="flex items-center justify-between gap-element text-caption text-muted-foreground/80 font-bold uppercase tracking-wider">
            <span>{sessionLabel}</span>
            <span>
              {sessionComplete
                ? "Interview complete"
                : currentQuestion
                  ? `Question ${currentQuestion.orderIndex + 1} of ${session.questions.length}`
                  : "Preparing next question"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
