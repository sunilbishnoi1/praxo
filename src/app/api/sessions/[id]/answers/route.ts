// src/app/api/sessions/[id]/answers/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyAccessPin } from "@/lib/access";
import { getDefaultUserId } from "@/features/llm";
import { getRoundType } from "@/features/session/round-registry";
import { ScoringService } from "@/features/scoring";

const submitAnswerSchema = z.object({
  questionId: z.string().min(1),
  transcript: z.string().min(1),
  audioDurationMs: z.number().optional(),
  fluencyMetrics: z.object({
    wordsPerMinute: z.number(),
    totalWords: z.number(),
    totalPauses: z.number(),
    longestPauseMs: z.number(),
    fillerWordCount: z.number(),
    fillerWords: z.array(
      z.object({
        word: z.string(),
        count: z.number(),
      })
    ),
    speakingTimeMs: z.number(),
    silenceTimeMs: z.number(),
  }),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const access = await verifyAccessPin();
  if (!access.allowed) {
    return access.response as NextResponse;
  }

  try {
    const { id: sessionId } = await params;
    const userId = await getDefaultUserId();

    // 1. Validate Input
    const body = await request.json();
    const validated = submitAnswerSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Request payload validation failed",
            details: validated.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const { questionId, transcript, audioDurationMs, fluencyMetrics } = validated.data;

    // 2. Fetch Session including linked inputs & all questions with their answers
    const session = await prisma.session.findUnique({
      where: { id: sessionId, userId, deletedAt: null },
      include: {
        resume: true,
        jobDescription: true,
        questions: {
          orderBy: { orderIndex: "asc" },
          include: { answer: true },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Session not found." } },
        { status: 404 }
      );
    }

    if (session.status !== "in_progress") {
      return NextResponse.json(
        { success: false, error: { code: "SESSION_NOT_IN_PROGRESS", message: "Session is not in progress." } },
        { status: 400 }
      );
    }

    // 3. Find target question
    const targetQuestion = session.questions.find((q) => q.id === questionId);
    if (!targetQuestion) {
      return NextResponse.json(
        { success: false, error: { code: "QUESTION_NOT_FOUND", message: "Question does not belong to this session." } },
        { status: 404 }
      );
    }

    // 4. Prevent duplicate answers
    if (targetQuestion.answer) {
      return NextResponse.json(
        { success: false, error: { code: "QUESTION_ALREADY_ANSWERED", message: "This question has already been answered." } },
        { status: 400 }
      );
    }

    // Parse question properties
    let expectedKeyPoints: string[] = [];
    try {
      if (targetQuestion.expectedKeyPoints) {
        expectedKeyPoints = JSON.parse(targetQuestion.expectedKeyPoints);
      }
    } catch {
      expectedKeyPoints = [];
    }

    let resumeSkills: string[] = [];
    let resumeExperience: unknown[] = [];
    if (session.resume?.parsedSkills) {
      try {
        resumeSkills = JSON.parse(session.resume.parsedSkills);
      } catch {
        // ignore
      }
    }
    if (session.resume?.parsedExperience) {
      try {
        resumeExperience = JSON.parse(session.resume.parsedExperience);
      } catch {
        // ignore
      }
    }

    let jdSkills: string[] = [];
    if (session.jobDescription?.parsedRequiredSkills) {
      try {
        jdSkills = JSON.parse(session.jobDescription.parsedRequiredSkills);
      } catch {
        // ignore
      }
    }

    let gapAnalysis = undefined;
    if (session.gapAnalysis) {
      try {
        gapAnalysis = JSON.parse(session.gapAnalysis);
      } catch {
        // ignore
      }
    }

    // 5. Evaluate the answer
    const scores = await ScoringService.scoreAnswer({
      questionText: targetQuestion.text,
      answerTranscript: transcript,
      expectedKeyPoints,
      fluencyMetrics: {
        wordsPerMinute: fluencyMetrics.wordsPerMinute,
        totalWords: fluencyMetrics.totalWords,
        totalPauses: fluencyMetrics.totalPauses,
        longestPauseMs: fluencyMetrics.longestPauseMs,
        fillerWordCount: fluencyMetrics.fillerWordCount,
        fillerWords: fluencyMetrics.fillerWords,
        coherenceScore: 0,
        speakingTimeMs: fluencyMetrics.speakingTimeMs,
        silenceTimeMs: fluencyMetrics.silenceTimeMs,
      },
      roundType: session.roundType,
      difficulty: session.difficulty,
      yearsOfExperience: session.yearsOfExperience ?? 0,
      useJdForScoring: session.useJdForScoring,
      jobDescriptionText: session.jobDescription?.rawText ?? "",
      generateIdeal: session.generateIdealAnswer,
      resumeContext: session.resume?.rawText ?? "",
      jdContext: session.jobDescription?.rawText ?? "",
      companyTier: session.targetCompanyTier ?? "general",
    });

    // Save actual computed coherence score in fluency metrics
    const updatedFluencyMetrics = {
      ...fluencyMetrics,
      coherenceScore: scores.dimensions.coherence,
    };

    // 6. Save answer
    const answer = await prisma.answer.create({
      data: {
        questionId,
        transcript,
        audioDurationMs: audioDurationMs || null,
        fluencyMetrics: JSON.stringify(updatedFluencyMetrics),
        scores: JSON.stringify(scores),
      },
    });

    // 7. Find or generate Next Question
    let nextQuestionPayload = null;

    // Determine if we should generate a dynamic follow-up question
    const roundInstance = getRoundType(session.roundType);
    let followUp = null;

    // Follow-up condition: Overall score < 70, and it's a phase 1 or support round, and we haven't asked too many questions
    if (scores.overall < 70) {
      const context = {
        difficulty: session.difficulty,
        yearsOfExperience: session.yearsOfExperience ?? undefined,
        targetCompanyTier: session.targetCompanyTier ?? undefined,
        resumeSkills,
        resumeExperience,
        jobDescriptionSkills: jdSkills,
        gapAnalysis,
      };

      followUp = await roundInstance.generateFollowUp(transcript, targetQuestion.text, context);
    }

    if (followUp && followUp.questionText) {
      // Shift orderIndexes of subsequent unanswered questions
      await prisma.question.updateMany({
        where: {
          sessionId,
          orderIndex: { gt: targetQuestion.orderIndex },
        },
        data: {
          orderIndex: { increment: 1 },
        },
      });

      // Insert follow-up question
      let dbQuestionType = "technical";
      if (session.roundType === "dsa") dbQuestionType = "dsa";
      else if (session.roundType === "behavioural") dbQuestionType = "behavioural";
      else if (session.roundType === "oop-cs") dbQuestionType = "technical";
      else if (session.roundType === "system-design") dbQuestionType = "system_design";

      const createdFollowUp = await prisma.question.create({
        data: {
          sessionId,
          text: followUp.questionText,
          questionType: dbQuestionType,
          difficulty: followUp.difficulty || "medium",
          orderIndex: targetQuestion.orderIndex + 1,
          expectedKeyPoints: JSON.stringify(followUp.expectedKeyPoints || []),
          relatedSkills: JSON.stringify(followUp.relatedSkills || []),
          dsaProblemType: followUp.dsaProblemType || null,
          expectedTimeComplexity: followUp.expectedTimeComplexity || null,
          expectedSpaceComplexity: followUp.expectedSpaceComplexity || null,
        },
      });

      // Increment total session questionCount
      await prisma.session.update({
        where: { id: sessionId },
        data: { questionCount: { increment: 1 } },
      });

      nextQuestionPayload = {
        id: createdFollowUp.id,
        text: createdFollowUp.text,
        questionType: createdFollowUp.questionType,
        difficulty: createdFollowUp.difficulty,
        orderIndex: createdFollowUp.orderIndex,
      };
    } else {
      // Find the next planned question by orderIndex
      const nextPlanned = session.questions.find(
        (q) => q.orderIndex > targetQuestion.orderIndex && !q.answer
      );

      if (nextPlanned) {
        nextQuestionPayload = {
          id: nextPlanned.id,
          text: nextPlanned.text,
          questionType: nextPlanned.questionType,
          difficulty: nextPlanned.difficulty,
          orderIndex: nextPlanned.orderIndex,
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        answer: {
          id: answer.id,
          scores,
        },
        nextQuestion: nextQuestionPayload,
      },
    });
  } catch (error) {
    console.error("POST /api/sessions/[id]/answers failed:", error);
    const message = error instanceof Error ? error.message : "Failed to process answer and scoring";
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
