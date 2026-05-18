import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAccessPin } from "@/lib/access";
import { parseJobDescription } from "@/features/personalization";
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

    const [jds, total] = await Promise.all([
      prisma.jobDescription.findMany({
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
      prisma.jobDescription.count({
        where: {
          userId,
          deletedAt: null,
        },
      }),
    ]);

    const formattedJds = jds.map((jd) => {
      let requiredSkills: string[] = [];
      let niceToHave: string[] = [];
      try {
        if (jd.parsedRequiredSkills) requiredSkills = JSON.parse(jd.parsedRequiredSkills);
        if (jd.parsedNiceToHave) niceToHave = JSON.parse(jd.parsedNiceToHave);
      } catch (e) {
        console.error("Failed to parse JD skills JSON", e);
      }

      return {
        id: jd.id,
        name: jd.name,
        companyName: jd.parsedCompanyName,
        companyTier: jd.parsedCompanyTier,
        roleLevel: jd.parsedRoleLevel,
        parsedRequiredSkills: requiredSkills,
        parsedNiceToHave: niceToHave,
        createdAt: jd.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        jobDescriptions: formattedJds,
        pagination: {
          page,
          limit,
          total,
        },
      },
    });
  } catch (error: any) {
    console.error("GET /api/job-descriptions failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to list job descriptions",
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

    if (!body.name || body.name.trim() === "") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Job description name is required.",
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
            message: "Job description text content is required.",
          },
        },
        { status: 400 }
      );
    }

    const name = body.name.trim();
    const rawText = body.text;
    const sourceUrl = body.sourceUrl || null;

    // Invoke LLM Parser
    const parsed = await parseJobDescription(rawText);

    // Save to Database
    const jd = await prisma.jobDescription.create({
      data: {
        userId,
        name,
        rawText,
        sourceUrl,
        parsedRequiredSkills: JSON.stringify(parsed.requiredSkills),
        parsedNiceToHave: JSON.stringify(parsed.niceToHave),
        parsedRoleLevel: parsed.roleLevel,
        parsedCompanyName: parsed.companyName,
        parsedCompanyTier: parsed.companyTier,
        parsedKeywords: JSON.stringify(parsed.keywords),
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          jobDescription: {
            id: jd.id,
            name: jd.name,
            parsedRequiredSkills: parsed.requiredSkills,
            parsedNiceToHave: parsed.niceToHave,
            parsedRoleLevel: jd.parsedRoleLevel,
            parsedCompanyName: jd.parsedCompanyName,
            parsedCompanyTier: jd.parsedCompanyTier,
            parsedKeywords: parsed.keywords,
            createdAt: jd.createdAt.toISOString(),
          },
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/job-descriptions failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error.message || "Failed to process and parse job description",
        },
      },
      { status: 500 }
    );
  }
}
