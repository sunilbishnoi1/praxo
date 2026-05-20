import { prisma } from "@/lib/db";
import type { ProgressSummary } from "./types";

export class ProgressService {
  /**
   * Generates a comprehensive progress summary and analytics trend for the active user.
   */
  static async getSummary(userId: string): Promise<ProgressSummary> {
    const entries = await prisma.progressEntry.findMany({
      where: { userId },
      orderBy: { sessionDate: "asc" },
    });

    if (entries.length === 0) {
      return {
        averageScore: 0,
        growthPercentage: 0,
        fillerWordChangePercentage: 0,
        readinessLevel: "Low",
        totalSessions: 0,
        totalDurationMs: 0,
        averageWpm: 0,
        averageFillerWordRate: 0,
        domainReadiness: {
          systemDesign: 0,
          behavioural: 0,
          dsa: 0,
          oop: 0,
          technicalResume: 0,
        },
        deliveryCoachAdvice: "Start your first mock interview session to unlock personalized delivery coach advice and skill progression metrics.",
        trend: [],
      };
    }

    const totalSessions = entries.length;
    const totalDurationMs = entries.reduce((acc, e) => acc + e.durationMs, 0);

    // 1. Calculate Average Score
    const totalScore = entries.reduce((acc, e) => acc + e.overallScore, 0);
    const averageScore = Math.round(totalScore / totalSessions);

    // 2. Growth and Trend Split (Former vs Latter Half)
    const midIndex = Math.floor(totalSessions / 2);
    const formerHalf = entries.slice(0, midIndex);
    const latterHalf = entries.slice(midIndex);

    let growthPercentage = 0;
    if (totalSessions > 1) {
      const formerAvg = formerHalf.reduce((acc, e) => acc + e.overallScore, 0) / (formerHalf.length || 1);
      const latterAvg = latterHalf.reduce((acc, e) => acc + e.overallScore, 0) / (latterHalf.length || 1);
      growthPercentage = Math.round(latterAvg - formerAvg);
    }

    // 3. Fluency & Filler metrics
    let totalWpm = 0;
    let totalEstimatedWords = 0;
    let totalFillerWords = 0;

    for (const e of entries) {
      totalWpm += e.averageWpm;
      totalFillerWords += e.fillerWordCount;
      const minutes = e.durationMs / 60000;
      const estimatedWords = e.averageWpm * minutes;
      totalEstimatedWords += estimatedWords;
    }

    const averageWpm = Math.round(totalWpm / totalSessions);
    const averageFillerWordRate = totalEstimatedWords > 0
      ? Number(((totalFillerWords / totalEstimatedWords) * 100).toFixed(1))
      : 0;

    // Growth in filler word rate (comparing latter half vs former half)
    let fillerWordChangePercentage = 0;
    if (totalSessions > 1) {
      let formerWords = 0;
      let formerFillers = 0;
      let latterWords = 0;
      let latterFillers = 0;

      for (const e of formerHalf) {
        formerFillers += e.fillerWordCount;
        formerWords += e.averageWpm * (e.durationMs / 60000);
      }
      for (const e of latterHalf) {
        latterFillers += e.fillerWordCount;
        latterWords += e.averageWpm * (e.durationMs / 60000);
      }

      const formerRate = formerWords > 0 ? (formerFillers / formerWords) * 100 : 0;
      const latterRate = latterWords > 0 ? (latterFillers / latterWords) * 100 : 0;
      fillerWordChangePercentage = Number((latterRate - formerRate).toFixed(1));
    }

    // 4. Domain Readiness
    const getAvgForRound = (roundId: string): number => {
      const filtered = entries.filter((e) => e.roundType === roundId);
      if (filtered.length === 0) return 0;
      const sum = filtered.reduce((acc, e) => acc + e.overallScore, 0);
      return Math.round(sum / filtered.length);
    };

    const domainReadiness = {
      systemDesign: getAvgForRound("system-design") || getAvgForRound("system_design"),
      behavioural: getAvgForRound("behavioural"),
      dsa: getAvgForRound("dsa"),
      oop: getAvgForRound("oop-cs") || getAvgForRound("oop_cs") || getAvgForRound("oop"),
      technicalResume: getAvgForRound("technical-resume") || getAvgForRound("technical_resume"),
    };

    // 5. Readiness Level
    let readinessLevel: "High" | "Medium" | "Low" = "Low";
    if (averageScore >= 85) readinessLevel = "High";
    else if (averageScore >= 70) readinessLevel = "Medium";

    // 6. Delivery Coach Advice
    let deliveryCoachAdvice = "Steady tempo! Your average pace is within the ideal range. To level up further, add brief deliberate 2-second pauses before complex technical design transitions.";
    if (averageWpm < 115) {
      deliveryCoachAdvice = "Your pacing is slightly slow (under 115 WPM). Try speaking with more urgency and dynamic range, while maintaining clear articulation.";
    } else if (averageWpm > 155) {
      deliveryCoachAdvice = "Your pacing is slightly fast (over 155 WPM). Try slowing down, taking deeper breaths, and using strategic silences to emphasize key terms.";
    }

    if (averageFillerWordRate > 4.0) {
      deliveryCoachAdvice += " Additionally, your filler word frequency is slightly elevated. Slow down and replace filler terms like 'um' and 'uh' with silent breath pauses.";
    }

    // 7. Format Trend Payload
    const trend = entries.map((e) => ({
      sessionId: e.sessionId,
      sessionDate: e.sessionDate.toISOString(),
      roundType: e.roundType,
      difficulty: e.difficulty,
      overallScore: e.overallScore,
      fluencyScore: e.fluencyScore,
      relevanceScore: e.relevanceScore,
      depthScore: e.depthScore,
      technicalScore: e.technicalScore,
      coherenceScore: e.coherenceScore,
      averageWpm: e.averageWpm,
      fillerWordCount: e.fillerWordCount,
      pauseCount: e.pauseCount,
      questionCount: e.questionCount,
      durationMs: e.durationMs,
    }));

    return {
      averageScore,
      growthPercentage,
      fillerWordChangePercentage,
      readinessLevel,
      totalSessions,
      totalDurationMs,
      averageWpm,
      averageFillerWordRate,
      domainReadiness,
      deliveryCoachAdvice,
      trend,
    };
  }
}
