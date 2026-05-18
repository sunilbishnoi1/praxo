import { getActiveLLMProvider } from "../llm";
import { RoundType, SessionContext, GeneratedQuestion, ScoringWeights } from "./types";

/**
 * Base utility for calling LLM and parsing structured JSON safely
 */
async function generateJsonWithLlm<T>(
  systemPrompt: string,
  userPrompt: string,
  fallback: T
): Promise<T> {
  try {
    const { adapter } = await getActiveLLMProvider();
    const response = await adapter.chat({
      model: adapter.maxContextTokens["gpt-4o"] ? "gpt-4o" : "default",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      responseFormat: "json",
      temperature: 0.2
    });

    if (!response.content || response.content.trim() === "") {
      return fallback;
    }

    let cleanJson = response.content.trim();
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }

    const parsed = JSON.parse(cleanJson) as unknown;

    if (Array.isArray(fallback)) {
      if (Array.isArray(parsed)) {
        return parsed as T;
      }

      if (parsed && typeof parsed === "object") {
        const candidate =
          (parsed as { questions?: unknown; items?: unknown; data?: unknown })
            .questions ??
          (parsed as { items?: unknown }).items ??
          (parsed as { data?: unknown }).data;

        if (Array.isArray(candidate)) {
          return candidate as T;
        }
      }

      return fallback;
    }

    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed[0] as T;
    }

    return parsed as T;
  } catch (error) {
    console.error("LLM Generation failed, falling back to static questions:", error);
    return fallback;
  }
}

type NormalizedDifficulty = "intern" | "junior" | "mid" | "senior";

function normalizeDifficulty(
  difficulty: string,
  yearsOfExperience?: number
): NormalizedDifficulty {
  const value = difficulty.trim().toLowerCase();

  if (value === "intern") return "intern";
  if (value === "junior" || value === "fresher") return "junior";
  if (value === "mid") return "mid";
  if (value === "senior" || value === "experienced") {
    if (typeof yearsOfExperience === "number" && yearsOfExperience < 5) {
      return "mid";
    }
    return "senior";
  }

  if (value === "custom") {
    if (typeof yearsOfExperience !== "number") return "mid";
    if (yearsOfExperience < 1) return "intern";
    if (yearsOfExperience < 3) return "junior";
    if (yearsOfExperience < 6) return "mid";
    return "senior";
  }

  return "mid";
}

function formatDifficultyLabel(context: SessionContext): string {
  const normalized = normalizeDifficulty(
    context.difficulty,
    context.yearsOfExperience
  );
  const label =
    normalized === "intern"
      ? "Intern"
      : normalized === "junior"
      ? "Junior"
      : normalized === "mid"
      ? "Mid"
      : "Senior";

  if (
    context.difficulty.trim().toLowerCase() === "custom" &&
    typeof context.yearsOfExperience === "number"
  ) {
    return `Custom (${context.yearsOfExperience} YOE, ${label})`;
  }

  return label;
}

function resolveQuestionCount(context: SessionContext): number {
  if (
    context.difficulty.trim().toLowerCase() === "custom" &&
    typeof context.yearsOfExperience === "number"
  ) {
    if (context.yearsOfExperience >= 8) return 10;
    if (context.yearsOfExperience >= 6) return 9;
    if (context.yearsOfExperience >= 3) return 8;
    if (context.yearsOfExperience >= 1) return 7;
    return 6;
  }

  const normalized = normalizeDifficulty(
    context.difficulty,
    context.yearsOfExperience
  );
  switch (normalized) {
    case "intern":
      return 6;
    case "junior":
      return 7;
    case "mid":
      return 8;
    case "senior":
      return 10;
    default:
      return 8;
  }
}

/**
 * Common helper to get question counts by difficulty
 */
export function getStandardQuestionCount(difficulty: string): number {
  const normalized = normalizeDifficulty(difficulty);
  switch (normalized) {
    case "intern":
      return 6;
    case "junior":
      return 7;
    case "mid":
      return 8;
    case "senior":
      return 10;
    default:
      return 8;
  }
}

