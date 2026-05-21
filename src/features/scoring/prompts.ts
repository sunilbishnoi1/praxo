export interface AnswerScoringPromptInput {
  roundType: string;
  difficulty: string;
  yearsOfExperience: number;
  companyContext: string;
  questionText: string;
  answerTranscript: string;
  expectedKeyPoints: string;
  wpm: number;
  pauseCount: number;
  fillerWordCount: number;
  speakingDurationSeconds: number;
}

export function buildAnswerScoringPrompt(input: AnswerScoringPromptInput): string {
  return `You are an expert interview evaluator for a ${input.roundType} interview round.
The candidate is at ${input.difficulty} level (${input.yearsOfExperience} years of experience).
${input.companyContext}

QUESTION:
${input.questionText}

CANDIDATE'S ANSWER:
${input.answerTranscript}

EXPECTED KEY POINTS:
${input.expectedKeyPoints}

FLUENCY DATA:
- Words per minute: ${input.wpm}
- Pause count (>2s): ${input.pauseCount}
- Filler word count: ${input.fillerWordCount}
- Speaking duration: ${input.speakingDurationSeconds}s

Evaluate this answer on the following dimensions. Score each 0-100 where:
- 0-20: Very poor — fundamentally wrong or completely off-topic
- 21-40: Below average — major gaps, vague, or mostly incorrect
- 41-60: Average — partially correct but lacks depth or specificity
- 61-80: Good — mostly correct with reasonable depth
- 81-100: Excellent — thorough, accurate, well-structured, specific examples

DIMENSIONS TO SCORE:
1. relevance (0-100): Does the answer directly address the question?
2. depth (0-100): Is the answer thorough with specific details and examples?
3. technicalAccuracy (0-100): Are technical claims factually correct? (Score 0 if not a technical question)
4. starStructure (0-100): Does the answer follow STAR format? (Score 0 if not a behavioural question)
5. timeComplexity (0-100): Does the user discuss time/space complexity? (Score 0 if not a DSA question)
6. coherence (0-100): Is the answer logically structured and easy to follow?

Also provide:
- feedback: 2-3 sentences of specific, actionable feedback. Be direct and constructive.
- strengths: List 1-3 specific things the candidate did well.
- improvements: List 1-3 specific things to improve.
- studyResources: List 1-3 specific resources (books, articles, topics) to study.

Respond ONLY with a JSON object matching this exact schema:
{
  "relevance": <number>,
  "depth": <number>,
  "technicalAccuracy": <number>,
  "starStructure": <number>,
  "timeComplexity": <number>,
  "coherence": <number>,
  "feedback": "<string>",
  "strengths": ["<string>", ...],
  "improvements": ["<string>", ...],
  "studyResources": ["<string>", ...]
}

Be honest and critical. This is a practice tool — the user wants to know exactly where they fall short. Do not inflate scores to be encouraging. If the answer is weak, score it low and explain why.`;
}

export interface IdealAnswerPromptInput {
  roundType: string;
  difficulty: string;
  yearsOfExperience: number;
  companyTier: string;
  resumeContext: string;
  jdContext: string;
  questionText: string;
  expectedKeyPoints: string;
}

export function getRoundSpecificInstructions(roundType: string): string {
  const normalized = roundType.toLowerCase();
  if (normalized.includes("resume") || normalized.includes("technical-resume")) {
    return "References specific technologies from the candidate's resume and explains trade-offs";
  }
  if (normalized.includes("dsa")) {
    return "Explains the approach, walks through the algorithm step by step, analyzes time and space complexity";
  }
  if (normalized.includes("behavioural") || normalized.includes("behavioral")) {
    return "Follows STAR format: clear Situation, specific Task, detailed Action, measurable Result";
  }
  if (normalized.includes("oop") || normalized.includes("cs")) {
    return "Demonstrates understanding of core principles with practical application examples";
  }
  if (normalized.includes("system-design") || normalized.includes("design")) {
    return "Structures the answer: requirements → high-level design → component deep dive → trade-offs";
  }
  return "Provides structured, deep, and complete response with examples";
}

export function buildIdealAnswerPrompt(input: IdealAnswerPromptInput): string {
  const roundSpecific = getRoundSpecificInstructions(input.roundType);
  return `You are an expert interview coach. Generate the IDEAL answer for this interview question.

CONTEXT:
- Round type: ${input.roundType}
- Difficulty: ${input.difficulty} (${input.yearsOfExperience} YOE)
- Target company tier: ${input.companyTier}
${input.resumeContext}
${input.jdContext}

QUESTION:
${input.questionText}

EXPECTED KEY POINTS:
${input.expectedKeyPoints}

Generate a model answer that:
1. Directly addresses every part of the question
2. Uses specific, concrete examples (fabricate realistic ones appropriate for the experience level)
3. Demonstrates appropriate depth for the difficulty level
4. ${roundSpecific}
5. Is the length a strong candidate would give verbally (2-3 minutes of speaking, ~300-450 words)

Respond with ONLY the ideal answer text. No preamble, no "Here is the ideal answer:", just the answer itself.`;
}

export interface CompanyFitPromptInput {
  jobDescriptionText: string;
  roundType: string;
  overallScore: number;
  dimensionScoresJson: string;
  strengths: string;
  weaknesses: string;
  resumeSkills: string;
  averageWpm: number;
  fillerFrequency: number;
  coherenceScore: number;
}

