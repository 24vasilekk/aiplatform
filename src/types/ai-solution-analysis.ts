import { z } from "zod";

export const AI_ANALYSIS_TEXT_LIMITS = {
  question: 4000,
  solution: 12000,
  expectedAnswer: 2000,
  criteriaItem: 500,
  contextChunk: 4000,
} as const;

export const aiAnalysisModeSchema = z.enum(["default", "beginner", "similar_task"]);
export type AiAnalysisMode = z.infer<typeof aiAnalysisModeSchema>;

export const aiAnalysisStatusSchema = z.enum(["queued", "running", "completed", "failed"]);
export type AiAnalysisStatus = z.infer<typeof aiAnalysisStatusSchema>;

export const aiAnalysisSeveritySchema = z.enum(["low", "medium", "high"]);
export type AiAnalysisSeverity = z.infer<typeof aiAnalysisSeveritySchema>;

export const aiCriteriaStatusSchema = z.enum(["met", "partially_met", "not_met", "not_checked"]);
export type AiCriteriaStatus = z.infer<typeof aiCriteriaStatusSchema>;

export const aiAnalysisVerdictSchema = z.enum([
  "correct",
  "partially_correct",
  "incorrect",
  "needs_more_data",
]);
export type AiAnalysisVerdict = z.infer<typeof aiAnalysisVerdictSchema>;

export const aiAnalysisErrorCodeSchema = z.enum([
  "validation_error",
  "unauthorized",
  "forbidden",
  "rate_limited",
  "timeout",
  "model_unavailable",
  "content_policy",
  "unsupported_task_type",
  "internal_error",
]);
export type AiAnalysisErrorCode = z.infer<typeof aiAnalysisErrorCodeSchema>;

export const aiEvaluationCriterionSchema = z.object({
  id: z.string().trim().min(1).max(100),
  label: z.string().trim().min(1).max(200),
  maxPoints: z.number().min(0).max(100).optional(),
});
export type AiEvaluationCriterion = z.infer<typeof aiEvaluationCriterionSchema>;

export const aiAnalysisInputSchema = z
  .object({
    requestId: z.string().trim().min(1).max(120).optional(),
    lessonId: z.string().trim().min(1).max(120).optional(),
    taskId: z.string().trim().min(1).max(120).optional(),
    mode: aiAnalysisModeSchema.default("default"),
    subject: z.enum(["math", "physics"]).optional(),
    questionText: z.string().trim().min(1).max(AI_ANALYSIS_TEXT_LIMITS.question),
    studentSolutionText: z.string().trim().min(1).max(AI_ANALYSIS_TEXT_LIMITS.solution),
    expectedAnswer: z.string().trim().min(1).max(AI_ANALYSIS_TEXT_LIMITS.expectedAnswer).optional(),
    officialCriteria: z.array(aiEvaluationCriterionSchema).max(20).default([]),
    lessonContext: z
      .object({
        summary: z.string().trim().min(1).max(AI_ANALYSIS_TEXT_LIMITS.contextChunk).optional(),
        extractedText: z.string().trim().min(1).max(AI_ANALYSIS_TEXT_LIMITS.contextChunk).optional(),
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.taskId && !value.lessonId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["taskId"],
        message: "Передайте хотя бы taskId или lessonId.",
      });
    }
  });
export type AiAnalysisInput = z.infer<typeof aiAnalysisInputSchema>;

export interface AiAnalysisCriteriaEvaluation {
  criterionId: string;
  label: string;
  status: AiCriteriaStatus;
  earnedPoints?: number;
  maxPoints?: number;
  feedback: string;
}

export interface AiAnalysisMistake {
  code: string;
  message: string;
  severity: AiAnalysisSeverity;
  evidence?: string;
  fixHint: string;
}

export interface AiSimilarTaskSuggestion {
  taskText: string;
  shortAnswer: string;
  firstHint?: string;
}

export interface AiAnalysisResult {
  verdict: AiAnalysisVerdict;
  scorePercent: number;
  conciseSummary: string;
  criteria: AiAnalysisCriteriaEvaluation[];
  mistakes: AiAnalysisMistake[];
  nextSteps: string[];
  rewrittenIdealSolution?: string;
  similarTask?: AiSimilarTaskSuggestion;
}

export interface AiAnalysisError {
  code: AiAnalysisErrorCode;
  message: string;
  retryable: boolean;
  details?: string;
}

export interface AiSolutionAnalysisRecord {
  id: string;
  userId: string;
  lessonId?: string;
  taskId?: string;
  mode: AiAnalysisMode;
  status: AiAnalysisStatus;
  input: AiAnalysisInput;
  result?: AiAnalysisResult;
  error?: AiAnalysisError;
  model?: string;
  latencyMs?: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface AiAnalysisAcceptedResponse {
  ok: true;
  status: "queued" | "running";
  data: Pick<
    AiSolutionAnalysisRecord,
    "id" | "status" | "createdAt" | "updatedAt" | "lessonId" | "taskId" | "mode"
  >;
}

export interface AiAnalysisCompletedResponse {
  ok: true;
  status: "completed";
  data: Pick<
    AiSolutionAnalysisRecord,
    "id" | "status" | "createdAt" | "updatedAt" | "completedAt" | "lessonId" | "taskId" | "mode" | "model" | "latencyMs"
  > & {
    result: AiAnalysisResult;
  };
}

export interface AiAnalysisFailedResponse {
  ok: false;
  status: "failed";
  error: AiAnalysisError;
  data?: Pick<AiSolutionAnalysisRecord, "id" | "status" | "createdAt" | "updatedAt">;
}

export type AiAnalysisApiResponse =
  | AiAnalysisAcceptedResponse
  | AiAnalysisCompletedResponse
  | AiAnalysisFailedResponse;
