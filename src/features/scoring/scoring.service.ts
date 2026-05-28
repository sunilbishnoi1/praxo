import { z } from "zod";
import { getActiveLLMProvider } from "@/features/llm";
import { getRoundType } from "@/features/session/round-registry";
import { calculateFluencyScore, calculateOverallScore } from "./aggregator";
import {
  buildAnswerScoringPrompt,
  buildIdealAnswerPrompt,
  buildCompanyFitPrompt,
  buildSessionExecutiveSummaryPrompt,
  buildSessionStrengthsWeaknessesPrompt,
  buildSessionNextFocusPrompt,
} from "./prompts";
import type { AnswerScores, FluencyMetrics, DimensionScores } from "./types";

export const llmScoringResponseSchema = z.object({
  relevance: z.coerce.number(),
  depth: z.coerce.number(),
  technicalAccuracy: z.coerce.number(),
  starStructure: z.coerce.number(),
  timeComplexity: z.coerce.number(),
  coherence: z.coerce.number(),
  feedback: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  studyResources: z.array(z.string()),
});

export const companyFitResponseSchema = z.object({
  companyFitScore: z.coerce.number(),
  companyFitAnalysis: z.string(),
});

export const sessionSummaryResponseSchema = z.object({
  overallSummary: z.string(),
  keyStrengths: z.array(z.string()),
  keyWeaknesses: z.array(z.string()),
  nextSessionFocus: z.string(),
});

function cleanJsonString(raw: string): string {
  let clean = raw.trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  }
  return clean;
}

export class ScoringValidationError extends Error {
  constructor(message: string, public errors?: unknown) {
    super(message);
    this.name = "ScoringValidationError";
  }
}

export class ScoringService {
  /**
   * Evaluates a single answer using LLM and Fluency metrics
   */
  static async scoreAnswer(params: {
    questionText: string;
    answerTranscript: string;
    expectedKeyPoints: string[];
    fluencyMetrics: FluencyMetrics;
    roundType: string;
    difficulty: string;
    yearsOfExperience: number;
    useJdForScoring?: boolean;
    jobDescriptionText?: string;
    generateIdeal?: boolean;
    resumeContext?: string;
    jdContext?: string;
    companyTier?: string;
  }): Promise<AnswerScores> {
    const {
      questionText,
      answerTranscript,
      expectedKeyPoints,
      fluencyMetrics,
      roundType,
      difficulty,
      yearsOfExperience,
      useJdForScoring = true,
      jobDescriptionText = "",
      generateIdeal = true,
      resumeContext = "",
      jdContext = "",
      companyTier = "general",
    } = params;

    // 1. Compute Fluency score mathematically
    const fluencyScore = calculateFluencyScore(fluencyMetrics);

    // 2. Call LLM for dimension scores
    const roundInstance = getRoundType(roundType);
    const weights = roundInstance.getScoringWeights();

    const companyContext = useJdForScoring && jobDescriptionText
      ? `Target Job Description:\n${jobDescriptionText}`
      : "Target role: Software Engineer";

    const promptInput = {
      roundType: roundInstance.name,
      difficulty,
      yearsOfExperience,
      companyContext,
      questionText,
      answerTranscript,
      expectedKeyPoints: expectedKeyPoints.join("\n- "),
      wpm: fluencyMetrics.wordsPerMinute,
      pauseCount: fluencyMetrics.totalPauses,
      fillerWordCount: fluencyMetrics.fillerWordCount,
      speakingDurationSeconds: Math.round(fluencyMetrics.speakingTimeMs / 1000),
    };

    const scoringPrompt = buildAnswerScoringPrompt(promptInput);

    // Run scoring and ideal answer generation in parallel to reduce latency
    const scoringPromise = this.executeScoringWithRetry(scoringPrompt);
    const idealAnswerPromise = generateIdeal
      ? this.generateIdealAnswer({
          roundType: roundInstance.name,
          difficulty,
          yearsOfExperience,
          companyTier,
          resumeContext,
          jdContext,
          questionText,
          expectedKeyPoints: expectedKeyPoints.join("\n- "),
        })
      : Promise.resolve(undefined);

    const [llmScores, idealAnswer] = await Promise.all([
      scoringPromise,
      idealAnswerPromise,
    ]);

    // 3. Compute overall score
    const overall = calculateOverallScore(llmScores, weights, fluencyScore);

    return {
      overall,
      dimensions: {
        relevance: llmScores.relevance,
        depth: llmScores.depth,
        technicalAccuracy: llmScores.technicalAccuracy,
        starStructure: llmScores.starStructure,
        timeComplexity: llmScores.timeComplexity,
        coherence: llmScores.coherence,
        fluency: fluencyScore,
      },
      feedback: llmScores.feedback,
      idealAnswer,
      studyResources: llmScores.studyResources,
      strengths: llmScores.strengths,
      improvements: llmScores.improvements,
    };
  }

