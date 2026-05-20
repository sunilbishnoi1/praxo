export interface ProgressSummary {
  averageScore: number;
  growthPercentage: number;
  fillerWordChangePercentage: number;
  readinessLevel: "High" | "Medium" | "Low";
  totalSessions: number;
  totalDurationMs: number;
  averageWpm: number;
  averageFillerWordRate: number; // as percentage of speaking time or per minute
  domainReadiness: {
    systemDesign: number;
    behavioural: number;
    dsa: number;
    oop: number;
    technicalResume: number;
  };
  deliveryCoachAdvice: string;
  trend: Array<{
    sessionId: string;
    sessionDate: string;
    roundType: string;
    difficulty: string;
    overallScore: number;
    fluencyScore: number;
    relevanceScore: number;
    depthScore: number;
    technicalScore: number;
    coherenceScore: number;
    averageWpm: number;
    fillerWordCount: number;
    pauseCount: number;
    questionCount: number;
    durationMs: number;
  }>;
}
