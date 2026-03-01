export type TypedAnswerMode = "exact" | "fuzzy" | "semantic";

export interface TypedAnswerEvaluation {
  isCorrect: boolean;
  similarity: number;
  matchedAnswer?: string;
}

export interface OrderingEvaluation {
  isCorrect: boolean;
  correctPositions: number;
  total: number;
}

export interface MatchingEvaluation {
  isCorrect: boolean;
  correctPairs: number;
  totalPairs: number;
}

export function normalizeAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "");
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const dp = Array.from({ length: a.length + 1 }, () =>
    Array<number>(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[a.length][b.length];
}

export function evaluateTypedAnswer(
  userAnswer: string,
  acceptedAnswers: string[],
  mode: TypedAnswerMode
): TypedAnswerEvaluation {
  const normalizedUser = normalizeAnswer(userAnswer);
  const normalizedAccepted = acceptedAnswers
    .map((answer) => normalizeAnswer(answer))
    .filter(Boolean);

  if (!normalizedUser || normalizedAccepted.length === 0) {
    return { isCorrect: false, similarity: 0 };
  }

  if (mode === "exact") {
    const matched = normalizedAccepted.find((candidate) => candidate === normalizedUser);
    return {
      isCorrect: Boolean(matched),
      similarity: matched ? 1 : 0,
      matchedAnswer: matched,
    };
  }

  const best = normalizedAccepted.reduce(
    (acc, candidate) => {
      const maxLen = Math.max(candidate.length, normalizedUser.length) || 1;
      const distance = levenshteinDistance(normalizedUser, candidate);
      const similarity = 1 - distance / maxLen;
      if (similarity > acc.similarity) {
        return { similarity, matchedAnswer: candidate };
      }
      return acc;
    },
    { similarity: 0, matchedAnswer: undefined as string | undefined }
  );

  const threshold = mode === "fuzzy" ? 0.84 : 0.88;
  return {
    isCorrect: best.similarity >= threshold,
    similarity: Math.max(0, Math.min(1, best.similarity)),
    matchedAnswer: best.matchedAnswer,
  };
}

export function generateProgressiveHints(answer: string | undefined): string[] {
  const text = (answer ?? "").replace(/\s+/g, " ").trim();
  if (!text) return [];

  const words = text.split(" ").filter(Boolean);
  const hint1 = words.map((w) => (w.length > 0 ? `${w[0]}…` : "")).join(" ");
  const hint2Length = Math.max(1, Math.floor(text.length * 0.45));
  const hint3Length = Math.max(1, Math.floor(text.length * 0.75));
  const hint2 = `${text.slice(0, hint2Length)}…`;
  const hint3 = `${text.slice(0, hint3Length)}…`;

  return [hint1, hint2, hint3];
}

export function evaluateOrdering(
  submitted: string[],
  expected: string[]
): OrderingEvaluation {
  const normalizedSubmitted = submitted.map(normalizeAnswer);
  const normalizedExpected = expected.map(normalizeAnswer);
  const total = normalizedExpected.length;
  if (total === 0 || normalizedSubmitted.length !== total) {
    return { isCorrect: false, correctPositions: 0, total };
  }
  let correctPositions = 0;
  for (let i = 0; i < total; i += 1) {
    if (normalizedSubmitted[i] === normalizedExpected[i]) {
      correctPositions += 1;
    }
  }
  return {
    isCorrect: correctPositions === total,
    correctPositions,
    total,
  };
}

export function evaluateMatching(
  submittedPairs: Array<{ left: string; right: string }>,
  expectedPairs: Array<{ left: string; right: string }>
): MatchingEvaluation {
  const expectedMap = new Map(
    expectedPairs.map((pair) => [normalizeAnswer(pair.left), normalizeAnswer(pair.right)])
  );
  const totalPairs = expectedPairs.length;
  if (totalPairs === 0) {
    return { isCorrect: false, correctPairs: 0, totalPairs: 0 };
  }

  let correctPairs = 0;
  for (const pair of submittedPairs) {
    const left = normalizeAnswer(pair.left);
    const right = normalizeAnswer(pair.right);
    if (expectedMap.get(left) === right) {
      correctPairs += 1;
    }
  }

  return {
    isCorrect: correctPairs === totalPairs,
    correctPairs,
    totalPairs,
  };
}
