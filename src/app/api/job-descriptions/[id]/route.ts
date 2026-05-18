import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAccessPin } from "@/lib/access";
import { getDefaultUserId } from "@/features/llm";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const access = await verifyAccessPin();
  if (!access.allowed) {
    return access.response as NextResponse;
  }

  try {
    const userId = await getDefaultUserId();
    const { id } = await params;

    const jd = await prisma.jobDescription.findUnique({
      where: {
        id,
      },
    });

    if (!jd || jd.userId !== userId || jd.deletedAt !== null) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Job description not found.",
          },
        },
        { status: 404 }
      );
    }

    let parsedRequiredSkills: string[] = [];
    let parsedNiceToHave: string[] = [];
    let parsedKeywords: string[] = [];

    try {
      if (jd.parsedRequiredSkills) parsedRequiredSkills = JSON.parse(jd.parsedRequiredSkills);
      if (jd.parsedNiceToHave) parsedNiceToHave = JSON.parse(jd.parsedNiceToHave);
      if (jd.parsedKeywords) parsedKeywords = JSON.parse(jd.parsedKeywords);
    } catch (e) {
      console.error("Failed to parse JD JSON fields:", e);
    }

    return NextResponse.json({
      success: true,
      data: {
        jobDescription: {
          id: jd.id,
          name: jd.name,
          rawText: jd.rawText,
          sourceUrl: jd.sourceUrl,
          parsedRequiredSkills,
          parsedNiceToHave,
          parsedKeywords,
          parsedRoleLevel: jd.parsedRoleLevel,
          parsedCompanyName: jd.parsedCompanyName,
          parsedCompanyTier: jd.parsedCompanyTier,
          createdAt: jd.createdAt.toISOString(),
        },
      },
    });
  } catch (error: any) {
    console.error("GET /api/job-descriptions/[id] failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch job description details",
        },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const access = await verifyAccessPin();
  if (!access.allowed) {
    return access.response as NextResponse;
  }

  try {
    const userId = await getDefaultUserId();
    const { id } = await params;

    const jd = await prisma.jobDescription.findUnique({
      where: { id },
    });

    if (!jd || jd.userId !== userId || jd.deletedAt !== null) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Job description not found.",
          },
        },
        { status: 404 }
      );
    }

    // Soft delete
    await prisma.jobDescription.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      data: {
        message: "Job description deleted successfully.",
      },
    });
  } catch (error: any) {
    console.error("DELETE /api/job-descriptions/[id] failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to delete job description",
        },
      },
      { status: 500 }
    );
  }
}
