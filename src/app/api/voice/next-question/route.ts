import { NextRequest, NextResponse } from "next/server";

import { verifyAccessPin } from "@/lib/access";
import { prisma } from "@/lib/db";
import { getDefaultUserId } from "@/features/llm";
import { getRoundType } from "@/features/session";
import type { SessionContext } from "@/features/session";

function parseJsonArray(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

function buildSessionContext(session: {
  difficulty: string;
  yearsOfExperience: number | null;
  targetCompanyTier: string | null;
  gapAnalysis: string | null;
  resume: { parsedSkills: string | null; parsedExperience: string | null } | null;
  jobDescription: { parsedRequiredSkills: string | null } | null;
}): SessionContext {
  return {
    difficulty: session.difficulty,
    yearsOfExperience: session.yearsOfExperience ?? undefined,
    targetCompanyTier: session.targetCompanyTier ?? undefined,
    resumeSkills: parseJsonArray(session.resume?.parsedSkills ?? null),
    resumeExperience: parseJsonArray(session.resume?.parsedExperience ?? null) as unknown[],
    jobDescriptionSkills: parseJsonArray(session.jobDescription?.parsedRequiredSkills ?? null),
    gapAnalysis: session.gapAnalysis ? JSON.parse(session.gapAnalysis) : undefined,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const access = await verifyAccessPin();
  if (!access.allowed) {
    return access.response as NextResponse;
  }

  try {
    const userId = await getDefaultUserId();
    const body = (await request.json()) as {
      sessionId?: string;
      questionId?: string;
      answerText?: string;
    };

    if (!body.sessionId || !body.questionId) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "sessionId and questionId are required." } },
        { status: 400 }
      );
    }

    const session = await prisma.session.findUnique({
      where: {
        id: body.sessionId,
        userId,
        deletedAt: null,
      },
      include: {
        resume: true,
        jobDescription: true,
        questions: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Session not found." } },
        { status: 404 }
      );
    }

    const questionIndex = session.questions.findIndex((question) => question.id === body.questionId);
    if (questionIndex < 0) {
      return NextResponse.json(
        { success: false, error: { code: "QUESTION_NOT_FOUND", message: "Question does not belong to this session." } },
        { status: 404 }
      );
    }

    const round = getRoundType(session.roundType);
    const context = buildSessionContext(session);

    const answerText = body.answerText?.trim() ?? "";
    const currentQuestion = session.questions[questionIndex];
    const nextQuestion = session.questions[questionIndex + 1] ?? null;
    const shouldAskFollowUp = answerText.split(/\s+/).filter(Boolean).length < 80 || /uncertain|maybe|probably|not sure/i.test(answerText);

    if (shouldAskFollowUp && answerText.length > 0) {
      const followUp = await round.generateFollowUp(answerText, currentQuestion.text, context);
      if (followUp) {
        const followUpQuestion = {
          id: `followup-${questionIndex}-${Date.now()}`,
          text: followUp.questionText,
          questionType: "follow_up",
          difficulty: followUp.difficulty,
          orderIndex: currentQuestion.orderIndex + 0.5,
          expectedKeyPoints: followUp.expectedKeyPoints,
          relatedSkills: followUp.relatedSkills,
          dsaProblemType: null,
          expectedTimeComplexity: null,
          expectedSpaceComplexity: null,
          answered: false,
        };

        return NextResponse.json({
          success: true,
          data: {
            completed: false,
            question: followUpQuestion,
            promptType: "follow_up",
          },
        });
      }
    }

    if (nextQuestion) {
      return NextResponse.json({
        success: true,
        data: {
          completed: false,
          question: {
            id: nextQuestion.id,
            text: nextQuestion.text,
            questionType: nextQuestion.questionType,
            difficulty: nextQuestion.difficulty,
            orderIndex: nextQuestion.orderIndex,
            expectedKeyPoints: parseJsonArray(nextQuestion.expectedKeyPoints),
            relatedSkills: parseJsonArray(nextQuestion.relatedSkills),
            dsaProblemType: nextQuestion.dsaProblemType,
            expectedTimeComplexity: nextQuestion.expectedTimeComplexity,
            expectedSpaceComplexity: nextQuestion.expectedSpaceComplexity,
            answered: false,
          },
          promptType: "next_question",
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        completed: true,
        reason: "No more questions remain in this session.",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to determine the next question.";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
