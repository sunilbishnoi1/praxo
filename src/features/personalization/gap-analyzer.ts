import { z } from "zod";
import { getActiveLLMProvider } from "../llm";

export const gapAnalysisSchema = z.object({
  strongSkills: z.array(z.string()).default([]),
  weakSkills: z.array(z.string()).default([]),
  missingSkills: z.array(z.string()).default([]),
  focusAreas: z.array(z.string()).default([]),
  experienceAlignment: z.enum(["under-qualified", "aligned", "over-qualified"]).nullable().default("aligned"),
  reasoning: z.string().nullable().default("")
});

export type GapAnalysis = z.infer<typeof gapAnalysisSchema>;

/**
 * Keyword-based, local gap analysis (Fast & deterministic)
 */
export function analyzeGap(
  resumeSkills: string[],
  jdRequiredSkills: string[],
  jdNiceToHave: string[]
): GapAnalysis {
  const resumeSet = new Set(resumeSkills.map(s => s.toLowerCase()));

  // Skills in both resume and JD required
  const strongSkills = jdRequiredSkills.filter(s =>
    resumeSet.has(s.toLowerCase())
  );

  // Skills in JD required but NOT in resume
  const missingSkills = jdRequiredSkills.filter(s =>
    !resumeSet.has(s.toLowerCase())
  );

  // Nice-to-have skills NOT in resume (treated as potential areas of weakness/opportunity)
  const weakSkills = jdNiceToHave.filter(s =>
    !resumeSet.has(s.toLowerCase())
  );

  // Focus areas: missing required skills + top weak skills
  const focusAreas = [
    ...missingSkills.slice(0, 3),
    ...weakSkills.slice(0, 2),
  ];

  return {
    strongSkills,
    weakSkills,
    missingSkills,
    focusAreas,
    experienceAlignment: "aligned",
    reasoning: "Computed via fast keyword-matching."
  };
}

/**
 * LLM-enhanced gap analysis for semantic understanding
 */
export async function analyzeGapLlm(params: {
  resumeSkills: string[];
  resumeExperience: any[];
  jdRequiredSkills: string[];
  jdNiceToHave: string[];
  jdRoleLevel: string | null;
  experienceLevel: string | null;
}): Promise<GapAnalysis> {
  const localAnalysis = analyzeGap(
    params.resumeSkills,
    params.jdRequiredSkills,
    params.jdNiceToHave
  );

  try {
    const { adapter } = await getActiveLLMProvider();

    const response = await adapter.chat({
      model: adapter.maxContextTokens["gpt-4o"] ? "gpt-4o" : "default",
      messages: [
        {
          role: "system",
          content: "You are a senior recruiter and technical interviewer expert in identifying gaps between a candidate's resume and a job description. You output raw JSON only."
        },
        {
          role: "user",
          content: `Given a candidate's resume details and a job description, perform a professional gap analysis.

RESUME SKILLS: ${JSON.stringify(params.resumeSkills)}
RESUME EXPERIENCE: ${JSON.stringify(params.resumeExperience)}
RESUME EXPERIENCE LEVEL: ${params.experienceLevel ?? "junior"}

JD REQUIRED SKILLS: ${JSON.stringify(params.jdRequiredSkills)}
JD NICE-TO-HAVE: ${JSON.stringify(params.jdNiceToHave)}
JD ROLE LEVEL: ${params.jdRoleLevel ?? "mid"}

Analyze:
1. Which required skills does the candidate clearly demonstrate? (strongSkills)
2. Which required skills are completely absent? (missingSkills)
3. Which skills does the candidate mention but likely lacks depth or real-world experience in? (weakSkills)
4. What should the interview focus on to best prepare this candidate? (focusAreas)
5. experienceAlignment: Decide if the candidate is "under-qualified", "aligned", or "over-qualified" for this role.

Return JSON in exactly this format:
{
  "strongSkills": ["...", ...],
  "weakSkills": ["...", ...],
  "missingSkills": ["...", ...],
  "focusAreas": ["...", ...],
  "experienceAlignment": "under-qualified" | "aligned" | "over-qualified",
  "reasoning": "Brief paragraph explaining the alignment and core gaps."
}

Rules:
- Be realistic and factual based on the resume. Do not invent skills.
- Output ONLY valid raw JSON without any markdown formatting wrappers or explanation.`
        }
      ],
      responseFormat: "json",
      temperature: 0.2
    });

    if (!response.content || response.content.trim() === "") {
      return localAnalysis;
    }

    let cleanJson = response.content.trim();
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }

    const parsedJson = JSON.parse(cleanJson);
    return gapAnalysisSchema.parse(parsedJson);

  } catch (error) {
    console.error("LLM Gap Analysis failed, falling back to local analysis", error);
    return localAnalysis;
  }
}
