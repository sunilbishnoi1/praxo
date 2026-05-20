// src/app/api/sessions/[id]/end/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAccessPin } from "@/lib/access";
import { getDefaultUserId } from "@/features/llm";
import { getRoundType } from "@/features/session/round-registry";
import { ScoringService, aggregateAnswers, type AnswerScores, type FluencyMetrics } from "@/features/scoring";

export async function POST(
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
    const body = await request.json();
    const { reason } = body;

    const statusValue = reason === "abandoned" ? "abandoned" : "completed";

    // 1. Fetch existing session with resume and job description details
    const session = await prisma.session.findUnique({
      where: { id, userId, deletedAt: null },
      include: {
        resume: true,
        jobDescription: true,
        report: true,
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
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: `Cannot end a session in status: ${session.status}`,
          },
        },
        { status: 400 }
      );
    }

    const completedAt = new Date();
    let totalDurationMs = 0;
    if (session.startedAt) {
      totalDurationMs = completedAt.getTime() - session.startedAt.getTime();
    }

    let reportId: string | null = null;
    let summaryData = {
      questionsAnswered: 0,
      totalDurationMs,
      overallScore: 0,
    };

    // 2. Generate Report and Progress entry if session is completed and not already reported
    if (statusValue === "completed") {
      // Fetch all questions for this session with answers
      const questions = await prisma.question.findMany({
        where: { sessionId: id },
        include: { answer: true },
        orderBy: { orderIndex: "asc" },
      });

      const answered = questions.filter((q) => q.answer);

      if (answered.length > 0) {
        // Parse answers with scores
        const formattedAnswers = answered
          .map((q) => {
            let scoresData: AnswerScores | null = null;
            let fluencyData: FluencyMetrics | null = null;
            try {
              scoresData = q.answer?.scores ? JSON.parse(q.answer.scores) as AnswerScores : null;
            } catch {}
            try {
              fluencyData = q.answer?.fluencyMetrics
                ? JSON.parse(q.answer.fluencyMetrics) as FluencyMetrics
                : null;
            } catch {}

            return {
              id: q.id,
              scores: scoresData!,
              fluencyMetrics: fluencyData!,
            };
          })
          .filter((x) => x.scores && x.fluencyMetrics);

        const roundInstance = getRoundType(session.roundType);
        const weights = roundInstance.getScoringWeights();

        // Perform score aggregation
        const aggregated = aggregateAnswers(formattedAnswers, weights);

        // Perform LLM Company-Fit Analysis if JD is provided
        let fit = null;
        if (session.useJdForScoring && session.jobDescription) {
          let resumeSkills: string[] = [];
          if (session.resume?.parsedSkills) {
            try {
              resumeSkills = JSON.parse(session.resume.parsedSkills);
            } catch {}
          }

          // Flat list of strengths and weaknesses across all answers
          const strengths = formattedAnswers.flatMap((x) => x.scores.strengths || []);
          const improvements = formattedAnswers.flatMap((x) => x.scores.improvements || []);

          fit = await ScoringService.analyzeCompanyFit({
            jobDescriptionText: session.jobDescription.rawText,
            roundType: roundInstance.name,
            overallScore: aggregated.overallScore,
            dimensionScores: aggregated.dimensionAverages,
            strengths,
            weaknesses: improvements,
            resumeSkills,
            averageWpm: aggregated.fluencySummary.averageWpm,
            fillerFrequency: aggregated.fluencySummary.averageWpm > 0
              ? (aggregated.fluencySummary.totalFillerWords / (totalDurationMs / 60000))
              : 0,
            coherenceScore: aggregated.dimensionAverages.coherence,
          });
        }

        // Generate LLM Session Summary
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

        const summary = await ScoringService.generateSessionSummary({
          roundType: roundInstance.name,
          difficulty: session.difficulty,
          yearsOfExperience: session.yearsOfExperience ?? 0,
          overallScore: aggregated.overallScore,
          dimensionAverages: aggregated.dimensionAverages,
          questionsAndAnswers: qaData,
        });

        // Save report to database
        const createdReport = await prisma.sessionReport.create({
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
        });

        reportId = createdReport.id;
        summaryData = {
          questionsAnswered: answered.length,
          totalDurationMs,
          overallScore: aggregated.overallScore,
        };

        // Create ProgressEntry for historical analytics
        await prisma.progressEntry.create({
          data: {
            userId,
            sessionId: id,
            sessionDate: completedAt,
            roundType: session.roundType,
            difficulty: session.difficulty,
            overallScore: aggregated.overallScore,
            fluencyScore: aggregated.dimensionAverages.fluency,
            relevanceScore: aggregated.dimensionAverages.relevance,
            depthScore: aggregated.dimensionAverages.depth,
            technicalScore: aggregated.dimensionAverages.technicalAccuracy,
            coherenceScore: aggregated.dimensionAverages.coherence,
            averageWpm: aggregated.fluencySummary.averageWpm,
            fillerWordCount: aggregated.fluencySummary.totalFillerWords,
            pauseCount: aggregated.fluencySummary.totalPauses,
            questionCount: answered.length,
            durationMs: totalDurationMs,
          },
        });
      }
    }

    // 3. Update Session
    const updatedSession = await prisma.session.update({
      where: { id },
      data: {
        status: statusValue,
        completedAt,
        totalDurationMs,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        sessionId: updatedSession.id,
        status: updatedSession.status,
        reportId,
        summary: summaryData,
      },
    });
  } catch (error) {
    console.error("POST /api/sessions/[id]/end failed:", error);
    const message = error instanceof Error ? error.message : "Failed to end session";
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