  private static async executeScoringWithRetry(
    prompt: string,
    retryCount = 0
  ): Promise<z.infer<typeof llmScoringResponseSchema>> {
    try {
      const { adapter } = await getActiveLLMProvider();
      const response = await adapter.chat({
        model: adapter.maxContextTokens["gpt-4o"] ? "gpt-4o" : "default",
        messages: [
          { role: "system", content: "You are an expert interview evaluator. Output valid JSON only." },
          { role: "user", content: prompt },
        ],
        responseFormat: "json",
        temperature: 0.1,
      });

      const cleaned = cleanJsonString(response.content);
      const parsed = JSON.parse(cleaned) as unknown;

      const validated = llmScoringResponseSchema.safeParse(parsed);
      if (!validated.success) {
        throw new ScoringValidationError("LLM returned malformed JSON schema.", validated.error);
      }

      // Clamp all scores to 0-100
      const data = validated.data;
      data.relevance = Math.min(100, Math.max(0, Math.round(data.relevance)));
      data.depth = Math.min(100, Math.max(0, Math.round(data.depth)));
      data.technicalAccuracy = Math.min(100, Math.max(0, Math.round(data.technicalAccuracy)));
      data.starStructure = Math.min(100, Math.max(0, Math.round(data.starStructure)));
      data.timeComplexity = Math.min(100, Math.max(0, Math.round(data.timeComplexity)));
      data.coherence = Math.min(100, Math.max(0, Math.round(data.coherence)));

      return data;
    } catch (error) {
      console.error(`Scoring LLM call failed (attempt ${retryCount + 1}):`, error);

      if (retryCount < 1) {
        // Retry #1: Re-prompt with strict instruction
        const stricterPrompt = `${prompt}\n\nIMPORTANT: You must return a valid JSON object matching the requested schema. Ensure all fields are present and scores are numbers between 0 and 100. Do not write anything other than JSON.`;
        return this.executeScoringWithRetry(stricterPrompt, retryCount + 1);
      }

      // Fallback: Neutral scores
      return {
        relevance: 50,
        depth: 50,
        technicalAccuracy: 50,
        starStructure: 50,
        timeComplexity: 50,
        coherence: 50,
        feedback: "*AI Analysis*: Service error.\n*Ideal ans*: Could not retrieve detailed score analysis due to a service error. Neutral scores assigned.",
        strengths: ["Completed this interview question"],
        improvements: ["Ensure structured explanation in the next question"],
        studyResources: ["Interview Prep Guides"],
      };
    }
  }

