// src/app/api/reports/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAccessPin } from "@/lib/access";
import { getDefaultUserId } from "@/features/llm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const access = await verifyAccessPin();
  if (!access.allowed) {
    return access.response as NextResponse;
  }

  try {
    const { id } = await params;
    const userId = await getDefaultUserId();

    // Fetch report by ID and ensure it belongs to the active user
    const report = await prisma.sessionReport.findUnique({
      where: { id },
      include: {
        session: {
          include: {
            questions: {
              orderBy: { orderIndex: "asc" },
              include: { answer: true },
            },
          },
        },
      },
    });

    if (!report || report.session.userId !== userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Report not found",
          },
        },
        { status: 404 }
      );
    }

    // Parse stringified fields
    let dimensionAverages = {};
    let fluencySummary = {};
    let strongestAnswerIds: string[] = [];
    let weakestAnswerIds: string[] = [];
    let keyStrengths: string[] = [];
    let keyWeaknesses: string[] = [];
    let studyRecommendations = [];

    try {
      if (report.dimensionAverages) dimensionAverages = JSON.parse(report.dimensionAverages);
    } catch {}
    try {
      if (report.fluencySummary) fluencySummary = JSON.parse(report.fluencySummary);
    } catch {}
    try {
      if (report.strongestAnswerIds) strongestAnswerIds = JSON.parse(report.strongestAnswerIds);
    } catch {}
    try {
      if (report.weakestAnswerIds) weakestAnswerIds = JSON.parse(report.weakestAnswerIds);
    } catch {}
    try {
      if (report.keyStrengths) keyStrengths = JSON.parse(report.keyStrengths);
    } catch {}
    try {
      if (report.keyWeaknesses) keyWeaknesses = JSON.parse(report.keyWeaknesses);
    } catch {}
    try {
      if (report.studyRecommendations) studyRecommendations = JSON.parse(report.studyRecommendations);
    } catch {}

    const questionsPayload = report.session.questions.map((q) => {
      let expectedKeyPoints: string[] = [];
      let relatedSkills: string[] = [];
      let answerPayload = null;

      try {
        if (q.expectedKeyPoints) expectedKeyPoints = JSON.parse(q.expectedKeyPoints);
      } catch {}
      try {
        if (q.relatedSkills) relatedSkills = JSON.parse(q.relatedSkills);
      } catch {}

      if (q.answer) {
        let fluencyMetrics = null;
        let scores = null;

        try {
          if (q.answer.fluencyMetrics) fluencyMetrics = JSON.parse(q.answer.fluencyMetrics);
        } catch {}
        try {
          if (q.answer.scores) scores = JSON.parse(q.answer.scores);
        } catch {}

        answerPayload = {
          id: q.answer.id,
          transcript: q.answer.transcript,
          audioDurationMs: q.answer.audioDurationMs,
          fluencyMetrics,
          scores,
          createdAt: q.answer.createdAt.toISOString(),
        };
      }

      return {
        id: q.id,
        text: q.text,
        questionType: q.questionType,
        difficulty: q.difficulty,
        orderIndex: q.orderIndex,
        expectedKeyPoints,
        relatedSkills,
        dsaProblemType: q.dsaProblemType,
        expectedTimeComplexity: q.expectedTimeComplexity,
        expectedSpaceComplexity: q.expectedSpaceComplexity,
        answer: answerPayload,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        report: {
          id: report.id,
          sessionId: report.sessionId,
          overallScore: report.overallScore,
          roundTypeScore: report.roundTypeScore,
          dimensionAverages,
          fluencySummary,
          strongestAnswerIds,
          weakestAnswerIds,
          companyFitScore: report.companyFitScore,
          companyFitAnalysis: report.companyFitAnalysis,
          overallSummary: report.overallSummary,
          keyStrengths,
          keyWeaknesses,
          studyRecommendations,
          nextSessionFocus: report.nextSessionFocus,
          questions: questionsPayload,
          createdAt: report.createdAt.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("GET /api/reports/[id] failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch session report",
        },
      },
      { status: 500 }
    );
  }
}
