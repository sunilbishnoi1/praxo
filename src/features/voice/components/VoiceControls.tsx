"use client";

import type { ReactElement } from "react";

import { Mic, MicOff, PauseCircle, PlayCircle, Square } from "lucide-react";

import { Button } from "@/components/ui/button";

type VoiceControlsProps = {
  micActive: boolean;
  paused: boolean;
  onToggleMic: () => void;
  onPause: () => void;
  onEndSession: () => void;
  statusLabel: string;
  meterLevel: number;
};

export function VoiceControls({
  micActive,
  paused,
  onToggleMic,
  onPause,
  onEndSession,
  statusLabel,
  meterLevel,
}: VoiceControlsProps): ReactElement {
  return (
    <div className="flex items-center justify-between gap-element rounded-card border border-border bg-surface-raised px-card py-element shadow-card">
      <div className="flex items-center gap-element">
        <Button
          type="button"
          size="icon"
          variant={micActive ? "default" : "secondary"}
          onClick={onToggleMic}
          aria-label={micActive ? "Disable microphone" : "Enable microphone"}
        >
          {micActive ? (
            <Mic className="h-4 w-4" aria-hidden />
          ) : (
            <MicOff className="h-4 w-4" aria-hidden />
          )}
        </Button>
        <div>
          <p className="text-body font-semibold text-foreground">
            {statusLabel}
          </p>
          <div className="mt-2 flex h-2 w-44 overflow-hidden rounded-full border border-border bg-muted">
            <div
              className="rounded-full bg-brand-500 transition-all duration-150"
              style={{
                width: `${Math.min(Math.max(meterLevel, 0), 1) * 100}%`,
              }}
              aria-hidden
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-element">
        <Button
          type="button"
          variant="secondary"
          onClick={onPause}
          aria-label={paused ? "Resume interview" : "Pause interview"}
        >
          {paused ? (
            <PlayCircle className="mr-2 h-4 w-4" aria-hidden />
          ) : (
            <PauseCircle className="mr-2 h-4 w-4" aria-hidden />
          )}
          {paused ? "Resume" : "Pause"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onEndSession}
          aria-label="End session"
        >
          <Square className="mr-2 h-4 w-4" aria-hidden />
          End Session
        </Button>
      </div>
    </div>
  );
}
