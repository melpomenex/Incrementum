import { describe, expect, it, vi } from "vitest";
import { gradeTypedAnswerSemantic } from "../semanticGrading";

describe("semanticGrading routing", () => {
  it("uses local first when available", async () => {
    const local = vi.fn().mockResolvedValue({
      isCorrect: true,
      similarity: 0.95,
      provider: "local",
    });
    const cloud = vi.fn();
    const result = await gradeTypedAnswerSemantic(
      {
        question: "Q",
        expectedAnswer: "A",
        userAnswer: "A",
        route: "local-first",
      },
      { gradeWithLocal: local, gradeWithCloud: cloud }
    );
    expect(result.provider).toBe("local");
    expect(local).toHaveBeenCalledTimes(1);
    expect(cloud).not.toHaveBeenCalled();
  });

  it("falls back to cloud when local fails", async () => {
    const local = vi.fn().mockRejectedValue(new Error("offline"));
    const cloud = vi.fn().mockResolvedValue({
      isCorrect: true,
      similarity: 0.9,
      provider: "cloud",
    });
    const result = await gradeTypedAnswerSemantic(
      {
        question: "Q",
        expectedAnswer: "A",
        userAnswer: "A",
        route: "local-first",
      },
      { gradeWithLocal: local, gradeWithCloud: cloud }
    );
    expect(result.provider).toBe("cloud");
  });

  it("falls back to heuristic when both providers fail", async () => {
    const result = await gradeTypedAnswerSemantic(
      {
        question: "Q",
        expectedAnswer: "mitochondria",
        userAnswer: "mitochondrion",
        route: "cloud-first",
      },
      {
        gradeWithLocal: vi.fn().mockRejectedValue(new Error("fail")),
        gradeWithCloud: vi.fn().mockRejectedValue(new Error("fail")),
      }
    );
    expect(result.provider).toBe("heuristic");
    expect(result.similarity).toBeGreaterThan(0);
  });
});