// ============================================================================
// TECHNICAL - RESUME ROUND
// ============================================================================

export class TechnicalResumeRound implements RoundType {
  readonly id = "technical-resume";
  readonly name = "Technical — Resume-Based";
  readonly description = "Deep-dive questions validating resume claims, experiences, and technical stacks against target job description.";
  readonly phase = 1 as const;
  readonly icon = "FileUser";

  getSystemPrompt(context: SessionContext): string {
    return `You are a senior technical interviewer at a premium technology company. You are conducting a technical resume-based interview.
Candidate Difficulty: ${formatDifficultyLabel(context)}
Target Company Tier: ${context.targetCompanyTier ?? "General"}
Your tone is professional, encouraging, yet rigorous. You focus on concrete details, trade-offs, architecture decisions, and direct claims made in the resume.`;
  }

  getScoringWeights(): ScoringWeights {
    return {
      relevance: 0.20,
      depth: 0.20,
      technicalAccuracy: 0.30,
      fluency: 0.15,
      coherence: 0.15
    };
  }

  getQuestionCount(difficulty: string): number {
    return getStandardQuestionCount(difficulty);
  }

  async generateQuestions(context: SessionContext): Promise<GeneratedQuestion[]> {
    const questionCount = resolveQuestionCount(context);
    const difficultyLabel = formatDifficultyLabel(context);
    const systemPrompt = "You are a professional technical interviewer generator. Output valid JSON list only.";
    
    const userPrompt = `You are preparing interview questions for a ${difficultyLabel}-level technical interview.

CANDIDATE'S RESUME SKILLS: ${JSON.stringify(context.resumeSkills ?? [])}
CANDIDATE'S EXPERIENCE: ${JSON.stringify(context.resumeExperience ?? [])}
JD REQUIRED SKILLS: ${JSON.stringify(context.jobDescriptionSkills ?? [])}
GAP ANALYSIS: ${JSON.stringify(context.gapAnalysis ?? {})}
TARGET COMPANY TIER: ${context.targetCompanyTier ?? "general"}

Generate exactly ${questionCount} technical interview questions following this distribution:
- 30% validate resume claims (ask about specific projects/technologies they listed)
- 30% test JD requirements (focus on skills the role needs)
- 30% probe gap areas (test skills they are weak in or missing based on gap analysis)
- 10% general technical depth (architecture, trade-offs, best practices)

For each question provide:
1. questionText: The question text (natural, conversational tone - as a real interviewer would ask it out loud)
2. difficulty: "easy" | "medium" | "hard" (Start easy, end hard)
3. expectedKeyPoints: Expected key points the candidate should cover (3-5 bullet points)
4. relatedSkills: Array of skills being tested by this question

Return a valid JSON array matching this typescript format:
Array<{
  questionText: string;
  difficulty: "easy" | "medium" | "hard";
  expectedKeyPoints: string[];
  relatedSkills: string[];
}>

Output ONLY raw JSON.`;

    const fallbackQuestions: GeneratedQuestion[] = [
      {
        questionText: "To start off, could you walk me through your most significant technical project, the architecture choices you made, and what technical challenges you faced during implementation?",
        difficulty: "easy",
        expectedKeyPoints: [
          "Clearly states the problem statement and business objective",
          "Explains high-level architecture decisions and why technologies were chosen",
          "Details a specific technical challenge and how it was overcome"
        ],
        relatedSkills: ["Software Architecture", "Problem Solving"]
      },
      {
        questionText: "How do you approach optimizing performance and scalability in your web services, especially when dealing with database bottlenecks?",
        difficulty: "medium",
        expectedKeyPoints: [
          "Mentions indexing, query optimization, or schema redesign",
          "Discusses caching strategies (e.g., Redis, memcached)",
          "Mentions connection pooling, database replicas, or load balancing"
        ],
        relatedSkills: ["Performance Optimization", "Databases"]
      }
    ];

    return generateJsonWithLlm<GeneratedQuestion[]>(systemPrompt, userPrompt, fallbackQuestions);
  }

