import { GapAnalysis } from "../personalization";

export interface ScoringWeights {
  relevance: number;
  depth: number;
  technicalAccuracy?: number;
  fluency: number;
  coherence: number;
  starStructure?: number;
  timeComplexity?: number;
}

export interface SessionContext {
  difficulty: string;
  yearsOfExperience?: number;
  targetCompanyTier?: string;
  resumeSkills?: string[];
  resumeExperience?: any[];
  jobDescriptionSkills?: string[];
  gapAnalysis?: GapAnalysis;
}

export interface GeneratedQuestion {
  questionText: string;
  difficulty: "easy" | "medium" | "hard";
  expectedKeyPoints: string[];
  relatedSkills: string[];
  // Round-specific fields
  dsaProblemType?: string;
  expectedTimeComplexity?: string;
  expectedSpaceComplexity?: string;
  expectedStar?: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
  expectedComponents?: string[];
}

export interface RoundType {
  id: string;
  name: string;
  description: string;
  phase: 1 | 2;
  icon: string; // Lucide icon name

  getSystemPrompt(context: SessionContext): string;
  generateQuestions(context: SessionContext): Promise<GeneratedQuestion[]>;
  generateFollowUp(
    answerText: string,
    questionText: string,
    context: SessionContext
  ): Promise<GeneratedQuestion | null>;
  getScoringWeights(): ScoringWeights;
  getQuestionCount(difficulty: string): number;
}
