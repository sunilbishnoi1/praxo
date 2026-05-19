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
    <section className="flex h-full flex-col rounded-card border border-border bg-surface-raised">
      <div className="flex items-center justify-between border-b border-border px-card py-element">
        <div className="flex items-center gap-element">
          <MessageSquareText
            className="h-4 w-4 text-muted-foreground"
            aria-hidden
          />
          <h2 className="text-subheading">Transcript</h2>
        </div>
        <p className="text-caption text-muted-foreground">
          Live conversation log
        </p>
      </div>

      <div
        ref={containerRef}
        className="flex-1 space-y-element overflow-y-auto px-card py-card"
      >
        {messages.length === 0 ? (
          <div className="rounded-button border border-dashed border-border bg-surface px-element py-card text-center text-body text-muted-foreground">
            The session transcript will appear here as the interview progresses.
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "rounded-card border px-element py-element text-body",
                message.speaker === "interviewer"
                  ? "border-brand-500/15 bg-brand-500/5"
                  : message.speaker === "candidate"
                    ? "border-score-excellent/15 bg-score-excellent/5"
                    : "border-border bg-surface",
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-element">
                <span className="text-caption uppercase tracking-[0.18em] text-muted-foreground">
                  {message.speaker}
                </span>
                <span className="text-caption text-muted-foreground">
                  {new Date(message.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="leading-relaxed text-foreground">{message.text}</p>
            </div>
          ))
        )}

        {interimTranscript ? (
          <div className="rounded-card border border-accent-500/20 bg-accent-500/5 px-element py-element text-body text-foreground">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-caption uppercase tracking-[0.18em] text-accent-500">
                Listening
              </span>
              <span className="text-caption text-muted-foreground">
                Interim
              </span>
            </div>
            <p>{interimTranscript}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
