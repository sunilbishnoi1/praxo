import { detectFillers, normalizeFillerWords, type FillerMatch } from "./filler-detector";

export type FluencyAnalysisInput = {
  transcript: string;
  audioDurationMs: number;
  silenceDurationsMs?: number[];
  fillerWords?: string | null;
};

export type FluencyAnalysis = {
  wordsPerMinute: number;
  totalWords: number;
  totalPauses: number;
  longestPauseMs: number;
  fillerWordCount: number;
  fillerWords: FillerMatch[];
  coherenceScore: number;
  speakingTimeMs: number;
  silenceTimeMs: number;
};

export function analyzeFluency(input: FluencyAnalysisInput): FluencyAnalysis {
  const fillerList = normalizeFillerWords(input.fillerWords);
  const words = input.transcript
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const silenceDurationsMs = input.silenceDurationsMs ?? [];
  const speakingTimeMs = Math.max(
    input.audioDurationMs - silenceDurationsMs.reduce((sum, pause) => sum + pause, 0),
    1
  );
  const wordsPerMinute = Math.round((words.length / speakingTimeMs) * 60000);
  const fillerWords = detectFillers(input.transcript, fillerList);
  const fillerWordCount = fillerWords.reduce((sum, match) => sum + match.count, 0);
  const totalPauses = silenceDurationsMs.length;
  const longestPauseMs = silenceDurationsMs.length > 0 ? Math.max(...silenceDurationsMs) : 0;
  const silenceTimeMs = silenceDurationsMs.reduce((sum, pause) => sum + pause, 0);

  return {
    wordsPerMinute,
    totalWords: words.length,
    totalPauses,
    longestPauseMs,
    fillerWordCount,
    fillerWords,
    coherenceScore: 0,
    speakingTimeMs,
    silenceTimeMs,
  };
}

export function summarizeFluencyScore(analysis: FluencyAnalysis): number {
  const paceScore =
    analysis.wordsPerMinute >= 120 && analysis.wordsPerMinute <= 160
      ? 100
      : analysis.wordsPerMinute >= 100 && analysis.wordsPerMinute <= 180
        ? 80
        : analysis.wordsPerMinute >= 80 && analysis.wordsPerMinute <= 200
          ? 60
          : 40;

  const fillerPenalty = Math.min(analysis.fillerWordCount * 4, 30);
  const pausePenalty = Math.min(analysis.totalPauses * 5, 20);

  return Math.max(Math.round(paceScore - fillerPenalty - pausePenalty), 0);
}
