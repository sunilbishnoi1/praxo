"use client";

import { useEffect, useRef, type ReactElement } from "react";

import { MessageSquareText } from "lucide-react";

import { cn } from "@/lib/utils";
import type { TranscriptMessage } from "../types";

type TranscriptPanelProps = {
  messages: TranscriptMessage[];
  interimTranscript: string;
};

export function TranscriptPanel({
  messages,
  interimTranscript,
}: TranscriptPanelProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, interimTranscript]);

  return (
    <section className="flex h-full flex-col rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-card py-element bg-muted/10">
        <div className="flex items-center gap-2">
          <MessageSquareText
            className="h-4 w-4 text-muted-foreground"
            aria-hidden
          />
          <h2 className="text-body font-display font-bold text-foreground">Transcript</h2>
        </div>
        <p className="text-caption text-muted-foreground font-semibold">
          Live Conversation Log
        </p>
      </div>

      <div
        ref={containerRef}
        className="flex-1 space-y-3 overflow-y-auto px-card py-card bg-muted/5"
      >
        {messages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card px-4 py-6 text-center text-caption text-muted-foreground font-medium">
            The session transcript will appear here as the interview progresses.
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "rounded-lg border px-4 py-3 text-body font-medium transition-all duration-200",
                message.speaker === "interviewer"
                  ? "border-brand-500/15 bg-brand-500/5 shadow-[0_0_12px_rgba(242,106,46,0.02)]"
                  : message.speaker === "candidate"
                    ? "border-emerald-500/15 bg-emerald-500/5 shadow-[0_0_12px_rgba(16,185,129,0.02)]"
                    : "border-border bg-card",
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-element">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  {message.speaker}
                </span>
                <span className="text-[10px] text-muted-foreground font-medium">
                  {new Date(message.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="leading-relaxed text-foreground text-caption">{message.text}</p>
            </div>
          ))
        )}

        {interimTranscript && (
          <div className="rounded-lg border border-accent-500/20 bg-accent-500/5 px-4 py-3 text-body text-foreground animate-pulse">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-wider text-accent-600">
                Listening
              </span>
              <span className="text-[10px] text-muted-foreground font-medium">
                Interim
              </span>
            </div>
            <p className="text-caption font-medium leading-relaxed">{interimTranscript}</p>
          </div>
        )}
      </div>
    </section>
  );
}
