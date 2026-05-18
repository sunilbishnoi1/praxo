import { z } from "zod";
import { PDFParse } from "pdf-parse";
import { getData as getWorkerData } from "pdf-parse/worker";
import { getActiveLLMProvider } from "../llm";
import { normalizeSkills } from "./skill-normalizer";

export const parsedResumeSchema = z.object({
  skills: z.array(z.string()).default([]),
  experience: z.array(z.object({
    company: z.string().nullable().default(""),
    role: z.string().nullable().default(""),
    duration: z.string().nullable().default(""),
    highlights: z.array(z.string()).default([])
  })).default([]),
  education: z.array(z.object({
    institution: z.string().nullable().default(""),
    degree: z.string().nullable().default(""),
    year: z.string().nullable().default("")
  })).default([]),
  projects: z.array(z.object({
    name: z.string().nullable().default(""),
    description: z.string().nullable().default(""),
    technologies: z.array(z.string()).default([])
  })).default([]),
  experienceLevel: z.enum(["intern", "fresher", "junior", "mid", "senior"]).nullable().default("fresher"),
  yearsOfExperience: z.number().nullable().default(0)
});

export type ParsedResume = z.infer<typeof parsedResumeSchema>;

function buildResumePrompt(rawText: string): string {
  return `You are a resume parser. Extract structured information from this resume text.

RESUME TEXT:
${rawText}

Extract and return JSON that strictly matches the following format:
{
  "skills": ["skill1", "skill2", ...],        // All technical skills mentioned
  "experience": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "duration": "2 years",                    // Approximate
      "highlights": ["key achievement 1", ...]  // 2-4 per role
    }
  ],
  "education": [
    {
      "institution": "University Name",
      "degree": "B.Tech in CS",
      "year": "2023"
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "One-sentence description",
      "technologies": ["React", "Node.js"]
    }
  ],
  "experienceLevel": "intern", "fresher", "junior", "mid", or "senior",
  "yearsOfExperience": 3.5                     // Numeric estimate in years
}

Rules:
- Extract ONLY what is explicitly stated. Do not infer skills not mentioned.
- For experienceLevel, use: intern (0), fresher (0-1), junior (1-3), mid (3-6), senior (6+)
- If a field cannot be determined, use null.
- Output ONLY valid raw JSON without any markdown formatting wrappers or explanation.`;
}

export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  try {
    PDFParse.setWorker(getWorkerData());
    const parser = new PDFParse({ data: pdfBuffer });
    const result = await parser.getText();
    await parser.destroy();
    if (!result || !result.text || result.text.trim() === "") {
      throw new Error("No text content found in PDF.");
    }
    return result.text;
  } catch (error: any) {
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

export async function parseResume(rawText: string): Promise<ParsedResume> {
  const { adapter } = await getActiveLLMProvider();

  // 1. Send to LLM for structured extraction
  const response = await adapter.chat({
    model: adapter.maxContextTokens["gpt-4o"] ? "gpt-4o" : "default", // will fall back to its configured default in adapter
    messages: [
      {
        role: "system",
        content: "You are a highly precise, factual resume parsing assistant. You output raw JSON only."
      },
      {
        role: "user",
        content: buildResumePrompt(rawText)
      }
    ],
    responseFormat: "json",
    temperature: 0.1, // Low temperature for factual extraction
  });

  if (!response.content || response.content.trim() === "") {
    throw new Error("Empty response from LLM during parsing.");
  }

  // 2. Clean JSON formatting if LLM wrapped in ```json
  let cleanJson = response.content.trim();
  if (cleanJson.startsWith("```")) {
    cleanJson = cleanJson.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  }

  // 3. Parse JSON
  let parsedJson: any;
  try {
    parsedJson = JSON.parse(cleanJson);
  } catch (e: any) {
    throw new Error(`LLM output was not valid JSON: ${cleanJson}. Error: ${e.message}`);
  }

  // 4. Validate with Zod
  const validated = parsedResumeSchema.parse(parsedJson);

  // 5. Normalize and deduplicate skills
  validated.skills = normalizeSkills(validated.skills);

  return validated;
}