  async generateFollowUp(
    answerText: string,
    questionText: string,
    context: SessionContext
  ): Promise<GeneratedQuestion | null> {
    const systemPrompt = "You are a senior technical interviewer asking a brief follow-up question. Output JSON only.";
    const userPrompt = `Given the question asked and the candidate's answer, generate a quick, relevant follow-up question.
    
Question Asked: "${questionText}"
Candidate's Answer: "${answerText}"

Candidate Difficulty: ${formatDifficultyLabel(context)}

Rules for Follow-up:
- If the candidate's answer was good and detailed, go deeper: ask about trade-offs, design alternatives, or scaling.
- If the answer lacked detail, ask them to expand on the specific weak points.
- Keep the follow-up concise and conversational (1-2 sentences).

Return JSON format:
{
  "questionText": "Follow up question",
  "difficulty": "easy" | "medium" | "hard",
  "expectedKeyPoints": ["point 1", "point 2"],
  "relatedSkills": ["skill1"]
}`;

    const fallback: GeneratedQuestion = {
      questionText: "Could you elaborate on the trade-offs of the design choices you just described?",
      difficulty: "medium",
      expectedKeyPoints: ["Discusses pros and cons of selected tech stacks", "Mentions scaling or reliability constraints"],
      relatedSkills: ["System Design"]
    };

    return generateJsonWithLlm<GeneratedQuestion>(systemPrompt, userPrompt, fallback);
  }
}

// ============================================================================
// DSA ROUND
// ============================================================================

export class DSARound implements RoundType {
  readonly id = "dsa";
  readonly name = "DSA (Data Structures & Algorithms)";
  readonly description = "Verbal and walkthrough-based algorithmic challenges calibrating structural thinking, data formats, and complexities.";
  readonly phase = 1 as const;
  readonly icon = "Binary";

  getSystemPrompt(context: SessionContext): string {
    return `You are a technical interviewer conducting a Data Structures and Algorithms (DSA) round.
Difficulty: ${formatDifficultyLabel(context)}
Experience: ${context.yearsOfExperience ?? 0} years
Your focus is on assessing the candidate's logical approach, problem-solving, and verbal walkthrough of coding solutions, time/space complexities, and edge cases.`;
  }

  getScoringWeights(): ScoringWeights {
    return {
      relevance: 0.10,
      depth: 0.15,
      technicalAccuracy: 0.30,
      timeComplexity: 0.25,
      fluency: 0.10,
      coherence: 0.10
    };
  }

  getQuestionCount(difficulty: string): number {
    // DSA rounds typically focus on 2-3 deep problems in a session
    return 3;
  }

