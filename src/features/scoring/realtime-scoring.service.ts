import { getActiveLLMProvider } from "@/features/llm";

/**
 * A mapped Q&A pair extracted from a realtime interview dialogue.
 */
export interface MappedDialogueAnswer {
  questionId: string;
  questionText: string;
  candidateAnswer: string;
  /** Estimated speaking duration for this answer in ms */
  estimatedDurationMs: number;
}

/**
 * Segmentation result from dialogue analysis.
 */
export interface DialogueSegmentationResult {
  mappedAnswers: MappedDialogueAnswer[];
  /** Full concatenated candidate transcript for overall analysis */
  fullCandidateTranscript: string;
  /** Full concatenated interviewer transcript */
  fullInterviewerTranscript: string;
}

type DialogueTurn = { speaker: string; text: string };
type DBQuestion = { id: string; text: string; orderIndex: number };

/**
 * Uses LLM to intelligently parse a realtime interview dialogue into 
 * structured Q&A pairs mapped to pre-generated questions.
 * 
 * This replaces the fragile keyword-overlap approach which fails because
 * the AI rephrases questions in realtime mode.
 */
export async function segmentRealtimeDialogue(
  dialogue: DialogueTurn[],
  questions: DBQuestion[],
  totalDurationMs: number
): Promise<DialogueSegmentationResult> {
  // Build full transcripts for each speaker
  const candidateTurns = dialogue.filter(t => t.speaker === "candidate");
  const interviewerTurns = dialogue.filter(t => t.speaker === "interviewer");
  const fullCandidateTranscript = candidateTurns.map(t => t.text).join(" ").trim();
  const fullInterviewerTranscript = interviewerTurns.map(t => t.text).join(" ").trim();

  // If no candidate speech at all, return empty
  if (!fullCandidateTranscript) {
    console.log("[Realtime Scoring] No candidate speech detected in dialogue.");
    return { mappedAnswers: [], fullCandidateTranscript: "", fullInterviewerTranscript };
  }

  // Format the dialogue for the LLM
  const formattedDialogue = dialogue
    .map((t, i) => `[${i + 1}] ${t.speaker.toUpperCase()}: ${t.text}`)
    .join("\n");

  const questionsList = questions
    .map((q, i) => `Q${i + 1} (id: ${q.id}): ${q.text}`)
    .join("\n");

  const prompt = `You are analyzing a recorded interview dialogue to extract structured question-answer pairs.

INTERVIEW DIALOGUE:
${formattedDialogue}

PRE-GENERATED QUESTIONS (the interviewer was instructed to cover these):
${questionsList}

TASK:
Map the candidate's responses to the pre-generated questions. The interviewer may have rephrased questions slightly, asked follow-ups, or covered them in a different order. Your job is to figure out which candidate responses correspond to which pre-generated question.

RULES:
1. For each pre-generated question that was covered in the dialogue, extract the candidate's full answer (combine multiple candidate turns if they relate to the same question).
2. If a question was NOT covered in the interview, do NOT include it.
3. If the interviewer asked follow-up questions on the same topic, include the candidate's follow-up answers as part of the same question's answer.
4. Be generous in matching — the interviewer may rephrase significantly.
5. Do NOT fabricate answers. Only include text the candidate actually said.

Return a JSON array of objects with this format:
[
  {
    "questionId": "the exact question ID from the list above",
    "candidateAnswer": "the full extracted candidate answer text for this question"
  }
]

Output ONLY valid JSON array. No explanation, no markdown.`;

  try {
    const { adapter } = await getActiveLLMProvider();
    const response = await adapter.chat({
      model: adapter.maxContextTokens["gpt-4o"] ? "gpt-4o" : "default",
      messages: [
        { role: "system", content: "You are an expert interview transcript analyzer. Output valid JSON only." },
        { role: "user", content: prompt },
      ],
      responseFormat: "json",
      temperature: 0.1,
    });

    let cleaned = response.content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }

    const parsed = JSON.parse(cleaned) as unknown;

    // Handle both direct array and wrapped object
    let mappings: Array<{ questionId: string; candidateAnswer: string }>;
    if (Array.isArray(parsed)) {
      mappings = parsed;
    } else if (parsed && typeof parsed === "object") {
      const candidate = (parsed as Record<string, unknown>).mappings ??
        (parsed as Record<string, unknown>).answers ??
        (parsed as Record<string, unknown>).data ??
        (parsed as Record<string, unknown>).results;
      mappings = Array.isArray(candidate) ? candidate : [];
    } else {
      mappings = [];
    }

    // Validate and build result
    const validQuestionIds = new Set(questions.map(q => q.id));
    const answeredCount = mappings.filter(m =>
      validQuestionIds.has(m.questionId) && m.candidateAnswer?.trim()
    ).length;

    // Estimate duration per answer based on total interview duration
    const estimatedDurationPerAnswer = answeredCount > 0
      ? Math.round(totalDurationMs / answeredCount)
      : 30000;

    const mappedAnswers: MappedDialogueAnswer[] = [];
    for (const mapping of mappings) {
      if (!validQuestionIds.has(mapping.questionId)) continue;
      if (!mapping.candidateAnswer?.trim()) continue;

      const question = questions.find(q => q.id === mapping.questionId);
      if (!question) continue;

      mappedAnswers.push({
        questionId: mapping.questionId,
        questionText: question.text,
        candidateAnswer: mapping.candidateAnswer.trim(),
        estimatedDurationMs: estimatedDurationPerAnswer,
      });
    }

    console.log(`[Realtime Scoring] LLM segmentation: ${mappedAnswers.length} answers mapped from ${dialogue.length} dialogue turns.`);
    return { mappedAnswers, fullCandidateTranscript, fullInterviewerTranscript };

  } catch (error) {
    console.error("[Realtime Scoring] LLM segmentation failed, falling back to text-based matching:", error);
    return fallbackTextMapping(dialogue, questions, totalDurationMs, fullCandidateTranscript, fullInterviewerTranscript);
  }
}

