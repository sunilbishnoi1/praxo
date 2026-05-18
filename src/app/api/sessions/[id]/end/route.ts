import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAccessPin } from "@/lib/access";
import { getDefaultUserId } from "@/features/llm";

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

    // 1. Fetch existing session
    const session = await prisma.session.findUnique({
      where: { id, userId, deletedAt: null },
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

    // 2. Update Session
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
        totalDurationMs,
        completedAt: completedAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("POST /api/sessions/[id]/end failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error.message || "Failed to end session",
        },
      },
      { status: 500 }
    );
  }
}