export function buildCompanyFitPrompt(input: CompanyFitPromptInput): string {
  return `You are an expert recruiter analyzing a candidate's fit for a specific role.

JOB DESCRIPTION:
${input.jobDescriptionText}

CANDIDATE'S SESSION PERFORMANCE:
- Round type: ${input.roundType}
- Overall score: ${input.overallScore}/100
- Dimension scores: ${input.dimensionScoresJson}
- Key strengths demonstrated: ${input.strengths}
- Key weaknesses identified: ${input.weaknesses}
- Skills from resume: ${input.resumeSkills}

CANDIDATE'S FLUENCY:
- Average WPM: ${input.averageWpm}
- Filler word frequency: ${input.fillerFrequency} per minute
- Coherence score: ${input.coherenceScore}/100

Analyze the candidate's fit for this role. Consider:
1. Technical skill alignment (resume skills vs JD requirements)
2. Performance in the interview simulation
3. Communication quality
4. Experience level appropriateness

Provide:
1. A company-fit score (0-100) where:
   - 0-30: Poor fit — major skill gaps or performance issues
   - 31-50: Moderate fit — some alignment but significant gaps
   - 51-70: Good fit — meets many requirements with room to grow
   - 71-90: Strong fit — well-aligned with most requirements
   - 91-100: Exceptional fit — exceeds expectations

2. A 2-3 paragraph analysis explaining the score.

Respond ONLY with a JSON object:
{
  "companyFitScore": <number>,
  "companyFitAnalysis": "<string>"
}

Output ONLY valid raw JSON.`;
}

export interface SessionSummaryPromptInput {
  roundType: string;
  difficulty: string;
  yearsOfExperience: number;
  questionsAndAnswersJson: string;
  dimensionScoresJson: string;
  overallScore: number;
}

export function buildSessionSummaryPrompt(input: SessionSummaryPromptInput): string {
  return `You are an expert interview coach reviewing a complete mock interview session.

CONTEXT:
- Round: ${input.roundType}
- Difficulty: ${input.difficulty} (${input.yearsOfExperience} YOE)
- Overall Score achieved: ${input.overallScore}/100
- Dimension Averages: ${input.dimensionScoresJson}

QUESTIONS AND CANDIDATE ANSWERS WITH SCORES:
${input.questionsAndAnswersJson}

Provide a comprehensive, professional evaluation of the entire session.
Include:
1. overallSummary: A 2-3 paragraph summary of the candidate's performance, identifying key themes in their style, depth, accuracy, and communication.
2. keyStrengths: List 2-4 most significant strengths demonstrated across all answers.
3. keyWeaknesses: List 2-4 most significant weaknesses or areas needing attention across all answers.
4. nextSessionFocus: A short instruction on what exactly the user should focus on or practice in their next session to make the biggest improvement.

Respond ONLY with a JSON object matching this schema:
{
  "overallSummary": "<string>",
  "keyStrengths": ["<string>", ...],
  "keyWeaknesses": ["<string>", ...],
  "nextSessionFocus": "<string>"
}

Output ONLY valid raw JSON.`;
}

export interface SessionSummaryPromptsInput {
  roundType: string;
  difficulty: string;
  yearsOfExperience: number;
  questionsAndAnswersJson: string;
  dimensionScoresJson: string;
  overallScore: number;
}

export function buildSessionExecutiveSummaryPrompt(input: SessionSummaryPromptsInput): string {
  return `You are an elite technical interview coach. Evaluate this complete mock interview session:
- Round: ${input.roundType}
- Difficulty: ${input.difficulty} (${input.yearsOfExperience} YOE)
- Overall Score: ${input.overallScore}/100
- Dimension Averages: ${input.dimensionScoresJson}

QUESTIONS & CANDIDATE ANSWERS WITH INDIVIDUAL SCORES:
${input.questionsAndAnswersJson}

Provide a deep, 2-3 paragraph professional executive evaluation of the candidate's core communication style, speed of thought, domain expertise, and technical maturity. Speak directly, highlighting their unique professional signature and areas of polish.
Respond with ONLY the executive summary text. Do not include JSON formatting or HTML.`;
}

export function buildSessionStrengthsWeaknessesPrompt(input: SessionSummaryPromptsInput): string {
  return `You are an expert technical interviewer. Evaluate this complete mock interview session:
- Round: ${input.roundType}
- Difficulty: ${input.difficulty} (${input.yearsOfExperience} YOE)
- Overall Score: ${input.overallScore}/100

QUESTIONS & CANDIDATE ANSWERS WITH INDIVIDUAL SCORES:
${input.questionsAndAnswersJson}

Identify the key technical and architectural strengths and weaknesses demonstrated. Pick out specific traits, code details, or communication behaviors.
Respond ONLY with a JSON object matching this schema:
{
  "keyStrengths": ["Detailed strength 1", "Detailed strength 2", ...],
  "keyWeaknesses": ["Detailed weakness/gap 1", "Detailed weakness/gap 2", ...]
}
Output ONLY valid raw JSON.`;
}

export function buildSessionNextFocusPrompt(input: SessionSummaryPromptsInput): string {
  return `You are a world-class system engineering coach. Evaluate this complete mock interview session:
- Round: ${input.roundType}
- Difficulty: ${input.difficulty} (${input.yearsOfExperience} YOE)
- Overall Score: ${input.overallScore}/100
- Dimension Averages: ${input.dimensionScoresJson}

QUESTIONS & CANDIDATE ANSWERS WITH INDIVIDUAL SCORES:
${input.questionsAndAnswersJson}

Formulate highly tailored, actionable preparation advice on what exactly the candidate should focus on or practice in their next session to make the biggest improvement.
Respond with ONLY the actionable next steps text. Do not include JSON formatting or HTML.`;
}
