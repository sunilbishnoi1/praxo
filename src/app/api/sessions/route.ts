import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAccessPin } from "@/lib/access";
import { getDefaultUserId } from "@/features/llm";
import { analyzeGap } from "@/features/personalization";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const access = await verifyAccessPin();
  if (!access.allowed) {
    return access.response as NextResponse;
  }

  try {
    const userId = await getDefaultUserId();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const roundType = searchParams.get("roundType");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const skip = (page - 1) * limit;

    const whereClause: any = {
      userId,
      deletedAt: null,
    };

    if (status) {
      whereClause.status = status;
    }
    if (roundType) {
      whereClause.roundType = roundType;
    }

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where: whereClause,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          resume: {
            select: { id: true, name: true },
          },
          jobDescription: {
            select: { id: true, name: true },
          },
        },
        skip,
        take: limit,
      }),
      prisma.session.count({
        where: whereClause,
      }),
    ]);

    const formattedSessions = sessions.map((s) => {
      let gap = null;
      if (s.gapAnalysis) {
        try {
          gap = JSON.parse(s.gapAnalysis);
        } catch {
          // ignore
        }
      }

      return {
        id: s.id,
        status: s.status,
        roundType: s.roundType,
        difficulty: s.difficulty,
        yearsOfExperience: s.yearsOfExperience,
        targetCompanyTier: s.targetCompanyTier,
        targetSalaryRange: s.targetSalaryRange,
        resume: s.resume,
        jobDescription: s.jobDescription,
        gapAnalysis: gap,
        startedAt: s.startedAt?.toISOString() ?? null,
        completedAt: s.completedAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        sessions: formattedSessions,
        pagination: {
          page,
          limit,
          total,
        },
      },
    });
  } catch (error: any) {
    console.error("GET /api/sessions failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to list interview sessions",
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const access = await verifyAccessPin();
  if (!access.allowed) {
    return access.response as NextResponse;
  }

  try {
    const userId = await getDefaultUserId();
    const body = await request.json();

    const {
      roundType,
      difficulty,
      yearsOfExperience,
      targetCompanyTier,
      targetSalaryRange,
      resumeId,
      jobDescriptionId,
      llmProvider,
      sttProvider,
      ttsProvider,
    } = body;

    // Validation
    if (!roundType || roundType.trim() === "") {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "roundType is required." } },
        { status: 400 }
      );
    }
    if (!difficulty || difficulty.trim() === "") {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "difficulty is required." } },
        { status: 400 }
      );
    }
    if (!llmProvider || llmProvider.trim() === "") {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "llmProvider is required." } },
        { status: 400 }
      );
    }

    // Load referenced inputs
    let resume = null;
    let jd = null;

    if (resumeId) {
      resume = await prisma.resume.findUnique({
        where: { id: resumeId, userId, deletedAt: null },
      });
      if (!resume) {
        return NextResponse.json(
          { success: false, error: { code: "VALIDATION_ERROR", message: "Specified resume not found." } },
          { status: 400 }
        );
      }
    }

    if (jobDescriptionId) {
      jd = await prisma.jobDescription.findUnique({
        where: { id: jobDescriptionId, userId, deletedAt: null },
      });
      if (!jd) {
        return NextResponse.json(
          { success: false, error: { code: "VALIDATION_ERROR", message: "Specified job description not found." } },
          { status: 400 }
        );
      }
    }

    // Determine default LLM Model
    let selectedModel = "default";
    const providerConfig = await prisma.providerConfig.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: llmProvider,
        },
      },
    });
    if (providerConfig?.model) {
      selectedModel = providerConfig.model;
    }

    // Calculate initial gap analysis if inputs exist
    let gapAnalysisJson: string | null = null;
    if (resume || jd) {
      let resumeSkills: string[] = [];
      let jdRequired: string[] = [];
      let jdNiceToHave: string[] = [];

      if (resume?.parsedSkills) {
        try {
          resumeSkills = JSON.parse(resume.parsedSkills);
        } catch {
          // ignore
        }
      }
      if (jd?.parsedRequiredSkills) {
        try {
          jdRequired = JSON.parse(jd.parsedRequiredSkills);
        } catch {
          // ignore
        }
      }
      if (jd?.parsedNiceToHave) {
        try {
          jdNiceToHave = JSON.parse(jd.parsedNiceToHave);
        } catch {
          // ignore
        }
      }

      const gap = analyzeGap(resumeSkills, jdRequired, jdNiceToHave);
      gapAnalysisJson = JSON.stringify(gap);
    }

    // Create session in Database
    const session = await prisma.session.create({
      data: {
        userId,
        roundType,
        difficulty,
        yearsOfExperience: yearsOfExperience ? parseFloat(yearsOfExperience) : null,
        targetCompanyTier: targetCompanyTier || null,
        targetSalaryRange: targetSalaryRange || null,
        llmProvider,
        llmModel: selectedModel,
        sttProvider: sttProvider || "deepgram",
        ttsProvider: ttsProvider || "openai",
        resumeId: resumeId || null,
        jobDescriptionId: jobDescriptionId || null,
        gapAnalysis: gapAnalysisJson,
        status: "configuring",
      },
    });

    let parsedGap = null;
    if (gapAnalysisJson) {
      try {
        parsedGap = JSON.parse(gapAnalysisJson);
      } catch {
        // ignore
      }
    }

    return NextResponse.json(
      {
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
            gapAnalysis: parsedGap,
            createdAt: session.createdAt.toISOString(),
          },
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/sessions failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error.message || "Failed to create session",
        },
      },
      { status: 500 }
    );
  }
}
