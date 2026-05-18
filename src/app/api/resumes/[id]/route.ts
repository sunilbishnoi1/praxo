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

    const resume = await prisma.resume.findUnique({
      where: {
        id,
      },
    });

    if (!resume || resume.userId !== userId || resume.deletedAt !== null) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Resume not found.",
          },
        },
        { status: 404 }
      );
    }

    let parsedSkills: string[] = [];
    let parsedExperience: any[] = [];
    let parsedEducation: any[] = [];
    let parsedProjects: any[] = [];

    try {
      if (resume.parsedSkills) parsedSkills = JSON.parse(resume.parsedSkills);
      if (resume.parsedExperience) parsedExperience = JSON.parse(resume.parsedExperience);
      if (resume.parsedEducation) parsedEducation = JSON.parse(resume.parsedEducation);
      if (resume.parsedProjects) parsedProjects = JSON.parse(resume.parsedProjects);
    } catch (e) {
      console.error("Failed to parse resume JSON fields:", e);
    }

    return NextResponse.json({
      success: true,
      data: {
        resume: {
          id: resume.id,
          name: resume.name,
          rawText: resume.rawText,
          parsedSkills,
          parsedExperience,
          parsedEducation,
          parsedProjects,
          experienceLevel: resume.experienceLevel,
          yearsOfExperience: resume.yearsOfExperience,
          createdAt: resume.createdAt.toISOString(),
        },
      },
    });
  } catch (error: any) {
    console.error("GET /api/resumes/[id] failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch resume details",
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

    const resume = await prisma.resume.findUnique({
      where: { id },
    });

    if (!resume || resume.userId !== userId || resume.deletedAt !== null) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Resume not found.",
          },
        },
        { status: 404 }
      );
    }

    // Soft delete
    await prisma.resume.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      data: {
        message: "Resume deleted successfully.",
      },
    });
  } catch (error: any) {
    console.error("DELETE /api/resumes/[id] failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to delete resume",
        },
      },
      { status: 500 }
    );
  }
}