  async generateQuestions(context: SessionContext): Promise<GeneratedQuestion[]> {
    const questionCount = this.getQuestionCount(context.difficulty);
    const systemPrompt = "You are a technical interviewer generating DSA problems. Output valid JSON list only.";
    
    const userPrompt = `You are generating DSA problems for a ${formatDifficultyLabel(context)}-level interview.
Candidate Experience: ${context.yearsOfExperience ?? 0} years.

Generate exactly ${questionCount} data structures and algorithms questions with this distribution:
- Arrays/Strings: 25%
- Trees/Graphs: 25%
- Dynamic Programming: 20%
- Other (Stacks, Queues, Linked Lists, Sorting): 30%

Calibrate problem complexity based on Difficulty:
- Intern: Easy LeetCode (Two Sum, Valid Parentheses level)
- Junior: Easy-Medium (Binary Search, BFS/DFS level)
- Mid: Medium (DP, Graph algorithms)
- Senior: Medium-Hard (DP, Graph algorithms, system-aware problems)

For each question provide:
1. questionText: The problem statement (clear, concise, with simple example inputs/outputs)
2. difficulty: "easy" | "medium" | "hard"
3. dsaProblemType: "array" | "string" | "tree" | "graph" | "dp" | "sorting"
4. expectedTimeComplexity: "O(n)" | "O(n log n)" | "O(1)" etc.
5. expectedSpaceComplexity: "O(n)" | "O(1)" etc.
6. expectedKeyPoints: Expected key algorithmic steps/approaches the candidate should describe verbally.
7. relatedSkills: Array of data structures or algorithm concepts tested (e.g., ["Hash Map", "Binary Tree"])

Return valid JSON array matching this format:
Array<{
  questionText: string;
  difficulty: "easy" | "medium" | "hard";
  dsaProblemType: string;
  expectedTimeComplexity: string;
  expectedSpaceComplexity: string;
  expectedKeyPoints: string[];
  relatedSkills: string[];
}>`;

    const fallbackQuestions: GeneratedQuestion[] = [
      {
        questionText: "Given an array of integers 'nums' and an integer 'target', return indices of the two numbers such that they add up to 'target'. Explain your approach, how you would optimize it, and walk through the time complexity.",
        difficulty: "easy",
        dsaProblemType: "array",
        expectedTimeComplexity: "O(n)",
        expectedSpaceComplexity: "O(n)",
        expectedKeyPoints: [
          "Walks through a brute-force approach first O(n^2)",
          "Optimizes to O(n) using a hash map to look up complements",
          "Explains the space complexity trade-off for hash map usage"
        ],
        relatedSkills: ["Hash Map", "Array", "Time Complexity"]
      },
      {
        questionText: "How would you detect a cycle in a singly linked list? Describe your algorithm and walk through the execution verbally.",
        difficulty: "medium",
        dsaProblemType: "linkedlist",
        expectedTimeComplexity: "O(n)",
        expectedSpaceComplexity: "O(1)",
        expectedKeyPoints: [
          "Mentions using a hash set to track visited nodes O(n) space",
          "Optimizes to O(1) space using Floyd's Tortoise and Hare algorithm",
          "Explains how the fast and slow pointers interact and meet"
        ],
        relatedSkills: ["Linked List", "Two Pointers"]
      }
    ];

    return generateJsonWithLlm<GeneratedQuestion[]>(systemPrompt, userPrompt, fallbackQuestions);
  }

  async generateFollowUp(
    answerText: string,
    questionText: string,
    context: SessionContext
  ): Promise<GeneratedQuestion | null> {
    const systemPrompt = "You are a DSA interviewer asking a follow-up. Output JSON only.";
    const userPrompt = `Given the DSA question and the candidate's proposed approach, ask a highly relevant algorithmic follow-up.
    
Question: "${questionText}"
Candidate's verbal approach: "${answerText}"

Follow-up rules:
- Always ask about the time and space complexity of their proposed solution if not clearly specified.
- If they gave an optimal solution, ask about edge cases (e.g., null values, extreme bounds, empty inputs).
- If they gave a suboptimal solution, ask if they can optimize time or space complexity further.

Return JSON format:
{
  "questionText": "Concise follow-up question",
  "difficulty": "easy" | "medium" | "hard",
  "expectedKeyPoints": ["point 1", "point 2"],
  "relatedSkills": ["skill"]
}`;

    const fallback: GeneratedQuestion = {
      questionText: "Could you walk through the edge cases for this approach? For example, how does your solution handle negative numbers or empty inputs?",
      difficulty: "medium",
      expectedKeyPoints: ["Addresses boundary cases", "Mentions inputs validation checks"],
      relatedSkills: ["Edge Case Handling"]
    };

    return generateJsonWithLlm<GeneratedQuestion>(systemPrompt, userPrompt, fallback);
  }
}

// ============================================================================
// BEHAVIOURAL ROUND
// ============================================================================

export class BehaviouralRound implements RoundType {
  readonly id = "behavioural";
  readonly name = "Behavioural (STAR-based)";
  readonly description = "Assess leadership, communication, conflicts, teamwork, and cultural alignment using structured STAR responses.";
  readonly phase = 1 as const;
  readonly icon = "HeartHandshake";

