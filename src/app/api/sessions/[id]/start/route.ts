import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAccessPin } from "@/lib/access";
import { getDefaultUserId } from "@/features/llm";
import { getRoundType } from "@/features/session";
import { analyzeGap, GapAnalysis } from "@/features/personalization";

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

    // 1. Fetch Session with Linked Inputs and Existing Questions
    const session = await prisma.session.findUnique({
      where: { id, userId, deletedAt: null },
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

    // 2. If already in progress, handle idempotently
    if (session.status === "in_progress" && session.questions.length > 0) {
      const firstQuestion = session.questions[0];
      let keyPoints: string[] = [];
      let relatedSkills: string[] = [];
      try {
        if (firstQuestion.expectedKeyPoints) keyPoints = JSON.parse(firstQuestion.expectedKeyPoints);
        if (firstQuestion.relatedSkills) relatedSkills = JSON.parse(firstQuestion.relatedSkills);
      } catch {
        // ignore
      }

      return NextResponse.json({
        success: true,
        data: {
          sessionId: session.id,
          status: session.status,
          firstQuestion: {
            id: firstQuestion.id,
            text: firstQuestion.text,
            questionType: firstQuestion.questionType,
            difficulty: firstQuestion.difficulty,
            orderIndex: 0,
            expectedKeyPoints: keyPoints,
            relatedSkills,
            dsaProblemType: firstQuestion.dsaProblemType,
            expectedTimeComplexity: firstQuestion.expectedTimeComplexity,
            expectedSpaceComplexity: firstQuestion.expectedSpaceComplexity,
          },
          wsEndpoint: `/api/voice/ws?sessionId=${session.id}`,
        },
      });
    }

    if (session.status !== "configuring") {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: `Cannot start a session in status: ${session.status}` } },
        { status: 400 }
      );
    }

    // 3. Setup Session Context for Question Generation
    let resumeSkills: string[] = [];
    let resumeExperience: any[] = [];
    let jdSkills: string[] = [];
    let gap: GapAnalysis | undefined = undefined;

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
    if (session.jobDescription?.parsedRequiredSkills) {
      try {
        jdSkills = JSON.parse(session.jobDescription.parsedRequiredSkills);
      } catch {
        // ignore
      }
    }
    if (session.gapAnalysis) {
      try {
        gap = JSON.parse(session.gapAnalysis);
      } catch {
        // ignore
      }
    }

    // Recompute gap analysis if it is missing but inputs are present
    if (!gap && (session.resume || session.jobDescription)) {
      let jdNice: string[] = [];
      if (session.jobDescription?.parsedNiceToHave) {
        try {
          jdNice = JSON.parse(session.jobDescription.parsedNiceToHave);
        } catch {
          // ignore
        }
      }
      gap = analyzeGap(resumeSkills, jdSkills, jdNice);
    }

    const context = {
      difficulty: session.difficulty,
      yearsOfExperience: session.yearsOfExperience ?? undefined,
      targetCompanyTier: session.targetCompanyTier ?? undefined,
      resumeSkills,
      resumeExperience,
      jobDescriptionSkills: jdSkills,
      gapAnalysis: gap,
    };

    // 4. Retrieve Round Type and Generate Tailored Questions
    const round = getRoundType(session.roundType);
    const generatedQuestions = await round.generateQuestions(context);
    const questionList = Array.isArray(generatedQuestions)
      ? generatedQuestions
      : [];

    if (questionList.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "GENERATION_ERROR", message: "Failed to generate interview questions." } },
        { status: 500 }
      );
    }

    // 5. Store Questions in Database
    const dbQuestionsData = questionList.map((q, index) => {
      // Map roundType to database questionType
      let mappedType = "technical";
      if (session.roundType === "dsa") mappedType = "dsa";
      else if (session.roundType === "behavioural") mappedType = "behavioural";
      else if (session.roundType === "oop-cs") mappedType = "technical";
      else if (session.roundType === "system-design") mappedType = "system_design";

      return {
        sessionId: session.id,
        text: q.questionText,
        questionType: mappedType,
        difficulty: q.difficulty,
        orderIndex: index,
        expectedKeyPoints: JSON.stringify(q.expectedKeyPoints),
        relatedSkills: JSON.stringify(q.relatedSkills),
        dsaProblemType: q.dsaProblemType || null,
        expectedTimeComplexity: q.expectedTimeComplexity || null,
        expectedSpaceComplexity: q.expectedSpaceComplexity || null,
      };
    });

    await prisma.question.createMany({
      data: dbQuestionsData,
    });

    // 6. Update Session State
    const updatedSession = await prisma.session.update({
      where: { id: session.id },
      data: {
        status: "in_progress",
        startedAt: new Date(),
        questionCount: dbQuestionsData.length,
        gapAnalysis: gap ? JSON.stringify(gap) : null,
      },
      include: {
        questions: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    const firstQ = updatedSession.questions[0];
    let keyPoints: string[] = [];
    let relatedSkills: string[] = [];
    try {
      if (firstQ.expectedKeyPoints) keyPoints = JSON.parse(firstQ.expectedKeyPoints);
      if (firstQ.relatedSkills) relatedSkills = JSON.parse(firstQ.relatedSkills);
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      data: {
        sessionId: updatedSession.id,
        status: updatedSession.status,
        firstQuestion: {
          id: firstQ.id,
          text: firstQ.text,
          questionType: firstQ.questionType,
          difficulty: firstQ.difficulty,
          orderIndex: 0,
          expectedKeyPoints: keyPoints,
          relatedSkills,
          dsaProblemType: firstQ.dsaProblemType,
          expectedTimeComplexity: firstQ.expectedTimeComplexity,
          expectedSpaceComplexity: firstQ.expectedSpaceComplexity,
        },
        wsEndpoint: `/api/voice/ws?sessionId=${updatedSession.id}`,
      },
    });
  } catch (error: any) {
    console.error("POST /api/sessions/[id]/start failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error.message || "Failed to start interview session",
        },
      },
      { status: 500 }
    );
  }
}
