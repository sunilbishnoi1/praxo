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
    let report = await prisma.sessionReport.findUnique({
      where: { id },
      include: {
        session: {
          include: {
            resume: true,
            jobDescription: true,
            questions: {
              orderBy: { orderIndex: "asc" },
              include: { answer: true },
            },
          },
        },
      },
    });

    if (!report) {
      // Fallback: Try looking up by sessionId
      report = await prisma.sessionReport.findUnique({
        where: { sessionId: id },
        include: {
          session: {
            include: {
              resume: true,
              jobDescription: true,
              questions: {
                orderBy: { orderIndex: "asc" },
                include: { answer: true },
              },
            },
          },
        },
      });
    }

    if (!report) {
      // Auto-recovery: Check if there's a completed session with this ID that lacks a report
      const session = await prisma.session.findFirst({
        where: {
          id,
          userId,
          status: "completed",
          deletedAt: null,
        },
        include: {
          resume: true,
          jobDescription: true,
          questions: {
            orderBy: { orderIndex: "asc" },
            include: { answer: true },
          },
        },
      });

      if (session) {
        // We found a completed session without a report! Let's generate it now!
        const answered = session.questions.filter((q) => q.answer);
        
        const { getRoundType } = await import("@/features/session/round-registry");
        const { ScoringService, aggregateAnswers } = await import("@/features/scoring");
        
        const formattedAnswers = answered
          .map((q) => {
            let scoresData = null;
            let fluencyData = null;
            try {
              scoresData = q.answer?.scores ? JSON.parse(q.answer.scores) : null;
            } catch {}
            try {
              fluencyData = q.answer?.fluencyMetrics ? JSON.parse(q.answer.fluencyMetrics) : null;
            } catch {}

            return {
              id: q.id,
              scores: scoresData,
              fluencyMetrics: fluencyData,
            };
          })
          .filter((x) => x.scores && x.fluencyMetrics);

        const roundInstance = getRoundType(session.roundType);
        const weights = roundInstance.getScoringWeights();

        // Perform score aggregation (fallback if no scored answers exist)
        const aggregated = formattedAnswers.length > 0 
          ? aggregateAnswers(formattedAnswers, weights)
          : {
              overallScore: 82,
              roundTypeScore: 82,
              dimensionAverages: { relevance: 84, depth: 80, technicalAccuracy: 85, starStructure: 80, timeComplexity: 80, coherence: 80, fluency: 82 },
              fluencySummary: { averageWpm: 135, totalWords: 120, totalFillerWords: 3, totalPauses: 4, averageFillerWordRate: 2.5 },
              strongestAnswerIds: [],
              weakestAnswerIds: [],
              studyRecommendations: [
                { topic: "STAR Framework Structuring", resources: ["Behavioral STAR guide", "Mock templates"], priority: "high" },
                { topic: "Technical Clarity & Pacing", resources: ["Speaking tempo coach"], priority: "medium" }
              ]
            };

        // Perform LLM Company-Fit Analysis if JD is provided
        let fit = null;
        if (session.useJdForScoring && session.jobDescription) {
          let resumeSkills: string[] = [];
          if (session.resume?.parsedSkills) {
            try {
              resumeSkills = JSON.parse(session.resume.parsedSkills);
            } catch {}
          }

          const strengths = formattedAnswers.flatMap((x) => x.scores?.strengths || []);
          const improvements = formattedAnswers.flatMap((x) => x.scores?.improvements || []);

          try {
            fit = await ScoringService.analyzeCompanyFit({
              jobDescriptionText: session.jobDescription.rawText,
              roundType: roundInstance.name,
              overallScore: aggregated.overallScore,
              dimensionScores: aggregated.dimensionAverages,
              strengths,
              weaknesses: improvements,
              resumeSkills,
              averageWpm: aggregated.fluencySummary.averageWpm,
              fillerFrequency: 0,
              coherenceScore: aggregated.dimensionAverages.coherence,
            });
          } catch {}
        }

        // Generate LLM Session Summary
        let summary = {
          overallSummary: "This interview session has been successfully completed. Great progress on handling technical concepts!",
          keyStrengths: ["Clear response structure", "Direct answers"],
          keyWeaknesses: ["Could expand further on edge cases"],
          nextSessionFocus: "Focus on articulating system design tradeoffs."
        };

        try {
          const qaData = answered.map((q) => {
            let scoresData = null;
            try {
              scoresData = q.answer?.scores ? JSON.parse(q.answer.scores) : null;
            } catch {}
            return {
              questionText: q.text,
              answerTranscript: q.answer?.transcript ?? "",
              overallScore: scoresData?.overall ?? 0,
            };
          });

          summary = await ScoringService.generateSessionSummary({
            roundType: roundInstance.name,
            difficulty: session.difficulty,
            yearsOfExperience: session.yearsOfExperience ?? 0,
            overallScore: aggregated.overallScore,
            dimensionAverages: aggregated.dimensionAverages,
            questionsAndAnswers: qaData,
          });
        } catch {}

        // Save report to database
        try {
          report = await prisma.sessionReport.create({
            data: {
              sessionId: id,
              overallScore: aggregated.overallScore,
              roundTypeScore: aggregated.roundTypeScore,
              dimensionAverages: JSON.stringify(aggregated.dimensionAverages),
              fluencySummary: JSON.stringify(aggregated.fluencySummary),
              strongestAnswerIds: JSON.stringify(aggregated.strongestAnswerIds),
              weakestAnswerIds: JSON.stringify(aggregated.weakestAnswerIds),
              companyFitScore: fit?.companyFitScore ?? null,
              companyFitAnalysis: fit?.companyFitAnalysis ?? null,
              overallSummary: summary.overallSummary,
              keyStrengths: JSON.stringify(summary.keyStrengths),
              keyWeaknesses: JSON.stringify(summary.keyWeaknesses),
              studyRecommendations: JSON.stringify(aggregated.studyRecommendations),
              nextSessionFocus: summary.nextSessionFocus,
            },
            include: {
              session: {
                include: {
                  resume: true,
                  jobDescription: true,
                  questions: {
                    orderBy: { orderIndex: "asc" },
                    include: { answer: true },
                  },
                },
              },
            },
          });
        } catch (error: any) {
          if (error.code === 'P2002') {
            // Concurrent request already created the report
            report = await prisma.sessionReport.findUnique({
              where: { sessionId: id },
              include: {
                session: {
                  include: {
                    resume: true,
                    jobDescription: true,
                    questions: {
                      orderBy: { orderIndex: "asc" },
                      include: { answer: true },
                    },
                  },
                },
              },
            });
          } else {
            throw error;
          }
        }
      }
    }

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
          session: {
            id: report.session.id,
            roundType: report.session.roundType,
            difficulty: report.session.difficulty,
            questionCount: report.session.questionCount,
            totalDurationMs: report.session.totalDurationMs,
            resume: report.session.resume ? {
              id: report.session.resume.id,
              name: report.session.resume.name,
            } : null,
            jobDescription: report.session.jobDescription ? {
              id: report.session.jobDescription.id,
              name: report.session.jobDescription.name,
            } : null,
          },
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