  getSystemPrompt(context: SessionContext): string {
    return `You are a behavioural interviewer assessing teamwork, leadership, problem solving under pressure, and adaptability.
Difficulty: ${formatDifficultyLabel(context)}
Experience: ${context.yearsOfExperience ?? 0} years
Your focus is to ensure the candidate responds using the STAR framework: Situation, Task, Action, Result.`;
  }

  getScoringWeights(): ScoringWeights {
    return {
      relevance: 0.15,
      depth: 0.15,
      starStructure: 0.30,
      fluency: 0.20,
      coherence: 0.20
    };
  }

  getQuestionCount(difficulty: string): number {
    return getStandardQuestionCount(difficulty);
  }

  async generateQuestions(context: SessionContext): Promise<GeneratedQuestion[]> {
    const questionCount = this.getQuestionCount(context.difficulty);
    const systemPrompt = "You are a behavioural interviewer generator. Output valid JSON list only.";
    
    const userPrompt = `You are generating behavioural questions for a ${formatDifficultyLabel(context)}-level candidate.
Candidate Experience: ${context.yearsOfExperience ?? 0} years.
Candidate Experience Highlights: ${JSON.stringify(context.resumeExperience ?? [])}

Generate exactly ${questionCount} behavioural interview questions covering these core competencies:
- Leadership & initiative
- Conflict resolution & disagreements
- Failure, mistakes & key learnings
- Teamwork & collaboration
- Problem-solving under pressure
- Adaptability & rapid changes

Each question must:
1. Be open-ended, starting with "Tell me about a time..." or "Give me an example of..."
2. Target a specific competency and be calibrated for the years of experience.
3. Have a structured expectedStar property specifying the expected Situation, Task, Action, and Result details.

Return valid JSON array matching this format:
Array<{
  questionText: string;
  difficulty: "easy" | "medium" | "hard";
  expectedKeyPoints: string[];
  relatedSkills: string[];
  expectedStar: {
    situation: string;
    task: string;
    action: string;
    result: string;
  }
}>`;

    const fallbackQuestions: GeneratedQuestion[] = [
      {
        questionText: "Tell me about a time when you had a disagreement with a team member or stakeholder on a technical decision. How did you handle it, and what was the outcome?",
        difficulty: "medium",
        expectedKeyPoints: [
          "Explains the conflicting technical opinions objectively",
          "Focuses on data-driven discussions and constructive communication",
          "Mentions finding a compromise or mutual agreement and the positive project result"
        ],
        relatedSkills: ["Conflict Resolution", "Communication", "Collaboration"],
        expectedStar: {
          situation: "Working on a shared project with differing architectural or implementation opinions.",
          task: "Reaching a technical consensus without affecting team morale or timelines.",
          action: "Engaged in collaborative whiteboard sessions, gathered benchmarks, list of pros/cons, and communicated logically.",
          result: "Successfully chose the optimal path, delivered on time, and strengthened professional relation."
        }
      },
      {
        questionText: "Could you describe a time when a project or task you took ownership of failed or did not meet expectations? What did you learn from that experience?",
        difficulty: "hard",
        expectedKeyPoints: [
          "Admits mistake and takes genuine personal accountability",
          "Explains root cause of failure objectively",
          "Highlights proactive corrective actions and lessons learned applied to future work"
        ],
        relatedSkills: ["Ownership", "Resilience", "Continuous Learning"],
        expectedStar: {
          situation: "Assigned to lead or execute a technical delivery with tight timelines.",
          task: "Responsible for completing execution to high specifications.",
          action: "Failed to recognize resource constraints or bottleneck early, but communicated transparently and investigated failure.",
          result: "Developed a post-mortem, implemented automated regression tests, and avoided the bug in subsequent sprints."
        }
      }
    ];

    return generateJsonWithLlm<GeneratedQuestion[]>(systemPrompt, userPrompt, fallbackQuestions);
  }

