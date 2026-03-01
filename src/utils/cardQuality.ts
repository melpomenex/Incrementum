export interface CardQualityAnalysis {
  score: number;
  issues: string[];
  suggestions: string[];
}

function isPassive(text: string): boolean {
  const lowered = text.toLowerCase();
  return lowered.includes(" is ") && lowered.includes(" by ");
}

export function analyzeCardQuality(question: string, answer: string): CardQualityAnalysis {
  const issues: string[] = [];
  const suggestions: string[] = [];

  const q = question.trim();
  const a = answer.trim();

  if (q.length < 6 || a.length < 2) {
    issues.push("Card content is too short for clear recall.");
    suggestions.push("Add enough detail to disambiguate the target fact.");
  }
  if (q.length > 180 || a.length > 260) {
    issues.push("Card may violate minimum information principle (too broad).");
    suggestions.push("Split into smaller atomic cards.");
  }
  if (!q.includes("?")) {
    issues.push("Question may be ambiguous or prompt-like.");
    suggestions.push("Rewrite as a direct, answerable question.");
  }
  if (isPassive(q)) {
    issues.push("Passive phrasing detected.");
    suggestions.push("Use active phrasing focused on retrieval.");
  }
  if (/this|that|it/i.test(q) && q.length < 40) {
    issues.push("Pronouns without context can make recall ambiguous.");
    suggestions.push("Replace pronouns with explicit nouns.");
  }

  const score = Math.max(0, Math.min(100, 100 - issues.length * 18));
  return { score, issues, suggestions };
}

