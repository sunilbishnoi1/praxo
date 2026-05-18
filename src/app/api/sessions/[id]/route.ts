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

    const session = await prisma.session.findUnique({
      where: {
        id,
        userId,
        deletedAt: null,
      },
      include: {
        resume: true,
        jobDescription: true,
        questions: {
          orderBy: {
            orderIndex: "asc",
          },
          include: {
            answer: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Session not found",
          },
        },
        { status: 404 }
      );
    }

    let gap = null;
    if (session.gapAnalysis) {
      try {
        gap = JSON.parse(session.gapAnalysis);
      } catch {
        // ignore
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        session: {
          id: session.id,
          status: session.status,
          roundType: session.roundType,
          difficulty: session.difficulty,
          yearsOfExperience: session.yearsOfExperience,
          targetCompanyTier: session.targetCompanyTier,
          targetSalaryRange: session.targetSalaryRange,
          resume: session.resume ? { id: session.resume.id, name: session.resume.name } : null,
          jobDescription: session.jobDescription ? { id: session.jobDescription.id, name: session.jobDescription.name } : null,
          gapAnalysis: gap,
          startedAt: session.startedAt?.toISOString() ?? null,
          completedAt: session.completedAt?.toISOString() ?? null,
          createdAt: session.createdAt.toISOString(),
          questions: session.questions.map((q) => {
            let keyPoints: string[] = [];
            let relatedSkills: string[] = [];
            try {
              if (q.expectedKeyPoints) keyPoints = JSON.parse(q.expectedKeyPoints);
              if (q.relatedSkills) relatedSkills = JSON.parse(q.relatedSkills);
            } catch {
              // ignore
            }

            return {
              id: q.id,
              text: q.text,
              questionType: q.questionType,
              difficulty: q.difficulty,
              orderIndex: q.orderIndex,
              expectedKeyPoints: keyPoints,
              relatedSkills,
              dsaProblemType: q.dsaProblemType,
              expectedTimeComplexity: q.expectedTimeComplexity,
              expectedSpaceComplexity: q.expectedSpaceComplexity,
              answered: !!q.answer,
            };
          }),
        },
      },
    });
  } catch (error: any) {
    console.error("GET /api/sessions/[id] failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch session",
        },
      },
      { status: 500 }
    );
  }
}
