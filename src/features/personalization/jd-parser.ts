import { z } from "zod";
import { getActiveLLMProvider } from "../llm";
import { normalizeSkills } from "./skill-normalizer";

export const parsedJdSchema = z.object({
  requiredSkills: z.array(z.string()).default([]),
  niceToHave: z.array(z.string()).default([]),
  roleLevel: z.enum(["intern", "junior", "mid", "senior", "staff"]).nullable().default("mid"),
  companyName: z.string().nullable().default(""),
  companyTier: z.enum(["faang", "mid-tier", "startup"]).nullable().default("mid-tier"),
  keywords: z.array(z.string()).default([])
});

export type ParsedJobDescription = z.infer<typeof parsedJdSchema>;

const FAANG_COMPANIES = new Set([
  "google", "meta", "facebook", "amazon", "apple", "netflix", "microsoft",
  "uber", "airbnb", "stripe", "nvidia", "salesforce", "adobe", "oracle",
  "linkedin", "twitter", "x", "snap", "pinterest", "spotify", "databricks",
  "snowflake", "palantir", "coinbase", "robinhood", "doordash",
]);

export function classifyCompanyTier(companyName: string | null): "faang" | "mid-tier" | "startup" | null {
  if (!companyName) return null;
  const normalized = companyName.toLowerCase().trim();
  if (FAANG_COMPANIES.has(normalized)) return "faang";
  return null; // Let the LLM classification stand as fallback
}

function buildJdPrompt(rawText: string): string {
  return `You are a job description parser. Extract structured information from this JD.

JOB DESCRIPTION TEXT:
${rawText}

Extract and return JSON that strictly matches the following format:
{
  "requiredSkills": ["skill1", "skill2", ...],   // Must-have/essential technical skills
  "niceToHave": ["skill3", "skill4", ...],       // Preferred or nice-to-have skills
  "roleLevel": "intern" | "junior" | "mid" | "senior" | "staff",
  "companyName": "Company Name",
  "companyTier": "faang" | "mid-tier" | "startup",
  "keywords": ["keyword1", "keyword2", ...]      // Core company values/operating terms (e.g. "ownership", "scale")
}

Rules:
- Distinguish between required ("must have", "required", "essential") and nice-to-have ("preferred", "plus", "bonus")
- If a field cannot be determined, use null.
- Output ONLY valid raw JSON without any markdown formatting wrappers or explanation.`;
}

export async function parseJobDescription(rawText: string): Promise<ParsedJobDescription> {
  const { adapter } = await getActiveLLMProvider();

  // 1. Send to LLM for structured extraction
  const response = await adapter.chat({
    model: adapter.maxContextTokens["gpt-4o"] ? "gpt-4o" : "default",
    messages: [
      {
        role: "system",
        content: "You are a precise, factual job description parsing assistant. You output raw JSON only."
      },
      {
        role: "user",
        content: buildJdPrompt(rawText)
      }
    ],
    responseFormat: "json",
    temperature: 0.1, // Low temperature for factual extraction
  });

  if (!response.content || response.content.trim() === "") {
    throw new Error("Empty response from LLM during JD parsing.");
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
    throw new Error(`LLM output was not valid JSON during JD parsing: ${cleanJson}. Error: ${e.message}`);
  }

  // 4. Validate with Zod
  const validated = parsedJdSchema.parse(parsedJson);

  // 5. Force override tier check with our static Set if applicable
  const staticTier = classifyCompanyTier(validated.companyName);
  if (staticTier) {
    validated.companyTier = staticTier;
  }

  // 6. Normalize and deduplicate skills
  validated.requiredSkills = normalizeSkills(validated.requiredSkills);
  validated.niceToHave = normalizeSkills(validated.niceToHave);

  return validated;
}
