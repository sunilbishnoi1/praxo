// src/features/scoring/index.ts

export * from "./types";
export {
  calculateFluencyScore,
  calculateOverallScore,
  aggregateAnswers,
  type AggregatedReportData,
} from "./aggregator";
export {
  buildAnswerScoringPrompt,
  buildIdealAnswerPrompt,
  buildCompanyFitPrompt,
  buildSessionSummaryPrompt,
} from "./prompts";
export {
  ScoringService,
} from "./scoring.service";
export {
  segmentRealtimeDialogue,
  type MappedDialogueAnswer,
  type DialogueSegmentationResult,
} from "./realtime-scoring.service";
