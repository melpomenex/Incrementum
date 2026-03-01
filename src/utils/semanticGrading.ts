import { evaluateTypedAnswer } from "./reviewInteractions";

export type SemanticProvider = "local" | "cloud" | "heuristic";

export interface SemanticGradeResult {
  isCorrect: boolean;
  similarity: number;
  provider: SemanticProvider;
}

export interface SemanticGradeInput {
  question: string;
  expectedAnswer: string;
  userAnswer: string;
  route: "local-first" | "cloud-first";
}

interface SemanticGradeDeps {
  gradeWithLocal?: (input: SemanticGradeInput) => Promise<SemanticGradeResult>;
  gradeWithCloud?: (input: SemanticGradeInput) => Promise<SemanticGradeResult>;
}

export async function gradeTypedAnswerSemantic(
  input: SemanticGradeInput,
  deps: SemanticGradeDeps = {}
): Promise<SemanticGradeResult> {
  const tryLocal = async () => {
    if (!deps.gradeWithLocal) throw new Error("local-unavailable");
    return deps.gradeWithLocal(input);
  };
  const tryCloud = async () => {
    if (!deps.gradeWithCloud) throw new Error("cloud-unavailable");
    return deps.gradeWithCloud(input);
  };

  try {
    if (input.route === "local-first") {
      return await tryLocal();
    }
    return await tryCloud();
  } catch {
    try {
      if (input.route === "local-first") {
        return await tryCloud();
      }
      return await tryLocal();
    } catch {
      const heuristic = evaluateTypedAnswer(
        input.userAnswer,
        [input.expectedAnswer],
        "fuzzy"
      );
      return {
        isCorrect: heuristic.isCorrect,
        similarity: heuristic.similarity,
        provider: "heuristic",
      };
    }
  }
}