/**
 * Fallback: Best-effort text-based matching when LLM is unavailable.
 * Uses a sliding window approach over dialogue turns to match interviewer
 * utterances to pre-generated questions.
 */
function fallbackTextMapping(
  dialogue: DialogueTurn[],
  questions: DBQuestion[],
  totalDurationMs: number,
  fullCandidateTranscript: string,
  fullInterviewerTranscript: string,
): DialogueSegmentationResult {
  const stopWords = new Set([
    "the", "and", "a", "an", "is", "of", "to", "you", "tell", "me", "about",
    "your", "what", "how", "why", "can", "could", "would", "describe", "time",
    "when", "face", "faced", "please", "now", "let", "lets", "start", "with",
    "great", "move", "next", "question", "okay", "so", "that", "this", "for",
    "have", "had", "was", "were", "been", "being", "are", "also", "thank",
  ]);

  function extractKeywords(text: string): Set<string> {
    return new Set(
      text.toLowerCase().replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w))
    );
  }

  function getOverlap(words1: Set<string>, text2Keywords: string[]): number {
    let overlap = 0;
    for (const word of text2Keywords) {
      if (words1.has(word)) overlap++;
    }
    return overlap;
  }

  const answersMap = new Map<string, string>();
  let currentQuestionId = questions[0]?.id || "";
  let activeQIdx = 0;

  for (const turn of dialogue) {
    if (turn.speaker === "interviewer") {
      const turnKeywords = extractKeywords(turn.text);
      let bestMatch = -1;
      let bestScore = 0;

      for (let k = 0; k < questions.length; k++) {
        const qKeywords = Array.from(extractKeywords(questions[k].text));
        const score = getOverlap(turnKeywords, qKeywords);
        // Lower threshold than before (1 instead of 2) since we also check after activeQIdx
        if (score > bestScore && score >= 1) {
          bestScore = score;
          bestMatch = k;
        }
      }

      if (bestMatch >= 0 && bestMatch >= activeQIdx) {
        activeQIdx = bestMatch;
        currentQuestionId = questions[bestMatch].id;
      }
    } else if (turn.speaker === "candidate") {
      if (currentQuestionId) {
        const prevText = answersMap.get(currentQuestionId) || "";
        answersMap.set(currentQuestionId, (prevText + " " + turn.text).trim());
      }
    }
  }

  const answeredCount = Math.max(answersMap.size, 1);
  const estimatedDurationPerAnswer = Math.round(totalDurationMs / answeredCount);

  const mappedAnswers: MappedDialogueAnswer[] = [];
  for (const [questionId, transcript] of answersMap.entries()) {
    if (!transcript.trim()) continue;
    const question = questions.find(q => q.id === questionId);
    if (!question) continue;

    mappedAnswers.push({
      questionId,
      questionText: question.text,
      candidateAnswer: transcript,
      estimatedDurationMs: estimatedDurationPerAnswer,
    });
  }

  console.log(`[Realtime Scoring] Fallback text mapping: ${mappedAnswers.length} answers mapped.`);
  return { mappedAnswers, fullCandidateTranscript, fullInterviewerTranscript };
}