  async generateFollowUp(
    answerText: string,
    questionText: string,
    context: SessionContext
  ): Promise<GeneratedQuestion | null> {
    const systemPrompt = "You are a behavioural interviewer asking a follow-up. Output JSON only.";
    const userPrompt = `Given the question and the candidate's answer, ask a targeted follow-up question to probe for missing STAR elements.
    
Question Asked: "${questionText}"
Candidate's Answer: "${answerText}"

Follow-up rules:
- Identify which part of the STAR framework is missing in their answer (Situation, Task, Action, or Result).
- Ask specifically for that missing piece in a polite and conversational tone.
- E.g. If they described the background but not what they did: "What was your specific role in that situation?"
- E.g. If they didn't mention results: "What was the final outcome, and were there any key metrics or feedback?"

Return JSON format:
{
  "questionText": "Conversational follow up",
  "difficulty": "easy" | "medium" | "hard",
  "expectedKeyPoints": ["point 1"],
  "relatedSkills": ["STAR Technique"]
}`;

    const fallback: GeneratedQuestion = {
      questionText: "That's a helpful context. What was the ultimate result of your actions, and did you have any measurable outcome or feedback from your team?",
      difficulty: "medium",
      expectedKeyPoints: ["Details measurable results or team feedback", "Highlights key lessons applied"],
      relatedSkills: ["Result Analysis"]
    };

    return generateJsonWithLlm<GeneratedQuestion>(systemPrompt, userPrompt, fallback);
  }
}

// ============================================================================
// OOP / CS FUNDAMENTALS ROUND
// ============================================================================

export class OOPCSRound implements RoundType {
  readonly id = "oop-cs";
  readonly name = "OOP & CS Fundamentals";
  readonly description = "Assessment of Object-Oriented Design principles (SOLID, patterns) and fundamental CS topics (OS, Network, DB).";
  readonly phase = 1 as const;
  readonly icon = "Cpu";

  getSystemPrompt(context: SessionContext): string {
    return `You are a technical interviewer evaluating Computer Science and Object-Oriented Programming (OOP) fundamentals.
Difficulty: ${formatDifficultyLabel(context)}
Evaluate depth in OOP design principles, SOLID design, operating systems, networks, and databases.`;
  }

  getScoringWeights(): ScoringWeights {
    return {
      relevance: 0.15,
      depth: 0.25,
      technicalAccuracy: 0.35,
      coherence: 0.15,
      fluency: 0.10
    };
  }

  getQuestionCount(difficulty: string): number {
    return getStandardQuestionCount(difficulty);
  }