  /**
   * Generates ideal answer text for a question
   */
  static async generateIdealAnswer(params: {
    roundType: string;
    difficulty: string;
    yearsOfExperience: number;
    companyTier: string;
    resumeContext: string;
    jdContext: string;
    questionText: string;
    expectedKeyPoints: string;
  }): Promise<string> {
    try {
      const { adapter } = await getActiveLLMProvider();
      const prompt = buildIdealAnswerPrompt(params);

      const response = await adapter.chat({
        model: adapter.maxContextTokens["gpt-4o"] ? "gpt-4o" : "default",
        messages: [
          { role: "system", content: "You are an expert interview coach. Return only the ideal answer text. No preamble." },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
      });

      return response.content.trim();
    } catch (error) {
      console.error("Ideal answer generation failed:", error);
      return "Could not generate ideal answer at this time.";
    }
  }

  /**
   * Performs company-fit analysis at the end of the session
   */
  static async analyzeCompanyFit(params: {
    jobDescriptionText: string;
    roundType: string;
    overallScore: number;
    dimensionScores: DimensionScores & { fluency: number };
    strengths: string[];
    weaknesses: string[];
    resumeSkills: string[];
    averageWpm: number;
    fillerFrequency: number;
    coherenceScore: number;
  }): Promise<{ companyFitScore: number; companyFitAnalysis: string }> {
    try {
      const { adapter } = await getActiveLLMProvider();
      const prompt = buildCompanyFitPrompt({
        jobDescriptionText: params.jobDescriptionText,
        roundType: params.roundType,
        overallScore: params.overallScore,
        dimensionScoresJson: JSON.stringify(params.dimensionScores),
        strengths: params.strengths.join(", "),
        weaknesses: params.weaknesses.join(", "),
        resumeSkills: params.resumeSkills.join(", "),
        averageWpm: params.averageWpm,
        fillerFrequency: params.fillerFrequency,
        coherenceScore: params.coherenceScore,
      });

      const response = await adapter.chat({
        model: adapter.maxContextTokens["gpt-4o"] ? "gpt-4o" : "default",
        messages: [
          { role: "system", content: "You are a professional recruiter. Output valid JSON only." },
          { role: "user", content: prompt },
        ],
        responseFormat: "json",
        temperature: 0.2,
      });

      const cleaned = cleanJsonString(response.content);
      const parsed = JSON.parse(cleaned) as unknown;

      const validated = companyFitResponseSchema.safeParse(parsed);
      if (!validated.success) {
        throw new Error("Invalid company-fit JSON response");
      }

      return validated.data;
    } catch (error) {
      console.error("Company fit analysis failed:", error);
      return {
        companyFitScore: params.overallScore,
        companyFitAnalysis: "Could not perform company-fit analysis due to a service error.",
      };
    }
  }

  /**
   * Generates session overall summary, strengths, and weaknesses
   */
  static async generateSessionSummary(params: {
    roundType: string;
    difficulty: string;
    yearsOfExperience: number;
    overallScore: number;
    dimensionAverages: DimensionScores & { fluency: number };
    questionsAndAnswers: Array<{ questionText: string; answerTranscript: string; overallScore: number }>;
  }): Promise<{
    overallSummary: string;
    keyStrengths: string[];
    keyWeaknesses: string[];
    nextSessionFocus: string;
  }> {
    try {
      const { adapter } = await getActiveLLMProvider();
      const promptInput = {
        roundType: params.roundType,
        difficulty: params.difficulty,
        yearsOfExperience: params.yearsOfExperience,
        overallScore: params.overallScore,
        dimensionScoresJson: JSON.stringify(params.dimensionAverages),
        questionsAndAnswersJson: JSON.stringify(params.questionsAndAnswers),
      };

      const execPrompt = buildSessionExecutiveSummaryPrompt(promptInput);
      const swPrompt = buildSessionStrengthsWeaknessesPrompt(promptInput);
      const focusPrompt = buildSessionNextFocusPrompt(promptInput);

      const [execRes, swRes, focusRes] = await Promise.all([
        adapter.chat({
          model: adapter.maxContextTokens["gpt-4o"] ? "gpt-4o" : "default",
          messages: [
            { role: "system", content: "You are an elite technical interview coach." },
            { role: "user", content: execPrompt },
          ],
          temperature: 0.3,
        }),
        adapter.chat({
          model: adapter.maxContextTokens["gpt-4o"] ? "gpt-4o" : "default",
          messages: [
            { role: "system", content: "You are a professional technical interviewer. Output valid JSON only." },
            { role: "user", content: swPrompt },
          ],
          responseFormat: "json",
          temperature: 0.2,
        }),
        adapter.chat({
          model: adapter.maxContextTokens["gpt-4o"] ? "gpt-4o" : "default",
          messages: [
            { role: "system", content: "You are a world-class system engineering coach." },
            { role: "user", content: focusPrompt },
          ],
          temperature: 0.3,
        }),
      ]);

      const overallSummary = execRes.content.trim();
      const nextSessionFocus = focusRes.content.trim();

      const swCleaned = cleanJsonString(swRes.content);
      const swParsed = JSON.parse(swCleaned) as { keyStrengths?: string[]; keyWeaknesses?: string[] };

      return {
        overallSummary: overallSummary || "Completed interview simulation.",
        keyStrengths: swParsed.keyStrengths || ["Clear response delivery"],
        keyWeaknesses: swParsed.keyWeaknesses || ["Provide deeper architectural details"],
        nextSessionFocus: nextSessionFocus || "Continue practicing structured question techniques.",
      };
    } catch (error) {
      console.error("Multi-stage session summary generation failed:", error);
      return {
        overallSummary: "You have completed your interview simulation. Check individual answers for breakdown feedback.",
        keyStrengths: ["Completed all interview questions"],
        keyWeaknesses: ["Areas of improvement are listed under individual answers"],
        nextSessionFocus: "Focus on continuous practice and structured communication.",
      };
    }
  }
}
