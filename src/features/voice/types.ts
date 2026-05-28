export type VoiceSessionStatus =
  | "idle"
  | "loading"
  | "connecting"
  | "ai_speaking"
  | "listening"
  | "processing"
  | "paused"
  | "completed"
  | "error";

export type TranscriptSpeaker = "interviewer" | "candidate" | "system";

export type TranscriptMessage = {
  id: string;
  speaker: TranscriptSpeaker;
  text: string;
  timestamp: string;
  questionId?: string | null;
};

export type SessionQuestion = {
  id: string;
  text: string;
  questionType: string;
  difficulty: string;
  orderIndex: number;
  expectedKeyPoints: string[];
  relatedSkills: string[];
  dsaProblemType: string | null;
  expectedTimeComplexity: string | null;
  expectedSpaceComplexity: string | null;
  answered: boolean;
};

export type SessionOverview = {
  id: string;
  status: string;
  roundType: string;
  difficulty: string;
  yearsOfExperience: number | null;
  targetCompanyTier: string | null;
  targetSalaryRange: string | null;
  questionCount: number;
  totalDurationMs: number | null;
  overallScore: number | null;
  useJdForScoring: boolean;
  generateIdealAnswer: boolean;
  voiceOnly: boolean;
  voiceConversationMode: string;
  resume: { id: string; name: string } | null;
  jobDescription: { id: string; name: string } | null;
  gapAnalysis: unknown;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  questions: SessionQuestion[];
};

export type VoiceLevelSample = {
  level: number;
  speaking: boolean;
  timestamp: number;
};

export type FluencySnapshot = {
  wordsPerMinute: number;
  totalWords: number;
  totalPauses: number;
  longestPauseMs: number;
  fillerWordCount: number;
  fillerWords: Array<{ word: string; count: number }>;
  coherenceScore: number;
  speakingTimeMs: number;
  silenceTimeMs: number;
};

export type TranscriptionResponse = {
  success: boolean;
  data?: {
    transcript: string;
    provider: string;
    confidence: number;
  };
  error?: {
    code: string;
    message: string;
  };
};

export type NextQuestionResponse = {
  success: boolean;
  data?:
    | {
        completed: false;
        question: SessionQuestion;
        promptType: "follow_up" | "next_question";
      }
    | {
        completed: true;
        reason: string;
      };
  error?: {
    code: string;
    message: string;
  };
};
