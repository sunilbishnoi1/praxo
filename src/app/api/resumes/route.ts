import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAccessPin } from "@/lib/access";
import { parseResume, extractTextFromPdf } from "@/features/personalization";
import { getDefaultUserId } from "@/features/llm";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const access = await verifyAccessPin();
  if (!access.allowed) {
    return access.response as NextResponse;
  }

  try {
    const userId = await getDefaultUserId();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const skip = (page - 1) * limit;

    const [resumes, total] = await Promise.all([
      prisma.resume.findMany({
        where: {
          userId,
          deletedAt: null,
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.resume.count({
        where: {
          userId,
          deletedAt: null,
        },
      }),
    ]);

    const formattedResumes = resumes.map((resume) => {
      let skills: string[] = [];
      try {
        if (resume.parsedSkills) {
          skills = JSON.parse(resume.parsedSkills);
        }
      } catch (e) {
        console.error("Failed to parse resume skills JSON", e);
      }

      return {
        id: resume.id,
        name: resume.name,
        experienceLevel: resume.experienceLevel,
        parsedSkills: skills,
        createdAt: resume.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        resumes: formattedResumes,
        pagination: {
          page,
          limit,
          total,
        },
      },
    });
  } catch (error: any) {
    console.error("GET /api/resumes failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to list resumes",
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
    const contentType = request.headers.get("content-type") || "";

    let name = "";
    let rawText = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const textVal = formData.get("text") as string | null;
      const nameVal = formData.get("name") as string | null;

      if (!nameVal || nameVal.trim() === "") {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Resume name is required.",
            },
          },
          { status: 400 }
        );
      }
      name = nameVal.trim();

      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: "VALIDATION_ERROR",
                message: "File size exceeds maximum limit of 5MB.",
              },
            },
            { status: 400 }
          );
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        try {
          rawText = await extractTextFromPdf(buffer);
        } catch (err: any) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: "PARSE_FAILED",
                message: err.message || "Could not extract text from PDF",
              },
            },
            { status: 422 }
          );
        }
      } else if (textVal && textVal.trim() !== "") {
        rawText = textVal;
      } else {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Either a PDF file or plain text resume must be provided.",
            },
          },
          { status: 400 }
        );
      }
    } else {
      // JSON request fallback
      const body = await request.json();
      if (!body.name || body.name.trim() === "") {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Resume name is required.",
            },
          },
          { status: 400 }
        );
      }
      if (!body.text || body.text.trim() === "") {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Resume text content is required.",
            },
          },
          { status: 400 }
        );
      }
      name = body.name.trim();
      rawText = body.text;
    }

    // Invoke LLM Parser
    const parsed = await parseResume(rawText);

    // Save to Database
    const resume = await prisma.resume.create({
      data: {
        userId,
        name,
        rawText,
        parsedSkills: JSON.stringify(parsed.skills),
        parsedExperience: JSON.stringify(parsed.experience),
        parsedEducation: JSON.stringify(parsed.education),
        parsedProjects: JSON.stringify(parsed.projects),
        experienceLevel: parsed.experienceLevel,
        yearsOfExperience: parsed.yearsOfExperience,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          resume: {
            id: resume.id,
            name: resume.name,
            parsedSkills: parsed.skills,
            experienceLevel: resume.experienceLevel,
            yearsOfExperience: resume.yearsOfExperience,
            parsedExperience: parsed.experience,
            parsedEducation: parsed.education,
            parsedProjects: parsed.projects,
            createdAt: resume.createdAt.toISOString(),
          },
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/resumes failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error.message || "Failed to process and parse resume",
        },
      },
      { status: 500 }
    );
  }
}
