import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { verifyAccessPin } from "@/lib/access";
import { getDefaultUserId } from "@/features/llm";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const access = await verifyAccessPin();
  if (!access.allowed) {
    return access.response as NextResponse;
  }

  try {
    const userId = await getDefaultUserId();
    const { searchParams } = new URL(request.url);
    const roundType = searchParams.get("roundType");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const skip = (page - 1) * limit;

    const whereClause: Prisma.SessionReportWhereInput = {
      session: {
        userId,
        deletedAt: null,
        ...(roundType ? { roundType } : {}),
      },
    };

    const [reports, total] = await Promise.all([
      prisma.sessionReport.findMany({
        where: whereClause,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          session: {
            include: {
              resume: {
                select: { id: true, name: true },
              },
              jobDescription: {
                select: { id: true, name: true },
              },
            },
          },
        },
        skip,
        take: limit,
      }),
      prisma.sessionReport.count({
        where: whereClause,
      }),
    ]);

    const formattedReports = reports.map((r) => {
      let dimensionAverages = {};
      let fluencySummary = {};
      let keyStrengths: string[] = [];
      let keyWeaknesses: string[] = [];

      try {
        if (r.dimensionAverages) dimensionAverages = JSON.parse(r.dimensionAverages);
      } catch {}
      try {
        if (r.fluencySummary) fluencySummary = JSON.parse(r.fluencySummary);
      } catch {}
      try {
        if (r.keyStrengths) keyStrengths = JSON.parse(r.keyStrengths);
      } catch {}
      try {
        if (r.keyWeaknesses) keyWeaknesses = JSON.parse(r.keyWeaknesses);
      } catch {}

      return {
        id: r.id,
        sessionId: r.sessionId,
        overallScore: r.overallScore,
        roundTypeScore: r.roundTypeScore,
        dimensionAverages,
        fluencySummary,
        companyFitScore: r.companyFitScore,
        overallSummary: r.overallSummary,
        keyStrengths,
        keyWeaknesses,
        createdAt: r.createdAt.toISOString(),
        session: {
          id: r.session.id,
          roundType: r.session.roundType,
          difficulty: r.session.difficulty,
          questionCount: r.session.questionCount,
          totalDurationMs: r.session.totalDurationMs,
          resume: r.session.resume,
          jobDescription: r.session.jobDescription,
        },
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        reports: formattedReports,
        pagination: {
          page,
          limit,
          total,
        },
      },
    });
  } catch (error) {
    console.error("GET /api/reports failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to list session reports",
        },
      },
      { status: 500 }
    );
  }
}
