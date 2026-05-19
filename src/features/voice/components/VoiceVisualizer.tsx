"use client";

import type { ReactElement } from "react";

import { Mic, Sparkles, Volume2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { VoiceSessionStatus, VoiceLevelSample } from "../types";

type VoiceVisualizerProps = {
  status: VoiceSessionStatus;
  level: VoiceLevelSample;
  questionText: string;
};

function Wave({
  active,
  height,
}: {
  active: boolean;
  height: number;
}): ReactElement {
  return (
    <div
      className={cn(
        "w-2 rounded-full transition-all duration-150",
        active
          ? "bg-brand-500 shadow-[0_0_24px_rgba(242,106,46,0.25)]"
          : "bg-border",
      )}
      style={{ height }}
      aria-hidden
    />
  );
}

export function VoiceVisualizer({
  status,
  level,
  questionText,
}: VoiceVisualizerProps): ReactElement {
  const userSpeaking = status === "listening" && level.speaking;
  const interviewerSpeaking = status === "ai_speaking";
  const thinking = status === "processing" || status === "connecting";

  return (
    <section className="relative overflow-hidden rounded-card border border-border bg-surface-raised p-card">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(242,106,46,0.14)_0%,_rgba(8,166,209,0.06)_35%,_transparent_70%)]"
      />
      <div className="relative flex min-h-[420px] flex-col justify-between gap-section">
        <div className="flex items-center justify-between gap-element">
          <div className="flex items-center gap-element rounded-full border border-border bg-background/80 px-3 py-2 text-caption text-muted-foreground backdrop-blur">
            {status === "ai_speaking" ? (
              <Volume2 className="h-4 w-4 text-brand-500" aria-hidden />
            ) : null}
            {status === "listening" ? (
              <Mic className="h-4 w-4 text-score-excellent" aria-hidden />
            ) : null}
            {status === "processing" ? (
              <Sparkles className="h-4 w-4 text-accent-500" aria-hidden />
            ) : null}
            <span>
              {status === "ai_speaking"
                ? "Interviewer speaking"
                : status === "listening"
                  ? "Recording user"
                  : status === "processing"
                    ? "Processing speech"
                    : status === "paused"
                      ? "Paused"
                      : "Ready"}
            </span>
          </div>
          <div className="rounded-full border border-border bg-background/80 px-3 py-2 text-caption text-muted-foreground backdrop-blur">
            {userSpeaking
              ? "User speaking"
              : interviewerSpeaking
                ? "AI speaking"
                : thinking
                  ? "Thinking"
                  : "Standby"}
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-card text-center">
          <div
            className={cn(
              "relative flex h-40 w-40 items-center justify-center rounded-full border",
              interviewerSpeaking
                ? "border-brand-300 bg-brand-500/10"
                : userSpeaking
                  ? "border-score-excellent/40 bg-score-excellent/10"
                  : "border-border bg-surface",
            )}
          >
            <div
              aria-hidden
              className={cn(
                "absolute inset-5 rounded-full transition-all duration-300",
                interviewerSpeaking
                  ? "animate-pulse bg-[radial-gradient(circle,_rgba(242,106,46,0.3)_0%,_rgba(242,106,46,0.08)_40%,_transparent_70%)]"
                  : userSpeaking
                    ? "bg-[radial-gradient(circle,_rgba(34,197,94,0.25)_0%,_rgba(34,197,94,0.08)_45%,_transparent_75%)]"
                    : thinking
                      ? "bg-[radial-gradient(circle,_rgba(8,166,209,0.22)_0%,_rgba(8,166,209,0.08)_45%,_transparent_75%)]"
                      : "bg-[radial-gradient(circle,_rgba(15,23,42,0.08)_0%,_rgba(15,23,42,0.02)_40%,_transparent_75%)]",
              )}
            />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-border bg-background shadow-card">
              <Mic
                className={cn(
                  "h-10 w-10",
                  interviewerSpeaking
                    ? "text-brand-500"
                    : userSpeaking
                      ? "text-score-excellent"
                      : "text-muted-foreground",
                )}
                aria-hidden
              />
            </div>
          </div>

          <div className="flex items-end gap-2">
            {[0, 1, 2, 3, 4, 5, 6].map((index) => (
              <Wave
                key={index}
                active={interviewerSpeaking || userSpeaking}
                height={
                  interviewerSpeaking
                    ? 48 + ((index * 11) % 48)
                    : userSpeaking
                      ? 24 + ((index * 7) % 32)
                      : 16 + ((index * 3) % 14)
                }
              />
            ))}
          </div>

          <p className="max-w-xl text-body text-muted-foreground">
            {thinking
              ? "Preparing the next prompt."
              : userSpeaking
                ? `Voice level: ${Math.round(level.level * 100)}%`
                : "Keep the conversation moving with spoken answers."}
          </p>
        </div>
      </div>
    </section>
  );
}
