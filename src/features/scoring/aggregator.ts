import type {
  DimensionScores,
  FluencyMetrics,
  FluencySummary,
  StudyRecommendation,
  AnswerScores,
} from "./types";
import type { ScoringWeights } from "../session/types";

export function calculateFluencyScore(metrics: FluencyMetrics): number {
  // WPM Score (0-100)
  // Ideal range: 120-160 WPM
  let wpmScore: number;
  if (metrics.wordsPerMinute >= 120 && metrics.wordsPerMinute <= 160) {
    wpmScore = 100;
  } else if (metrics.wordsPerMinute < 120) {
    // Linear penalty below 120
    wpmScore = Math.max(0, (metrics.wordsPerMinute / 120) * 100);
  } else {
    // Gradual penalty above 160
    wpmScore = Math.max(0, 100 - ((metrics.wordsPerMinute - 160) / 40) * 50);
  }

  // Pause Score (0-100)
  // 0 pauses = 100, each pause deducts 15 points
  const pauseScore = Math.max(0, 100 - (metrics.totalPauses * 15));

  // Filler Score (0-100)
  // Calculate filler rate per minute
  const speakingMinutes = metrics.speakingTimeMs / 60000;
  const fillerRate = speakingMinutes > 0
    ? metrics.fillerWordCount / speakingMinutes
    : 0;
  // 0 fillers/min = 100, 2/min = 80, 5/min = 50, 10+/min = 0
  const fillerScore = Math.max(0, 100 - (fillerRate * 10));

  // Weighted combination
  const fluencyScore = Math.round(
    wpmScore * 0.35 +
    pauseScore * 0.30 +
    fillerScore * 0.35
  );

  return Math.min(100, Math.max(0, fluencyScore));
}

export function calculateOverallScore(
  dimensionScores: DimensionScores,
  weights: ScoringWeights,
  fluencyScore: number
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [dimension, weight] of Object.entries(weights)) {
    if (weight && weight > 0) {
      const score = dimension === "fluency"
        ? fluencyScore
        : dimensionScores[dimension as keyof DimensionScores] ?? 0;
      weightedSum += score * weight;
      totalWeight += weight;
    }
  }

  // Normalize to 0-100
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

export interface AggregatedReportData {
  overallScore: number;
  roundTypeScore: number;
  dimensionAverages: DimensionScores & { fluency: number };
  fluencySummary: FluencySummary;
  strongestAnswerIds: string[];
  weakestAnswerIds: string[];
  studyRecommendations: StudyRecommendation[];
}

const DIMENSION_RESOURCES: Record<keyof (DimensionScores & { fluency: number }), { topic: string; resources: string[] }> = {
  relevance: {
    topic: "Answer Relevance & Precision",
    resources: ["Art of Structured Thinking", "How to Answer Interview Questions - HBR"],
  },
  depth: {
    topic: "Technical Depth & Elaboration",
    resources: ["Cracking the Coding Interview - Chapter on Technical Questions", "Designing Data-Intensive Applications"],
  },
  technicalAccuracy: {
    topic: "Technical Core Fundamentals",
    resources: ["MDN Web Docs", "System Design Primer", "CS101 Fundamentals"],
  },
  starStructure: {
    topic: "STAR Interview Method",
    resources: ["The STAR Method Explained - Indeed Careers", "STAR Technique Prep Guide - Pramp"],
  },
  timeComplexity: {
    topic: "Algorithm Complexity Analysis",
    resources: ["Introduction to Algorithms (CLRS)", "Big-O Cheat Sheet", "LeetCode Algorithmic Patterns"],
  },
  coherence: {
    topic: "Communication Structure & Flow",
    resources: ["Pyramid Principle - Barbara Minto", "Speaking with Confidence in Tech Interviews"],
  },
  fluency: {
    topic: "Speech Fluency & Filler Control",
    resources: ["Toastmasters International Public Speaking Guide", "How to Speak slower and eliminate fillers"],
  },
};

