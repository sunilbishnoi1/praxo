import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAccessPin } from "@/lib/access";
import { getDefaultUserId } from "@/features/llm";
import { getRoundType } from "@/features/session/round-registry";
import { ScoringService, aggregateAnswers, segmentRealtimeDialogue, type AnswerScores, type FluencyMetrics } from "@/features/scoring";
import { analyzeFluency } from "@/features/voice/fluency/analyzer";

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

    // Immediately persist the dialogue history in case the complex scoring pipeline crashes
    if (session.voiceConversationMode === "realtime" && Array.isArray(body.dialogue)) {
      await prisma.session.update({
        where: { id },
        data: { dialogueHistory: JSON.stringify(body.dialogue) }
      });
    }

    let summaryData = {
      questionsAnswered: 0,
      totalDurationMs,
      overallScore: 0,
    };

    // 2. Generate Report and Progress entry if session is completed and not already reported
    if (statusValue === "completed") {
      // For real-time mode sessions: use LLM-based dialogue segmentation
      if (session.voiceConversationMode === "realtime" && Array.isArray(body.dialogue) && body.dialogue.length > 0) {
        console.log(`[Realtime Scoring] Processing ${body.dialogue.length} dialogue turns...`);
        const dialogue = body.dialogue as Array<{ speaker: string; text: string }>;
        
        // Fetch all questions for this session
        const dbQuestions = await prisma.question.findMany({
          where: { sessionId: id },
          orderBy: { orderIndex: "asc" },
        });

        console.log(`[Realtime Scoring] Segmenting dialogue against ${dbQuestions.length} questions using LLM...`);
        
        // Use LLM-based dialogue segmentation instead of keyword overlap
        const segmentation = await segmentRealtimeDialogue(
          dialogue,
          dbQuestions.map(q => ({ id: q.id, text: q.text, orderIndex: q.orderIndex })),
          totalDurationMs
        );

        console.log(`[Realtime Scoring] Scoring ${segmentation.mappedAnswers.length} mapped candidate answers...`);

        // Score each mapped answer
        for (const mapped of segmentation.mappedAnswers) {
          const qObj = dbQuestions.find(q => q.id === mapped.questionId);
          if (!qObj) continue;

          // Skip if answer already exists
          const existingAns = await prisma.answer.findUnique({
            where: { questionId: mapped.questionId },
          });
          if (existingAns) continue;

          let expectedKeyPoints: string[] = [];
          try {
            if (qObj.expectedKeyPoints) {
              expectedKeyPoints = JSON.parse(qObj.expectedKeyPoints);
            }
          } catch {}

          // Compute fluency from actual transcript text
          // In realtime mode we don't have separate audio recordings, so we estimate
          // duration from the total interview time divided by answer count
          const fluency = analyzeFluency({
            transcript: mapped.candidateAnswer,
            audioDurationMs: mapped.estimatedDurationMs,
            silenceDurationsMs: [], // Not available in realtime mode
          });

          const scores = await ScoringService.scoreAnswer({
            questionText: qObj.text,
            answerTranscript: mapped.candidateAnswer,
            expectedKeyPoints,
            fluencyMetrics: {
              wordsPerMinute: fluency.wordsPerMinute,
              totalWords: fluency.totalWords,
              totalPauses: 0, // Not trackable in realtime mode
              longestPauseMs: 0,
              fillerWordCount: fluency.fillerWordCount,
              fillerWords: fluency.fillerWords,
              coherenceScore: 0,
              speakingTimeMs: mapped.estimatedDurationMs,
              silenceTimeMs: 0,
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

          await prisma.answer.create({
            data: {
              questionId: mapped.questionId,
              transcript: mapped.candidateAnswer,
              audioDurationMs: mapped.estimatedDurationMs,
              fluencyMetrics: JSON.stringify({ ...fluency, coherenceScore: scores.dimensions.coherence }),
              scores: JSON.stringify(scores),
            },
          });
        }
      }

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
            fillerFrequency: aggregated.fluencySummary.averageWpm > 0 && totalDurationMs > 1000
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

      // Fallback: If no answers could be scored (e.g., realtime segmentation failed completely),
      // generate a minimal report from raw dialogue so we never redirect to dashboard
      if (!reportId && session.voiceConversationMode === "realtime" && Array.isArray(body.dialogue) && body.dialogue.length > 0) {
        console.log("[Realtime Scoring] No scored answers available. Generating fallback report from raw dialogue...");
        const dialogue = body.dialogue as Array<{ speaker: string; text: string }>;
        const candidateText = dialogue.filter(t => t.speaker === "candidate").map(t => t.text).join(" ").trim();
        const interviewerText = dialogue.filter(t => t.speaker === "interviewer").map(t => t.text).join(" ").trim();

        // Generate a summary from the raw dialogue
        let fallbackSummary = "This interview session was completed using real-time voice mode. Detailed per-question scoring was not available for this session.";
        let fallbackStrengths = ["Completed the interview session"];
        let fallbackWeaknesses = ["Per-question analysis unavailable — try cascaded mode for detailed breakdown"];
        let fallbackFocus = "Practice structured responses for better per-question scoring.";
        let fallbackOverall = 50;

        if (candidateText.length > 20) {
          try {
            const summaryResult = await ScoringService.generateSessionSummary({
              roundType: getRoundType(session.roundType).name,
              difficulty: session.difficulty,
              yearsOfExperience: session.yearsOfExperience ?? 0,
              overallScore: 50,
              dimensionAverages: { relevance: 50, depth: 50, technicalAccuracy: 50, starStructure: 50, timeComplexity: 50, coherence: 50, fluency: 50 },
              questionsAndAnswers: [{
                questionText: "(Full interview dialogue)",
                answerTranscript: candidateText.slice(0, 3000),
                overallScore: 50,
              }],
            });
            fallbackSummary = summaryResult.overallSummary;
            fallbackStrengths = summaryResult.keyStrengths;
            fallbackWeaknesses = summaryResult.keyWeaknesses;
            fallbackFocus = summaryResult.nextSessionFocus;
          } catch (e) {
            console.error("[Realtime Scoring] Fallback summary generation failed:", e);
          }

          // Estimate a rough score from fluency of overall candidate text
          const roughFluency = analyzeFluency({
            transcript: candidateText,
            audioDurationMs: totalDurationMs > 0 ? totalDurationMs / 2 : 60000,
            silenceDurationsMs: [],
          });
          // Use WPM and word count as a rough proxy for engagement
          if (roughFluency.totalWords > 50) {
            fallbackOverall = Math.min(75, Math.max(35, Math.round(
              40 + (roughFluency.totalWords / 20) - (roughFluency.fillerWordCount * 2)
            )));
          }
        }

        try {
          const fallbackReport = await prisma.sessionReport.create({
            data: {
              sessionId: id,
              overallScore: fallbackOverall,
              roundTypeScore: fallbackOverall,
              dimensionAverages: JSON.stringify({ relevance: fallbackOverall, depth: fallbackOverall, technicalAccuracy: fallbackOverall, starStructure: fallbackOverall, timeComplexity: fallbackOverall, coherence: fallbackOverall, fluency: fallbackOverall }),
              fluencySummary: JSON.stringify({ averageWpm: 0, totalFillerWords: 0, totalPauses: 0, wpmTrend: [], fillerTrend: [] }),
              strongestAnswerIds: JSON.stringify([]),
              weakestAnswerIds: JSON.stringify([]),
              overallSummary: fallbackSummary,
              keyStrengths: JSON.stringify(fallbackStrengths),
              keyWeaknesses: JSON.stringify(fallbackWeaknesses),
              studyRecommendations: JSON.stringify([{ topic: "Interview Structure", resources: ["Practice with cascaded mode for detailed feedback"], priority: "medium" }]),
              nextSessionFocus: fallbackFocus,
            },
          });
          reportId = fallbackReport.id;
          summaryData = {
            questionsAnswered: 0,
            totalDurationMs,
            overallScore: fallbackOverall,
          };
          console.log(`[Realtime Scoring] Fallback report created: ${reportId}`);
        } catch (e) {
          console.error("[Realtime Scoring] Failed to create fallback report:", e);
        }
      }
    }

    // 3. Update Session
    const updatedSession = await prisma.session.update({
      where: { id },
      data: {
        status: statusValue,
        completedAt,
        totalDurationMs,
        dialogueHistory: Array.isArray(body.dialogue) ? JSON.stringify(body.dialogue) : null,
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
