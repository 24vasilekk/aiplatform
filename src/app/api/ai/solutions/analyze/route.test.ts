import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  analyzeExpandedSolutionMvpMock: vi.fn(),
  createAiSolutionAnalysisMock: vi.fn(),
  createAnalyticsEventMock: vi.fn(),
  createServiceErrorLogMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireUser: mocks.requireUserMock,
}));

vi.mock("@/lib/ai-solution-analysis", () => ({
  analyzeExpandedSolutionMvp: mocks.analyzeExpandedSolutionMvpMock,
}));

vi.mock("@/lib/db", () => ({
  createAiSolutionAnalysis: mocks.createAiSolutionAnalysisMock,
  createAnalyticsEvent: mocks.createAnalyticsEventMock,
  createServiceErrorLog: mocks.createServiceErrorLogMock,
}));

import { POST } from "@/app/api/ai/solutions/analyze/route";

describe("POST /api/ai/solutions/analyze", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns validation_error for invalid payload", async () => {
    mocks.requireUserMock.mockResolvedValue({
      user: { id: "u1", email: "admin@ege.local", role: "admin" },
      error: null,
    });

    const request = new Request("http://localhost/api/ai/solutions/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "default" }),
    });

    const response = await POST(request as never);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("validation_error");
  });

  it("returns completed response for valid payload", async () => {
    mocks.requireUserMock.mockResolvedValue({
      user: { id: "u1", email: "admin@ege.local", role: "admin" },
      error: null,
    });
    mocks.analyzeExpandedSolutionMvpMock.mockResolvedValue({
      result: {
        verdict: "correct",
        scorePercent: 95,
        conciseSummary: "ok",
        criteria: [],
        mistakes: [],
        nextSteps: ["x"],
      },
      model: "mvp-heuristic-v1",
    });
    mocks.createAiSolutionAnalysisMock.mockResolvedValue({
      id: "analysis-1",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
      completedAt: "2026-04-01T00:00:00.000Z",
      lessonId: null,
      taskId: "task-1",
      mode: "default",
      model: "mvp-heuristic-v1",
      latencyMs: 10,
    });

    const request = new Request("http://localhost/api/ai/solutions/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        taskId: "task-1",
        mode: "default",
        questionText: "Вопрос",
        studentSolutionText: "Развернутый ответ ученика",
      }),
    });

    const response = await POST(request as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("completed");
    expect(data.data.id).toBe("analysis-1");
    expect(mocks.createAiSolutionAnalysisMock).toHaveBeenCalled();
  });
});
