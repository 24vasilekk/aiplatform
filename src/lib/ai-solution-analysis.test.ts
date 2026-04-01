import { describe, expect, it } from "vitest";
import { analyzeExpandedSolutionMvp } from "@/lib/ai-solution-analysis";

describe("analyzeExpandedSolutionMvp", () => {
  it("returns beginner-friendly structure in beginner mode", async () => {
    const output = await analyzeExpandedSolutionMvp({
      taskId: "task-1",
      mode: "beginner",
      questionText: "Решите уравнение x^2 - 5x + 6 = 0",
      studentSolutionText: "x^2 - 5x + 6 = 0, корни 2 и 3",
      expectedAnswer: "2 и 3",
      officialCriteria: [],
    });

    expect(output.result.nextSteps.length).toBeGreaterThan(0);
    expect(output.result.rewrittenIdealSolution).toBeTruthy();
  });

  it("adds similar task suggestion in similar_task mode", async () => {
    const output = await analyzeExpandedSolutionMvp({
      taskId: "task-2",
      mode: "similar_task",
      questionText: "Решите квадратное уравнение",
      studentSolutionText: "Решение выполнено.",
      expectedAnswer: "x=1",
      officialCriteria: [],
    });

    expect(output.result.similarTask).toBeTruthy();
    expect(output.result.similarTask?.taskText.length).toBeGreaterThan(0);
  });
});
