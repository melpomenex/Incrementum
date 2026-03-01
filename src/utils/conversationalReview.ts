import { answerQuestion } from "../api/ai";

export interface ConversationalAssessment {
  id: string;
  itemId: string;
  timestamp: string;
  userResponse: string;
  followUpQuestion: string;
  score: number;
  feedback: string;
}

const STORAGE_KEY = "incrementum.conversational-review-assessments";

export async function requestTutorFollowUp(topic: string, userResponse: string): Promise<{ question: string; score: number; feedback: string }> {
  const prompt = [
    `You are a study tutor. Topic: ${topic}.`,
    `Student response: ${userResponse}`,
    "Ask one concise probing follow-up question, then provide a score 0-100 and one-sentence feedback.",
    'Respond as JSON: {"question":"...","score":85,"feedback":"..."}',
  ].join("\n");

  const raw = await answerQuestion(prompt, topic);
  try {
    const parsed = JSON.parse(raw);
    const score = Number(parsed.score);
    return {
      question: String(parsed.question || "Can you explain one concrete example?"),
      score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0,
      feedback: String(parsed.feedback || "Keep practicing active recall."),
    };
  } catch {
    return {
      question: "Can you explain this in your own words with one example?",
      score: 0,
      feedback: raw.slice(0, 200),
    };
  }
}

export function saveConversationalAssessment(assessment: ConversationalAssessment): void {
  const current = getConversationalAssessments();
  const next = [assessment, ...current].slice(0, 500);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function getConversationalAssessments(itemId?: string): ConversationalAssessment[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as ConversationalAssessment[];
    if (!itemId) return parsed;
    return parsed.filter((entry) => entry.itemId === itemId);
  } catch {
    return [];
  }
}