export function aggregateAnswers(
  answersWithQuestions: Array<{
    id: string;
    scores: AnswerScores;
    fluencyMetrics: FluencyMetrics;
  }>,
  weights: ScoringWeights
): AggregatedReportData {
  const count = answersWithQuestions.length;
  if (count === 0) {
    return {
      overallScore: 0,
      roundTypeScore: 0,
      dimensionAverages: {
        relevance: 0,
        depth: 0,
        technicalAccuracy: 0,
        starStructure: 0,
        timeComplexity: 0,
        coherence: 0,
        fluency: 0,
      },
      fluencySummary: {
        averageWpm: 0,
        totalFillerWords: 0,
        totalPauses: 0,
        wpmTrend: [],
        fillerTrend: [],
      },
      strongestAnswerIds: [],
      weakestAnswerIds: [],
      studyRecommendations: [],
    };
  }

  // Calculate dimension sums
  const dimensionSums: Record<keyof (DimensionScores & { fluency: number }), number> = {
    relevance: 0,
    depth: 0,
    technicalAccuracy: 0,
    starStructure: 0,
    timeComplexity: 0,
    coherence: 0,
    fluency: 0,
  };

  let totalWpm = 0;
  let totalFillerWords = 0;
  let totalPauses = 0;
  const wpmTrend: number[] = [];
  const fillerTrend: number[] = [];

  for (const answer of answersWithQuestions) {
    const scores = answer.scores;
    const fluency = answer.fluencyMetrics;

    dimensionSums.relevance += scores.dimensions.relevance;
    dimensionSums.depth += scores.dimensions.depth;
    dimensionSums.technicalAccuracy += scores.dimensions.technicalAccuracy;
    dimensionSums.starStructure += scores.dimensions.starStructure;
    dimensionSums.timeComplexity += scores.dimensions.timeComplexity;
    dimensionSums.coherence += scores.dimensions.coherence;
    dimensionSums.fluency += scores.dimensions.fluency;

    totalWpm += fluency.wordsPerMinute;
    totalFillerWords += fluency.fillerWordCount;
    totalPauses += fluency.totalPauses;
    wpmTrend.push(fluency.wordsPerMinute);
    fillerTrend.push(fluency.fillerWordCount);
  }

  // Dimension averages
  const dimensionAverages = {
    relevance: Math.round(dimensionSums.relevance / count),
    depth: Math.round(dimensionSums.depth / count),
    technicalAccuracy: Math.round(dimensionSums.technicalAccuracy / count),
    starStructure: Math.round(dimensionSums.starStructure / count),
    timeComplexity: Math.round(dimensionSums.timeComplexity / count),
    coherence: Math.round(dimensionSums.coherence / count),
    fluency: Math.round(dimensionSums.fluency / count),
  };

  // Fluency summary
  const fluencySummary: FluencySummary = {
    averageWpm: Math.round(totalWpm / count),
    totalFillerWords,
    totalPauses,
    wpmTrend,
    fillerTrend,
  };

  // Overall session score (weighted average of dimension averages)
  const fluencyAvgScore = dimensionAverages.fluency;
  const overallScore = calculateOverallScore(dimensionAverages, weights, fluencyAvgScore);
  const roundTypeScore = overallScore; // Default is the weighted average overall score

  // Sort answers by overall score to find strongest and weakest
  const sortedAnswers = [...answersWithQuestions].sort(
    (a, b) => b.scores.overall - a.scores.overall
  );
  const strongestAnswerIds = sortedAnswers.slice(0, 2).map((a) => a.id);
  const weakestAnswerIds = [...sortedAnswers]
    .reverse()
    .slice(0, 2)
    .map((a) => a.id);

  // Study recommendations for dimension average < 60
  const studyRecommendations: StudyRecommendation[] = [];
  for (const [dim, average] of Object.entries(dimensionAverages)) {
    // Only generate recommendations for dimensions that are weighted > 0 in this round
    const weight = weights[dim as keyof ScoringWeights] ?? 0;
    if (weight > 0 && average < 60) {
      let priority: "high" | "medium" | "low" = "low";
      if (average < 30) {
        priority = "high";
      } else if (average <= 50) {
        priority = "medium";
      }

      const info = DIMENSION_RESOURCES[dim as keyof (DimensionScores & { fluency: number })];
      if (info) {
        studyRecommendations.push({
          topic: info.topic,
          resources: info.resources,
          priority,
        });
      }
    }
  }

  // Ensure studyRecommendations is never empty to prevent hardcoded page fallbacks
  if (studyRecommendations.length === 0) {
    let lowestDim: string | null = null;
    let lowestScore = 101;
    for (const [dim, average] of Object.entries(dimensionAverages)) {
      const weight = weights[dim as keyof ScoringWeights] ?? 0;
      if (weight > 0 && average < lowestScore) {
        lowestScore = average;
        lowestDim = dim;
      }
    }

    if (lowestDim) {
      const info = DIMENSION_RESOURCES[lowestDim as keyof (DimensionScores & { fluency: number })];
      if (info) {
        studyRecommendations.push({
          topic: `Advanced ${info.topic}`,
          resources: info.resources,
          priority: "low",
        });
      }
    }
  }

  return {
    overallScore,
    roundTypeScore,
    dimensionAverages,
    fluencySummary,
    strongestAnswerIds,
    weakestAnswerIds,
    studyRecommendations,
  };
}