  async generateQuestions(context: SessionContext): Promise<GeneratedQuestion[]> {
    const questionCount = this.getQuestionCount(context.difficulty);
    const systemPrompt = "You are an OOP/CS interviewer generator. Output valid JSON list only.";
    
    const userPrompt = `You are interviewing a ${formatDifficultyLabel(context)}-level candidate on OOP concepts and CS fundamentals.
Candidate Skills: ${JSON.stringify(context.resumeSkills ?? [])}

Generate exactly ${questionCount} conceptual and application questions covering this split:
- OOP & SOLID principles: 30%
- Data Structures & DB concepts (SQL/NoSQL, indexing, normalization): 25%
- System concepts (Operating Systems threads/processes, Networking HTTP/DNS): 25%
- Language-specific depth (based on resume): 20%

Calibrate question depth based on Difficulty:
- Intern: Conceptual definitions and simple examples (e.g. polymorphism, process vs thread, index basics).
- Junior: Comparison and scenario-based applications (e.g. inheritance vs composition, ACID properties, TCP vs UDP).
- Mid: Advanced patterns with practical examples (e.g. plugin systems, normalization trade-offs).
- Senior: Structural designs and trade-offs (e.g. designing extensible modules, distributed DB trade-offs).

Return valid JSON array matching this format:
Array<{
  questionText: string;
  difficulty: "easy" | "medium" | "hard";
  expectedKeyPoints: string[];
  relatedSkills: string[];
}>`;

    const fallbackQuestions: GeneratedQuestion[] = [
      {
        questionText: "Can you explain the difference between Composition and Inheritance? In what scenarios would you explicitly choose composition over inheritance, and what are the trade-offs?",
        difficulty: "medium",
        expectedKeyPoints: [
          "Defines inheritance ('is-a') vs composition ('has-a')",
          "Explains that composition provides greater runtime flexibility and looser coupling",
          "Mentions that inheritance can lead to rigid class hierarchies (the fragile base class problem)"
        ],
        relatedSkills: ["Object-Oriented Design", "Design Patterns"]
      },
      {
        questionText: "What are the ACID properties in database systems? Walk me through what each letter stands for and why they are vital in high-transaction environments.",
        difficulty: "medium",
        expectedKeyPoints: [
          "Defines Atomicity (all or nothing), Consistency (valid state transitions), Isolation (independent execution), and Durability (persistence)",
          "Explains isolation levels and concurrency control (locking, MVCC)",
          "Provides a clear example like bank transfers to illustrate transaction safety"
        ],
        relatedSkills: ["Databases", "ACID Transactions"]
      }
    ];

    return generateJsonWithLlm<GeneratedQuestion[]>(systemPrompt, userPrompt, fallbackQuestions);
  }

  async generateFollowUp(
    answerText: string,
    questionText: string,
    context: SessionContext
  ): Promise<GeneratedQuestion | null> {
    const systemPrompt = "You are a CS fundamentals interviewer asking a follow-up. Output JSON only.";
    const userPrompt = `Given the conceptual question and the candidate's answer, ask a brief technical follow-up to test their absolute depth.
    
Question Asked: "${questionText}"
Candidate's Answer: "${answerText}"

Follow-up rules:
- Drill down on the specific definitions or examples they provided.
- Ask them to apply their explanation to a concrete coding scenario.
- Probe for extreme boundary cases (e.g., concurrency bottlenecks, thread safety).

Return JSON format:
{
  "questionText": "Follow up question text",
  "difficulty": "easy" | "medium" | "hard",
  "expectedKeyPoints": ["point 1"],
  "relatedSkills": ["Concept Depth"]
}`;

    const fallback: GeneratedQuestion = {
      questionText: "That makes sense. How would you ensure thread-safety in the composition model you described when accessed by concurrent processes?",
      difficulty: "hard",
      expectedKeyPoints: ["Mentions concurrency locks, mutexes, or atomic variables", "Discusses stateless design advantages"],
      relatedSkills: ["Concurrency Control"]
    };

    return generateJsonWithLlm<GeneratedQuestion>(systemPrompt, userPrompt, fallback);
  }
}

// ============================================================================
// SYSTEM DESIGN ROUND
// ============================================================================

export class SystemDesignRound implements RoundType {
  readonly id = "system-design";
  readonly name = "System Design (HLD/LLD)";
  readonly description = "Assess architectural strategies, components, data flows, caching, databases, scaling, and failure tolerances.";
  readonly phase = 1 as const;
  readonly icon = "Network";

  getSystemPrompt(context: SessionContext): string {
    return `You are a system design interviewer.
Difficulty: ${formatDifficultyLabel(context)}
Experience: ${context.yearsOfExperience ?? 0} years
Company Tier: ${context.targetCompanyTier ?? "General"}
Assess high-level design, component design, databases selection, caching, scaling considerations, and fault-tolerance.`;
  }

  getScoringWeights(): ScoringWeights {
    return {
      relevance: 0.15,
      depth: 0.30,
      technicalAccuracy: 0.25,
      coherence: 0.20,
      fluency: 0.10
    };
  }

  getQuestionCount(difficulty: string): number {
    // System design interviews usually drill into 1 or 2 core problems
    return 2;
  }

