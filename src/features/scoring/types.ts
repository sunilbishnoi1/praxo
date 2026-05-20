// src/features/scoring/types.ts

export interface DimensionScores {
  relevance: number;
  depth: number;
  technicalAccuracy: number;
  starStructure: number;
  timeComplexity: number;
  coherence: number;
}

export interface AnswerScores {
  overall: number;
  dimensions: DimensionScores & { fluency: number };
  feedback: string;
  idealAnswer?: string;
  studyResources: string[];
  strengths: string[];
  improvements: string[];
}

export interface FluencyMetrics {
  wordsPerMinute: number;
  totalWords: number;
  totalPauses: number;
  longestPauseMs: number;
  fillerWordCount: number;
  fillerWords: Array<{ word: string; count: number }>;
  coherenceScore: number;
  speakingTimeMs: number;
  silenceTimeMs: number;
}

export interface FluencySummary {
  averageWpm: number;
  totalFillerWords: number;
  totalPauses: number;
  wpmTrend: number[];
  fillerTrend: number[];
}

export interface StudyRecommendation {
  topic: string;
  resources: string[];
  priority: "high" | "medium" | "low";
}

export interface SessionReportScores {
  overallScore: number;
  roundTypeScore: number;
  dimensionAverages: DimensionScores & { fluency: number };
  fluencySummary: FluencySummary;
  companyFitScore: number | null;
  companyFitAnalysis: string | null;
}
