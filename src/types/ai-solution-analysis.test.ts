import { describe, expect, it } from "vitest";
import { aiAnalysisInputSchema } from "@/types/ai-solution-analysis";

describe("aiAnalysisInputSchema", () => {
  it("accepts valid payload with taskId", () => {
    const parsed = aiAnalysisInputSchema.safeParse({
      taskId: "task-1",
      mode: "beginner",
      questionText: "Решите уравнение x^2-5x+6=0",
      studentSolutionText: "Преобразуем уравнение и находим корни.",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects payload when both taskId and lessonId are missing", () => {
    const parsed = aiAnalysisInputSchema.safeParse({
      mode: "default",
      questionText: "Вопрос",
      studentSolutionText: "Ответ",
    });

    expect(parsed.success).toBe(false);
  });
});