  async generateQuestions(context: SessionContext): Promise<GeneratedQuestion[]> {
    const questionCount = this.getQuestionCount(context.difficulty);
    const systemPrompt = "You are a system design interviewer generator. Output valid JSON list only.";
    
    const userPrompt = `You are generating system design prompts for a ${formatDifficultyLabel(context)}-level interviewer.
Candidate Experience: ${context.yearsOfExperience ?? 0} years.
Target Company Tier: ${context.targetCompanyTier ?? "general"}.

Generate exactly ${questionCount} system design problems.

Calibrate problem complexity:
- Junior: Simple systems (URL shortener, task tracker)
- Mid (3-5 YOE): Medium systems (chat application, notification service)
- Senior (5+ YOE): Complex systems (distributed cache, real-time analytics)

For each question provide:
1. questionText: The architecture problem statement (including scale like 'design a service handling 100k requests per second')
2. difficulty: "easy" | "medium" | "hard"
3. expectedKeyPoints: Expected design components, requirements analysis, scaling discussion points.
4. expectedComponents: Array of core high-level components they should suggest (e.g., ["Load Balancer", "Redis Cache"])
5. relatedSkills: Array of system design skills tested (e.g., ["Scalability", "SQL vs NoSQL"])

Return valid JSON array matching this format:
Array<{
  questionText: string;
  difficulty: "easy" | "medium" | "hard";
  expectedKeyPoints: string[];
  expectedComponents: string[];
  relatedSkills: string[];
}>`;

    const fallbackQuestions: GeneratedQuestion[] = [
      {
        questionText: "Design a URL shortener service like TinyURL. The system should handle 10k write requests and 100k read requests per second. Walk me through your design, database choices, and caching strategy.",
        difficulty: "medium",
        expectedKeyPoints: [
          "Defines functional and non-functional requirements (read/write scale, latency, durability)",
          "Discusses API design (POST /api/shorten, GET /:hash)",
          "Calculates storage capacity requirements and chooses appropriate DB (SQL or NoSQL hash storage)",
          "Mentions hashing/encoding techniques (Base62) and handling collisions",
          "Incorporates a caching tier (Redis) to accelerate high-volume reads"
        ],
        expectedComponents: ["Load Balancer", "API Server Tier", "Redis Cache", "Relational/NoSQL Database", "Unique ID Generator Service"],
        relatedSkills: ["Scalability", "Hashing", "Caching", "System Architecture"]
      }
    ];

    return generateJsonWithLlm<GeneratedQuestion[]>(systemPrompt, userPrompt, fallbackQuestions);
  }

  async generateFollowUp(
    answerText: string,
    questionText: string,
    context: SessionContext
  ): Promise<GeneratedQuestion | null> {
    const systemPrompt = "You are a system design interviewer asking a scaling/failure follow-up. Output JSON only.";
    const userPrompt = `Given the system design question and the candidate's proposed architecture, ask a targeted follow-up question about scaling, single points of failure, or bottlenecks.
    
Question: "${questionText}"
Candidate's architecture overview: "${answerText}"

Follow-up rules:
- Propose a failure scenario (e.g. DB master crash, network partition, massive spike in traffic).
- Ask how their design handles this failure and what trade-offs (CAP theorem) they will accept.
- Keep it highly technical, conversational, and direct.

Return JSON format:
{
  "questionText": "Drill-down follow up",
  "difficulty": "easy" | "medium" | "hard",
  "expectedKeyPoints": ["point 1"],
  "relatedSkills": ["Fault Tolerance"]
}`;

    const fallback: GeneratedQuestion = {
      questionText: "What happens if your primary database instance crashes under high read traffic? How do you ensure high availability and prevent data loss in that scenario?",
      difficulty: "hard",
      expectedKeyPoints: ["Discusses primary-replica database replication", "Mentions database failover, read replicas, or eventual consistency"],
      relatedSkills: ["High Availability", "Fault Tolerance"]
    };

    return generateJsonWithLlm<GeneratedQuestion>(systemPrompt, userPrompt, fallback);
  }
}
