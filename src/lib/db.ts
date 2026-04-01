import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { Subject } from "@/lib/mvp-data";
import { extractUploadContent } from "@/lib/attachment-ai";
import { buildDatasetChunks } from "@/lib/dataset-processing";
import type {
  AiAnalysisError,
  AiAnalysisInput,
  AiAnalysisMode,
  AiAnalysisResult,
  AiAnalysisStatus,
} from "@/types/ai-solution-analysis";

export type UserRole = "student" | "admin";

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string | null;
  role: UserRole;
  createdAt: string;
};

export type CourseAccessRecord = {
  id: string;
  userId: string;
  courseId: string;
  accessType: "trial" | "subscription" | "purchase";
  expiresAt: string | null;
};

export type LessonProgressRecord = {
  id: string;
  userId: string;
  lessonId: string;
  status: "not_started" | "in_progress" | "completed";
  lastPositionSec: number;
  updatedAt: string;
};

export type TaskAttemptRecord = {
  id: string;
  userId: string;
  taskId: string;
  answerText: string;
  isCorrect: boolean | null;
  createdAt: string;
};

export type TaskProgressRecord = {
  id: string;
  userId: string;
  taskId: string;
  lessonId: string;
  status: "not_started" | "in_progress" | "completed";
  scorePercent: number | null;
  attemptsCount: number;
  firstCompletedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessageRecord = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  mode: string;
  createdAt: string;
};

export type ChatSessionRecord = {
  id: string;
  userId: string;
  chatType: "lesson" | "global";
  lessonId: string | null;
  createdAt: string;
  messages: ChatMessageRecord[];
};

export type CustomCourseRecord = {
  id: string;
  title: string;
  description: string;
  subject: Subject;
  createdAt: string;
};

export type CustomSectionRecord = {
  id: string;
  courseId: string;
  title: string;
  createdAt: string;
};

export type CustomLessonRecord = {
  id: string;
  sectionId: string;
  title: string;
  description: string;
  videoUrl: string;
  createdAt: string;
};

export type CustomTaskRecord = {
  id: string;
  lessonId: string;
  type: "numeric" | "choice";
  status: "published" | "unpublished" | "archived";
  question: string;
  options: string[] | null;
  answer: string;
  solution: string;
  difficulty: number;
  topicTags: string[];
  exemplarSolution: string | null;
  evaluationCriteria: string[];
  createdAt: string;
};

export type PostRecord = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  publishedAt: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AnalyticsEventName =
  | "login_success"
  | "login_failed"
  | "registration_success"
  | "blog_post_view"
  | "blog_post_share"
  | "site_page_view"
  | "dashboard_view"
  | "course_page_view"
  | "lesson_page_view"
  | "pricing_page_view"
  | "lesson_progress_updated"
  | "task_checked"
  | "ai_chat_message"
  | "ai_solution_analyzed"
  | "checkout_created"
  | "payment_succeeded"
  | "payment_failed"
  | "payment_canceled";

export type AnalyticsEventRecord = {
  id: string;
  eventName: AnalyticsEventName;
  userId: string | null;
  path: string | null;
  payload: unknown;
  createdAt: string;
};

export type AnalyticsEventListResult = {
  rows: AnalyticsEventRecord[];
  total: number;
};

export type RegistrationChannelStats = {
  total: number;
  email: number;
  google: number;
  telegram: number;
};

export type PaymentIntentRecord = {
  id: string;
  userId: string;
  planId: string;
  amountCents: number;
  currency: string;
  status: "created" | "requires_action" | "processing" | "succeeded" | "failed" | "canceled";
  provider: string;
  providerPaymentId: string | null;
  idempotencyKey: string | null;
  checkoutToken: string;
  metadata: string | null;
  failureReason: string | null;
  failedAt: string | null;
  canceledAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentEventRecord = {
  id: string;
  paymentId: string;
  userId: string;
  provider: string;
  providerEventId: string;
  status: PaymentIntentRecord["status"];
  payload: unknown;
  createdAt: string;
};

export type AdminPaymentRecord = {
  id: string;
  userId: string;
  userEmail: string;
  planId: string;
  amountCents: number;
  currency: string;
  status: PaymentIntentRecord["status"];
  provider: string;
  providerPaymentId: string | null;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  failedAt: string | null;
  canceledAt: string | null;
  failureReason: string | null;
};

export type PaymentStatusCountsRecord = {
  created: number;
  requires_action: number;
  processing: number;
  succeeded: number;
  failed: number;
  canceled: number;
  total: number;
};

export type SucceededPaymentForAnalyticsRecord = {
  id: string;
  planId: string;
  amountCents: number;
  currency: string;
  userId: string;
  paidAt: string;
  createdAt: string;
};

export type WalletRecord = {
  id: string;
  userId: string;
  balanceCents: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

export type WalletDirectionRecord = "credit" | "debit";

export type WalletOperationTypeRecord = "topup" | "purchase" | "refund" | "manual_adjustment";

export type WalletTransactionRecord = {
  id: string;
  walletId: string;
  userId: string;
  direction: WalletDirectionRecord;
  operationType: WalletOperationTypeRecord;
  amountCents: number;
  balanceBefore: number;
  balanceAfter: number;
  paymentIntentId: string | null;
  idempotencyKey: string | null;
  metadata: unknown;
  createdAt: string;
};

export type WalletTransactionMutationResult = {
  record: WalletTransactionRecord;
  deduplicated: boolean;
};

export type WalletSnapshotRecord = {
  wallet: WalletRecord;
  transactions: WalletTransactionRecord[];
  totalTransactions: number;
};

export type AdminWalletRecord = {
  id: string;
  userId: string;
  userEmail: string;
  balanceCents: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminWalletTransactionRecord = WalletTransactionRecord & {
  userEmail: string;
};

export type PasswordResetTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
};

export type UserUploadRecord = {
  id: string;
  userId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  extractedText: string | null;
  createdAt: string;
};

export type LessonKnowledgeRecord = {
  id: string;
  lessonId: string;
  originalName: string;
  mimeType: string;
  storagePath: string;
  extractedText: string;
  summary: string | null;
  pageCount: number | null;
  textChars: number;
  createdAt: string;
  updatedAt: string;
};

export type AiSolutionAnalysisRecord = {
  id: string;
  userId: string;
  lessonId: string | null;
  taskId: string | null;
  mode: AiAnalysisMode;
  status: AiAnalysisStatus;
  model: string | null;
  latencyMs: number | null;
  input: AiAnalysisInput;
  result: AiAnalysisResult | null;
  error: AiAnalysisError | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type DatasetFileRecord = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  processingStatus: "uploaded" | "processing" | "parsed" | "ready" | "failed";
  extractedText: string | null;
  summary: string | null;
  pageCount: number | null;
  textChars: number;
  processingError: string | null;
  processedAt: string | null;
  chunkCount: number;
  createdAt: string;
};

export type LearningAnalyticsSnapshotRecord = {
  periodDays: number;
  registrations: number;
  activeUsers: number;
  dau: number;
  wau: number;
  lessonProgressUpdates: number;
  lessonCompletions: number;
  taskAttempts: number;
  taskCorrectAttempts: number;
  aiChatMessages: number;
  aiSolutionAnalyses: number;
  paymentSuccesses: number;
  revenueCents: number;
  paymentConversionPercent: number;
  retentionD1Percent: number;
  retentionD7Percent: number;
};

export type DailyMetricAggregateRecord = {
  day: string;
  dau: number;
  wau: number;
  registrations: number;
  paidUsers: number;
  paymentConversion: number;
  retainedD1: number;
  retainedD7: number;
  aiChatMessages: number;
  revenueCents: number;
};

export type JobQueueRecord = {
  id: string;
  jobType: string;
  payload: unknown;
  status: "pending" | "processing" | "succeeded" | "failed";
  runAt: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type ServiceErrorRecord = {
  id: string;
  requestId: string | null;
  route: string | null;
  level: "debug" | "info" | "warn" | "error" | "fatal";
  message: string;
  details: unknown;
  stack: string | null;
  occurredAt: string;
  userId: string | null;
};

export type ServiceErrorListResult = {
  rows: ServiceErrorRecord[];
  total: number;
};

export type PagedResult<T> = {
  rows: T[];
  total: number;
  take: number;
  skip: number;
};

function uid(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function clampTake(value: number | undefined, fallback: number, max: number) {
  return Math.max(1, Math.min(Math.floor(value ?? fallback), max));
}

function clampSkip(value: number | undefined) {
  return Math.max(0, Math.floor(value ?? 0));
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfUtcDay(date: Date) {
  const start = startOfUtcDay(date);
  return new Date(start.getTime() + DAY_MS);
}

function toIsoDay(date: Date) {
  return startOfUtcDay(date).toISOString();
}

function mapRole(role: "STUDENT" | "ADMIN"): UserRole {
  return role === "ADMIN" ? "admin" : "student";
}

function toUserRecord(user: {
  id: string;
  email: string;
  passwordHash: string | null;
  role: "STUDENT" | "ADMIN";
  createdAt: Date;
}): UserRecord {
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    role: mapRole(user.role),
    createdAt: user.createdAt.toISOString(),
  };
}

function toAccessRecord(access: {
  id: string;
  userId: string;
  courseId: string;
  accessType: "TRIAL" | "SUBSCRIPTION" | "PURCHASE";
  expiresAt: Date | null;
}): CourseAccessRecord {
  return {
    id: access.id,
    userId: access.userId,
    courseId: access.courseId,
    accessType:
      access.accessType === "PURCHASE"
        ? "purchase"
        : access.accessType === "SUBSCRIPTION"
          ? "subscription"
          : "trial",
    expiresAt: access.expiresAt?.toISOString() ?? null,
  };
}

function toProgressRecord(progress: {
  id: string;
  userId: string;
  lessonId: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  lastPositionSec: number;
  updatedAt: Date;
}): LessonProgressRecord {
  return {
    id: progress.id,
    userId: progress.userId,
    lessonId: progress.lessonId,
    status:
      progress.status === "COMPLETED"
        ? "completed"
        : progress.status === "IN_PROGRESS"
          ? "in_progress"
          : "not_started",
    lastPositionSec: progress.lastPositionSec,
    updatedAt: progress.updatedAt.toISOString(),
  };
}

function toTaskProgressRecord(progress: {
  id: string;
  userId: string;
  taskId: string;
  lessonId: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  scorePercent: number | null;
  attemptsCount: number;
  firstCompletedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): TaskProgressRecord {
  return {
    id: progress.id,
    userId: progress.userId,
    taskId: progress.taskId,
    lessonId: progress.lessonId,
    status:
      progress.status === "COMPLETED"
        ? "completed"
        : progress.status === "IN_PROGRESS"
          ? "in_progress"
          : "not_started",
    scorePercent: progress.scorePercent,
    attemptsCount: progress.attemptsCount,
    firstCompletedAt: progress.firstCompletedAt?.toISOString() ?? null,
    completedAt: progress.completedAt?.toISOString() ?? null,
    createdAt: progress.createdAt.toISOString(),
    updatedAt: progress.updatedAt.toISOString(),
  };
}

function toTaskRecord(task: {
  id: string;
  lessonId: string;
  type: "numeric" | "choice";
  status: "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED";
  question: string;
  options: string | null;
  answer: string;
  solution: string;
  difficulty: number;
  topicTags: string | null;
  exemplarSolution: string | null;
  evaluationCriteria: string | null;
  createdAt: Date;
}): CustomTaskRecord {
  return {
    id: task.id,
    lessonId: task.lessonId,
    type: task.type,
    status:
      task.status === "ARCHIVED" ? "archived" : task.status === "UNPUBLISHED" ? "unpublished" : "published",
    question: task.question,
    options: task.options ? (JSON.parse(task.options) as string[]) : null,
    answer: task.answer,
    solution: task.solution,
    difficulty: task.difficulty,
    topicTags: task.topicTags ? (JSON.parse(task.topicTags) as string[]) : [],
    exemplarSolution: task.exemplarSolution,
    evaluationCriteria: task.evaluationCriteria ? (JSON.parse(task.evaluationCriteria) as string[]) : [],
    createdAt: task.createdAt.toISOString(),
  };
}

function toPaymentRecord(payment: {
  id: string;
  userId: string;
  planId: string;
  amountCents: number;
  currency: string;
  status: "CREATED" | "REQUIRES_ACTION" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELED";
  provider: string;
  providerPaymentId: string | null;
  idempotencyKey: string | null;
  checkoutToken: string;
  metadata: string | null;
  failureReason: string | null;
  failedAt: Date | null;
  canceledAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): PaymentIntentRecord {
  return {
    id: payment.id,
    userId: payment.userId,
    planId: payment.planId,
    amountCents: payment.amountCents,
    currency: payment.currency,
    status: payment.status.toLowerCase() as PaymentIntentRecord["status"],
    provider: payment.provider,
    providerPaymentId: payment.providerPaymentId,
    idempotencyKey: payment.idempotencyKey,
    checkoutToken: payment.checkoutToken,
    metadata: payment.metadata,
    failureReason: payment.failureReason,
    failedAt: payment.failedAt?.toISOString() ?? null,
    canceledAt: payment.canceledAt?.toISOString() ?? null,
    paidAt: payment.paidAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  };
}

function toPostRecord(post: {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  publishedAt: Date | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}): PostRecord {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    content: post.content,
    coverImage: post.coverImage,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    isPublished: post.isPublished,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

function toAnalyticsEventRecord(event: {
  id: string;
  eventName: string;
  userId: string | null;
  path: string | null;
  payload: unknown;
  createdAt: Date;
}): AnalyticsEventRecord {
  return {
    id: event.id,
    eventName: event.eventName as AnalyticsEventName,
    userId: event.userId,
    path: event.path,
    payload: event.payload ?? null,
    createdAt: event.createdAt.toISOString(),
  };
}

function toPaymentEventRecord(event: {
  id: string;
  paymentId: string;
  userId: string;
  provider: string;
  providerEventId: string;
  status: "CREATED" | "REQUIRES_ACTION" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELED";
  payload: unknown;
  createdAt: Date;
}): PaymentEventRecord {
  return {
    id: event.id,
    paymentId: event.paymentId,
    userId: event.userId,
    provider: event.provider,
    providerEventId: event.providerEventId,
    status: event.status.toLowerCase() as PaymentEventRecord["status"],
    payload: event.payload ?? null,
    createdAt: event.createdAt.toISOString(),
  };
}

function toAdminPaymentRecord(row: {
  id: string;
  userId: string;
  planId: string;
  amountCents: number;
  currency: string;
  status: "CREATED" | "REQUIRES_ACTION" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELED";
  provider: string;
  providerPaymentId: string | null;
  idempotencyKey: string | null;
  createdAt: Date;
  updatedAt: Date;
  paidAt: Date | null;
  failedAt: Date | null;
  canceledAt: Date | null;
  failureReason: string | null;
  user: {
    email: string;
  };
}): AdminPaymentRecord {
  return {
    id: row.id,
    userId: row.userId,
    userEmail: row.user.email,
    planId: row.planId,
    amountCents: row.amountCents,
    currency: row.currency,
    status: row.status.toLowerCase() as AdminPaymentRecord["status"],
    provider: row.provider,
    providerPaymentId: row.providerPaymentId,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    paidAt: row.paidAt?.toISOString() ?? null,
    failedAt: row.failedAt?.toISOString() ?? null,
    canceledAt: row.canceledAt?.toISOString() ?? null,
    failureReason: row.failureReason,
  };
}

function toDailyMetricAggregateRecord(row: {
  day: Date;
  dau: number;
  wau: number;
  registrations: number;
  paidUsers: number;
  paymentConversion: number;
  retainedD1: number;
  retainedD7: number;
  aiChatMessages: number;
  revenueCents: number;
}): DailyMetricAggregateRecord {
  return {
    day: row.day.toISOString(),
    dau: row.dau,
    wau: row.wau,
    registrations: row.registrations,
    paidUsers: row.paidUsers,
    paymentConversion: row.paymentConversion,
    retainedD1: row.retainedD1,
    retainedD7: row.retainedD7,
    aiChatMessages: row.aiChatMessages,
    revenueCents: row.revenueCents,
  };
}

function toWalletRecord(row: {
  id: string;
  userId: string;
  balanceCents: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}): WalletRecord {
  return {
    id: row.id,
    userId: row.userId,
    balanceCents: row.balanceCents,
    currency: row.currency,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toWalletDirection(direction: "CREDIT" | "DEBIT"): WalletDirectionRecord {
  return direction === "DEBIT" ? "debit" : "credit";
}

function toWalletOperationType(
  operationType: "TOPUP" | "PURCHASE" | "REFUND" | "MANUAL_ADJUSTMENT",
): WalletOperationTypeRecord {
  if (operationType === "PURCHASE") return "purchase";
  if (operationType === "REFUND") return "refund";
  if (operationType === "MANUAL_ADJUSTMENT") return "manual_adjustment";
  return "topup";
}

function mapWalletDirection(direction: WalletDirectionRecord): "CREDIT" | "DEBIT" {
  return direction === "debit" ? "DEBIT" : "CREDIT";
}

function mapWalletOperationType(
  operationType: WalletOperationTypeRecord,
): "TOPUP" | "PURCHASE" | "REFUND" | "MANUAL_ADJUSTMENT" {
  if (operationType === "purchase") return "PURCHASE";
  if (operationType === "refund") return "REFUND";
  if (operationType === "manual_adjustment") return "MANUAL_ADJUSTMENT";
  return "TOPUP";
}

function toWalletTransactionRecord(row: {
  id: string;
  walletId: string;
  userId: string;
  direction: "CREDIT" | "DEBIT";
  operationType: "TOPUP" | "PURCHASE" | "REFUND" | "MANUAL_ADJUSTMENT";
  amountCents: number;
  balanceBefore: number;
  balanceAfter: number;
  paymentIntentId: string | null;
  idempotencyKey: string | null;
  metadata: unknown;
  createdAt: Date;
}): WalletTransactionRecord {
  return {
    id: row.id,
    walletId: row.walletId,
    userId: row.userId,
    direction: toWalletDirection(row.direction),
    operationType: toWalletOperationType(row.operationType),
    amountCents: row.amountCents,
    balanceBefore: row.balanceBefore,
    balanceAfter: row.balanceAfter,
    paymentIntentId: row.paymentIntentId,
    idempotencyKey: row.idempotencyKey,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toAdminWalletRecord(row: {
  id: string;
  userId: string;
  balanceCents: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  user: { email: string };
}): AdminWalletRecord {
  return {
    id: row.id,
    userId: row.userId,
    userEmail: row.user.email,
    balanceCents: row.balanceCents,
    currency: row.currency,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toJobQueueRecord(row: {
  id: string;
  jobType: string;
  payload: unknown;
  status: "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED";
  runAt: Date;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  idempotencyKey: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}): JobQueueRecord {
  return {
    id: row.id,
    jobType: row.jobType,
    payload: row.payload ?? null,
    status: row.status.toLowerCase() as JobQueueRecord["status"],
    runAt: row.runAt.toISOString(),
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    lastError: row.lastError,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

function toServiceErrorRecord(row: {
  id: string;
  requestId: string | null;
  route: string | null;
  level: "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
  message: string;
  details: unknown;
  stack: string | null;
  occurredAt: Date;
  userId: string | null;
}): ServiceErrorRecord {
  return {
    id: row.id,
    requestId: row.requestId,
    route: row.route,
    level:
      row.level === "FATAL"
        ? "fatal"
        : row.level === "ERROR"
          ? "error"
          : row.level === "WARN"
            ? "warn"
            : row.level === "INFO"
              ? "info"
              : "debug",
    message: row.message,
    details: row.details ?? null,
    stack: row.stack,
    occurredAt: row.occurredAt.toISOString(),
    userId: row.userId,
  };
}

export async function findUserByEmail(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  return user ? toUserRecord(user) : null;
}

export async function findUserById(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user ? toUserRecord(user) : null;
}

export async function createUser(input: { email: string; passwordHash: string; role?: UserRole }) {
  const role = input.role === "admin" ? "ADMIN" : "STUDENT";
  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      role,
      accesses: {
        create: {
          courseId: "math-base",
          accessType: "TRIAL",
        },
      },
    },
  });

  return toUserRecord(user);
}

export async function findOrCreateOAuthUser(input: {
  provider: "google";
  providerAccountId: string;
  email: string;
}) {
  const provider = input.provider;
  const providerAccountId = input.providerAccountId.trim();
  const email = input.email.toLowerCase().trim();

  if (!providerAccountId || !email) {
    throw new Error("Missing OAuth identity");
  }

  const runInTransaction = () =>
    prisma.$transaction(async (tx) => {
      const linkedAccount = await tx.authAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider,
            providerAccountId,
          },
        },
        include: { user: true },
      });
      if (linkedAccount) return toUserRecord(linkedAccount.user);

      const existingUser = await tx.user.findUnique({ where: { email } });
      if (existingUser) {
        await tx.authAccount.create({
          data: {
            userId: existingUser.id,
            provider,
            providerAccountId,
          },
        });
        return toUserRecord(existingUser);
      }

      const role = email === "admin@ege.local" ? "ADMIN" : "STUDENT";
      const createdUser = await tx.user.create({
        data: {
          email,
          passwordHash: null,
          role,
          accesses: {
            create: {
              courseId: "math-base",
              accessType: "TRIAL",
            },
          },
          authAccounts: {
            create: {
              provider,
              providerAccountId,
            },
          },
        },
      });

      return toUserRecord(createdUser);
    });

  try {
    return await runInTransaction();
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }

    const linkedAccount = await prisma.authAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId,
        },
      },
      include: { user: true },
    });
    if (linkedAccount) return toUserRecord(linkedAccount.user);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (!existingUser) throw error;

    try {
      await prisma.authAccount.create({
        data: {
          userId: existingUser.id,
          provider,
          providerAccountId,
        },
      });
    } catch {
      // Concurrent request may have linked this account first.
    }

    return toUserRecord(existingUser);
  }
}

export async function findOrLinkTelegramUser(input: {
  telegramId: string;
  currentUserId?: string | null;
}) {
  const provider = "telegram";
  const providerAccountId = input.telegramId.trim();
  const currentUserId = input.currentUserId?.trim() || null;

  if (!providerAccountId) {
    throw new Error("Missing Telegram identity");
  }

  const runInTransaction = () =>
    prisma.$transaction(async (tx) => {
      const linkedAccount = await tx.authAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider,
            providerAccountId,
          },
        },
        include: { user: true },
      });
      if (linkedAccount) {
        if (currentUserId && linkedAccount.userId !== currentUserId) {
          throw new Error("TELEGRAM_ALREADY_LINKED");
        }
        return toUserRecord(linkedAccount.user);
      }

      if (currentUserId) {
        const currentUser = await tx.user.findUnique({ where: { id: currentUserId } });
        if (!currentUser) throw new Error("Current user not found");

        await tx.authAccount.create({
          data: {
            userId: currentUser.id,
            provider,
            providerAccountId,
          },
        });
        return toUserRecord(currentUser);
      }

      const email = `tg_${providerAccountId}@telegram.local`;
      const role = email === "admin@ege.local" ? "ADMIN" : "STUDENT";
      const createdUser = await tx.user.create({
        data: {
          email,
          passwordHash: null,
          role,
          accesses: {
            create: {
              courseId: "math-base",
              accessType: "TRIAL",
            },
          },
          authAccounts: {
            create: {
              provider,
              providerAccountId,
            },
          },
        },
      });

      return toUserRecord(createdUser);
    });

  try {
    return await runInTransaction();
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }

    const linkedAccount = await prisma.authAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId,
        },
      },
      include: { user: true },
    });
    if (linkedAccount) {
      if (currentUserId && linkedAccount.userId !== currentUserId) {
        throw new Error("TELEGRAM_ALREADY_LINKED");
      }
      return toUserRecord(linkedAccount.user);
    }

    if (currentUserId) {
      const currentUser = await prisma.user.findUnique({ where: { id: currentUserId } });
      if (!currentUser) throw error;

      try {
        await prisma.authAccount.create({
          data: {
            userId: currentUser.id,
            provider,
            providerAccountId,
          },
        });
      } catch {
        // Concurrent request may have linked this account first.
      }

      return toUserRecord(currentUser);
    }

    const fallbackEmail = `tg_${providerAccountId}@telegram.local`;
    const existingUser = await prisma.user.findUnique({ where: { email: fallbackEmail } });
    if (existingUser) return toUserRecord(existingUser);

    throw error;
  }
}

export async function listCourseAccess(userId: string) {
  const accesses = await prisma.courseAccess.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return accesses.map(toAccessRecord);
}

export async function hasCourseAccess(userId: string, courseId: string) {
  const now = new Date();
  const count = await prisma.courseAccess.count({
    where: {
      userId,
      courseId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });

  return count > 0;
}

export async function grantCourseAccess(
  userId: string,
  courseId: string,
  accessType: CourseAccessRecord["accessType"] = "subscription",
  expiresAt?: Date | null,
) {
  await prisma.courseAccess.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: {
      accessType:
        accessType === "purchase" ? "PURCHASE" : accessType === "subscription" ? "SUBSCRIPTION" : "TRIAL",
      expiresAt: expiresAt ?? null,
    },
    create: {
      userId,
      courseId,
      accessType:
        accessType === "purchase" ? "PURCHASE" : accessType === "subscription" ? "SUBSCRIPTION" : "TRIAL",
      expiresAt: expiresAt ?? null,
    },
  });
}

export async function saveLessonProgress(input: {
  userId: string;
  lessonId: string;
  status: LessonProgressRecord["status"];
  lastPositionSec: number;
}) {
  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: input.userId, lessonId: input.lessonId } },
    update: {
      status:
        input.status === "completed"
          ? "COMPLETED"
          : input.status === "in_progress"
            ? "IN_PROGRESS"
            : "NOT_STARTED",
      lastPositionSec: Math.max(0, Math.floor(input.lastPositionSec || 0)),
    },
    create: {
      userId: input.userId,
      lessonId: input.lessonId,
      status:
        input.status === "completed"
          ? "COMPLETED"
          : input.status === "in_progress"
            ? "IN_PROGRESS"
            : "NOT_STARTED",
      lastPositionSec: Math.max(0, Math.floor(input.lastPositionSec || 0)),
    },
  });
}

export async function listProgress(userId: string) {
  const rows = await prisma.lessonProgress.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(toProgressRecord);
}

export async function listTaskProgress(input: { userId: string; lessonId?: string }) {
  const rows = await prisma.taskProgress.findMany({
    where: {
      userId: input.userId,
      lessonId: input.lessonId,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toTaskProgressRecord);
}

export async function saveTaskAttempt(input: {
  userId: string;
  taskId: string;
  lessonId: string;
  answerText: string;
  isCorrect: boolean;
}) {
  await prisma.$transaction(async (tx) => {
    await tx.taskAttempt.create({
      data: {
        userId: input.userId,
        taskId: input.taskId,
        answerText: input.answerText,
        isCorrect: input.isCorrect,
      },
    });

    const existing = await tx.taskProgress.findUnique({
      where: {
        userId_taskId: {
          userId: input.userId,
          taskId: input.taskId,
        },
      },
    });

    const now = new Date();
    const status = input.isCorrect ? "COMPLETED" : "IN_PROGRESS";
    const scorePercent = input.isCorrect ? 100 : 0;

    if (!existing) {
      await tx.taskProgress.create({
        data: {
          userId: input.userId,
          taskId: input.taskId,
          lessonId: input.lessonId,
          status,
          scorePercent,
          attemptsCount: 1,
          firstCompletedAt: input.isCorrect ? now : null,
          completedAt: input.isCorrect ? now : null,
        },
      });
      return;
    }

    await tx.taskProgress.update({
      where: { id: existing.id },
      data: {
        lessonId: input.lessonId || existing.lessonId,
        status: existing.status === "COMPLETED" ? "COMPLETED" : status,
        scorePercent: Math.max(existing.scorePercent ?? 0, scorePercent),
        attemptsCount: { increment: 1 },
        firstCompletedAt: existing.firstCompletedAt ?? (input.isCorrect ? now : null),
        completedAt: input.isCorrect ? now : existing.completedAt,
      },
    });
  });
}

async function ensureChatSession(input: {
  userId: string;
  chatType: ChatSessionRecord["chatType"];
  lessonId: string | null;
}) {
  const existing = await prisma.chatSession.findFirst({
    where: {
      userId: input.userId,
      chatType: input.chatType === "lesson" ? "LESSON" : "GLOBAL",
      lessonId: input.lessonId,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.chatSession.create({
    data: {
      userId: input.userId,
      chatType: input.chatType === "lesson" ? "LESSON" : "GLOBAL",
      lessonId: input.lessonId,
    },
  });
}

export async function listChatMessages(input: {
  userId: string;
  chatType: ChatSessionRecord["chatType"];
  lessonId: string | null;
}) {
  const session = await ensureChatSession(input);
  const messages = await prisma.chatMessage.findMany({
    where: { chatId: session.id },
    orderBy: { createdAt: "asc" },
  });

  return messages.map((message) => ({
    id: message.id,
    role: message.role.toLowerCase() as ChatMessageRecord["role"],
    content: message.content,
    mode: message.mode,
    createdAt: message.createdAt.toISOString(),
  }));
}

export async function addChatMessage(input: {
  userId: string;
  chatType: ChatSessionRecord["chatType"];
  lessonId: string | null;
  role: ChatMessageRecord["role"];
  content: string;
  mode?: string;
}) {
  const session = await ensureChatSession(input);
  const message = await prisma.chatMessage.create({
    data: {
      chatId: session.id,
      role: input.role.toUpperCase() as "USER" | "ASSISTANT" | "SYSTEM",
      content: input.content,
      mode: input.mode ?? "default",
    },
  });

  return {
    id: message.id,
    role: message.role.toLowerCase() as ChatMessageRecord["role"],
    content: message.content,
    mode: message.mode,
    createdAt: message.createdAt.toISOString(),
  };
}

export async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      role: true,
      createdAt: true,
    },
  });
  return users.map(toUserRecord);
}

export async function listUsersPaged(input?: {
  query?: string;
  role?: UserRole;
  take?: number;
  skip?: number;
}): Promise<PagedResult<UserRecord>> {
  const take = clampTake(input?.take, 100, 500);
  const skip = clampSkip(input?.skip);
  const query = input?.query?.trim();

  const where: Prisma.UserWhereInput = {
    role: input?.role ? (input.role === "admin" ? "ADMIN" : "STUDENT") : undefined,
    OR: query
      ? [
          {
            email: {
              contains: query.toLowerCase(),
              mode: "insensitive",
            },
          },
          {
            id: {
              contains: query,
            },
          },
        ]
      : undefined,
  };

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    rows: rows.map(toUserRecord),
    total,
    take,
    skip,
  };
}

export async function listCustomCourses() {
  const courses = await prisma.customCourse.findMany({ orderBy: { createdAt: "asc" } });
  return courses.map((course) => ({
    id: course.id,
    title: course.title,
    description: course.description,
    subject: course.subject,
    createdAt: course.createdAt.toISOString(),
  }));
}

export async function listCustomCoursesPaged(input?: {
  take?: number;
  skip?: number;
}): Promise<PagedResult<CustomCourseRecord>> {
  const take = clampTake(input?.take, 200, 500);
  const skip = clampSkip(input?.skip);
  const [rows, total] = await Promise.all([
    prisma.customCourse.findMany({
      orderBy: { createdAt: "asc" },
      take,
      skip,
    }),
    prisma.customCourse.count(),
  ]);
  return {
    rows: rows.map((course) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      subject: course.subject,
      createdAt: course.createdAt.toISOString(),
    })),
    total,
    take,
    skip,
  };
}

export async function createCustomCourse(input: {
  title: string;
  description: string;
  subject: Subject;
}) {
  const course = await prisma.customCourse.create({
    data: {
      id: `custom-${uid("course")}`,
      title: input.title,
      description: input.description,
      subject: input.subject,
    },
  });

  return {
    id: course.id,
    title: course.title,
    description: course.description,
    subject: course.subject,
    createdAt: course.createdAt.toISOString(),
  };
}

export async function updateCustomCourse(
  courseId: string,
  input: { title?: string; description?: string; subject?: Subject },
) {
  try {
    const course = await prisma.customCourse.update({
      where: { id: courseId },
      data: {
        title: input.title,
        description: input.description,
        subject: input.subject,
      },
    });

    return {
      id: course.id,
      title: course.title,
      description: course.description,
      subject: course.subject,
      createdAt: course.createdAt.toISOString(),
    };
  } catch {
    return null;
  }
}

export async function deleteCustomCourse(courseId: string) {
  try {
    await prisma.customCourse.delete({ where: { id: courseId } });
    await prisma.courseAccess.deleteMany({ where: { courseId } });
    return true;
  } catch {
    return false;
  }
}

export async function listCustomSections() {
  const sections = await prisma.customSection.findMany({ orderBy: { createdAt: "asc" } });
  return sections.map((section) => ({
    id: section.id,
    courseId: section.courseId,
    title: section.title,
    createdAt: section.createdAt.toISOString(),
  }));
}

export async function listCustomSectionsPaged(input?: {
  courseId?: string;
  take?: number;
  skip?: number;
}): Promise<PagedResult<CustomSectionRecord>> {
  const take = clampTake(input?.take, 300, 700);
  const skip = clampSkip(input?.skip);
  const where: Prisma.CustomSectionWhereInput = {
    courseId: input?.courseId,
  };
  const [rows, total] = await Promise.all([
    prisma.customSection.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take,
      skip,
    }),
    prisma.customSection.count({ where }),
  ]);
  return {
    rows: rows.map((section) => ({
      id: section.id,
      courseId: section.courseId,
      title: section.title,
      createdAt: section.createdAt.toISOString(),
    })),
    total,
    take,
    skip,
  };
}

export async function createCustomSection(input: { courseId: string; title: string }) {
  const section = await prisma.customSection.create({
    data: {
      id: `custom-${uid("section")}`,
      courseId: input.courseId,
      title: input.title,
    },
  });

  return {
    id: section.id,
    courseId: section.courseId,
    title: section.title,
    createdAt: section.createdAt.toISOString(),
  };
}

export async function updateCustomSection(sectionId: string, input: { title?: string }) {
  try {
    const section = await prisma.customSection.update({
      where: { id: sectionId },
      data: { title: input.title },
    });

    return {
      id: section.id,
      courseId: section.courseId,
      title: section.title,
      createdAt: section.createdAt.toISOString(),
    };
  } catch {
    return null;
  }
}

export async function deleteCustomSection(sectionId: string) {
  try {
    await prisma.customSection.delete({ where: { id: sectionId } });
    return true;
  } catch {
    return false;
  }
}

export async function findCustomSectionById(sectionId: string) {
  const section = await prisma.customSection.findUnique({
    where: { id: sectionId },
  });
  if (!section) return null;
  return {
    id: section.id,
    courseId: section.courseId,
    title: section.title,
    createdAt: section.createdAt.toISOString(),
  } satisfies CustomSectionRecord;
}

export async function listCustomLessons() {
  const lessons = await prisma.customLesson.findMany({ orderBy: { createdAt: "asc" } });
  return lessons.map((lesson) => ({
    id: lesson.id,
    sectionId: lesson.sectionId,
    title: lesson.title,
    description: lesson.description,
    videoUrl: lesson.videoUrl,
    createdAt: lesson.createdAt.toISOString(),
  }));
}

export async function listCustomLessonsPaged(input?: {
  sectionId?: string;
  take?: number;
  skip?: number;
}): Promise<PagedResult<CustomLessonRecord>> {
  const take = clampTake(input?.take, 400, 1000);
  const skip = clampSkip(input?.skip);
  const where: Prisma.CustomLessonWhereInput = {
    sectionId: input?.sectionId,
  };

  const [rows, total] = await Promise.all([
    prisma.customLesson.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take,
      skip,
    }),
    prisma.customLesson.count({ where }),
  ]);

  return {
    rows: rows.map((lesson) => ({
      id: lesson.id,
      sectionId: lesson.sectionId,
      title: lesson.title,
      description: lesson.description,
      videoUrl: lesson.videoUrl,
      createdAt: lesson.createdAt.toISOString(),
    })),
    total,
    take,
    skip,
  };
}

export async function findCustomLessonById(lessonId: string) {
  const lesson = await prisma.customLesson.findUnique({
    where: { id: lessonId },
  });
  if (!lesson) return null;
  return {
    id: lesson.id,
    sectionId: lesson.sectionId,
    title: lesson.title,
    description: lesson.description,
    videoUrl: lesson.videoUrl,
    createdAt: lesson.createdAt.toISOString(),
  } satisfies CustomLessonRecord;
}

export async function createCustomLesson(input: {
  sectionId: string;
  title: string;
  description: string;
  videoUrl: string;
}) {
  const lesson = await prisma.customLesson.create({
    data: {
      id: `custom-${uid("lesson")}`,
      sectionId: input.sectionId,
      title: input.title,
      description: input.description,
      videoUrl: input.videoUrl,
    },
  });

  return {
    id: lesson.id,
    sectionId: lesson.sectionId,
    title: lesson.title,
    description: lesson.description,
    videoUrl: lesson.videoUrl,
    createdAt: lesson.createdAt.toISOString(),
  };
}

export async function updateCustomLesson(
  lessonId: string,
  input: { title?: string; description?: string; videoUrl?: string },
) {
  try {
    const lesson = await prisma.customLesson.update({
      where: { id: lessonId },
      data: {
        title: input.title,
        description: input.description,
        videoUrl: input.videoUrl,
      },
    });

    return {
      id: lesson.id,
      sectionId: lesson.sectionId,
      title: lesson.title,
      description: lesson.description,
      videoUrl: lesson.videoUrl,
      createdAt: lesson.createdAt.toISOString(),
    };
  } catch {
    return null;
  }
}

export async function deleteCustomLesson(lessonId: string) {
  try {
    await prisma.customLesson.delete({ where: { id: lessonId } });
    return true;
  } catch {
    return false;
  }
}

export async function listCustomTasks() {
  const tasks = await prisma.customTask.findMany({ orderBy: { createdAt: "asc" } });
  return tasks.map(toTaskRecord);
}

export async function listCustomTasksPaged(input?: {
  lessonId?: string;
  status?: CustomTaskRecord["status"];
  take?: number;
  skip?: number;
}): Promise<PagedResult<CustomTaskRecord>> {
  const take = clampTake(input?.take, 500, 1200);
  const skip = clampSkip(input?.skip);
  const where: Prisma.CustomTaskWhereInput = {
    lessonId: input?.lessonId,
    status:
      input?.status === "archived"
        ? "ARCHIVED"
        : input?.status === "unpublished"
          ? "UNPUBLISHED"
          : input?.status === "published"
            ? "PUBLISHED"
            : undefined,
  };

  const [rows, total] = await Promise.all([
    prisma.customTask.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take,
      skip,
    }),
    prisma.customTask.count({ where }),
  ]);

  return {
    rows: rows.map(toTaskRecord),
    total,
    take,
    skip,
  };
}

export async function listCustomTasksByLessonId(lessonId: string) {
  const tasks = await prisma.customTask.findMany({
    where: { lessonId },
    orderBy: { createdAt: "asc" },
  });
  return tasks.map(toTaskRecord);
}

export async function listCustomTasksByLessonIds(
  lessonIds: string[],
  options?: { publishedOnly?: boolean },
) {
  if (lessonIds.length === 0) {
    return [] as CustomTaskRecord[];
  }
  const tasks = await prisma.customTask.findMany({
    where: {
      lessonId: { in: lessonIds },
      status: options?.publishedOnly ? "PUBLISHED" : undefined,
    },
    orderBy: { createdAt: "asc" },
  });
  return tasks.map(toTaskRecord);
}

export async function findCustomTaskById(taskId: string) {
  const task = await prisma.customTask.findUnique({ where: { id: taskId } });
  return task ? toTaskRecord(task) : null;
}

export async function createCustomTask(input: {
  lessonId: string;
  type: "numeric" | "choice";
  status?: "published" | "unpublished" | "archived";
  question: string;
  options?: string[] | null;
  answer: string;
  solution: string;
  difficulty?: number;
  topicTags?: string[];
  exemplarSolution?: string | null;
  evaluationCriteria?: string[];
}) {
  const task = await prisma.customTask.create({
    data: {
      id: `custom-${uid("task")}`,
      lessonId: input.lessonId,
      type: input.type,
      status:
        input.status === "archived"
          ? "ARCHIVED"
          : input.status === "unpublished"
            ? "UNPUBLISHED"
            : "PUBLISHED",
      question: input.question,
      options: input.type === "choice" ? JSON.stringify(input.options ?? []) : null,
      answer: input.answer,
      solution: input.solution,
      difficulty: Math.max(1, Math.min(5, Math.floor(input.difficulty ?? 2))),
      topicTags: input.topicTags && input.topicTags.length > 0 ? JSON.stringify(input.topicTags) : null,
      exemplarSolution: input.exemplarSolution ?? null,
      evaluationCriteria:
        input.evaluationCriteria && input.evaluationCriteria.length > 0
          ? JSON.stringify(input.evaluationCriteria)
          : null,
    },
  });

  return toTaskRecord(task);
}

export async function updateCustomTask(
  taskId: string,
  input: {
    type?: "numeric" | "choice";
    status?: "published" | "unpublished" | "archived";
    question?: string;
    options?: string[] | null;
    answer?: string;
    solution?: string;
    lessonId?: string;
    difficulty?: number;
    topicTags?: string[];
    exemplarSolution?: string | null;
    evaluationCriteria?: string[];
  },
) {
  try {
    const existing = await prisma.customTask.findUnique({ where: { id: taskId } });
    if (!existing) return null;

    const finalType = input.type ?? existing.type;
    const nextOptions =
      input.options !== undefined
        ? input.options
        : existing.options
          ? (JSON.parse(existing.options) as string[])
          : null;

    const task = await prisma.customTask.update({
      where: { id: taskId },
      data: {
        lessonId: input.lessonId,
        status:
          input.status === undefined
            ? undefined
            : input.status === "archived"
              ? "ARCHIVED"
              : input.status === "unpublished"
                ? "UNPUBLISHED"
                : "PUBLISHED",
        type: finalType,
        question: input.question,
        answer: input.answer,
        solution: input.solution,
        options: finalType === "choice" ? JSON.stringify(nextOptions ?? []) : null,
        difficulty:
          input.difficulty === undefined
            ? undefined
            : Math.max(1, Math.min(5, Math.floor(input.difficulty))),
        topicTags:
          input.topicTags === undefined
            ? undefined
            : input.topicTags.length > 0
              ? JSON.stringify(input.topicTags)
              : null,
        exemplarSolution: input.exemplarSolution,
        evaluationCriteria:
          input.evaluationCriteria === undefined
            ? undefined
            : input.evaluationCriteria.length > 0
              ? JSON.stringify(input.evaluationCriteria)
              : null,
      },
    });

    return toTaskRecord(task);
  } catch {
    return null;
  }
}

export async function deleteCustomTask(taskId: string) {
  try {
    await prisma.customTask.delete({ where: { id: taskId } });
    return true;
  } catch {
    return false;
  }
}

export async function listPosts() {
  const posts = await prisma.post.findMany({
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
  return posts.map(toPostRecord);
}

export async function findPostBySlug(slug: string) {
  const post = await prisma.post.findUnique({ where: { slug } });
  return post ? toPostRecord(post) : null;
}

export async function listPublishedPosts() {
  const now = new Date();
  const posts = await prisma.post.findMany({
    where: {
      isPublished: true,
      OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
  return posts.map(toPostRecord);
}

export async function findPublishedPostBySlug(slug: string) {
  const now = new Date();
  const post = await prisma.post.findFirst({
    where: {
      slug,
      isPublished: true,
      OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
    },
  });
  return post ? toPostRecord(post) : null;
}

export async function createPost(input: {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage?: string | null;
  publishedAt?: Date | null;
  isPublished?: boolean;
}) {
  try {
    const post = await prisma.post.create({
      data: {
        slug: input.slug,
        title: input.title,
        excerpt: input.excerpt,
        content: input.content,
        coverImage: input.coverImage ?? null,
        publishedAt: input.publishedAt ?? null,
        isPublished: input.isPublished ?? false,
      },
    });
    return toPostRecord(post);
  } catch {
    return null;
  }
}

export async function updatePost(
  postId: string,
  input: {
    slug?: string;
    title?: string;
    excerpt?: string;
    content?: string;
    coverImage?: string | null;
    publishedAt?: Date | null;
    isPublished?: boolean;
  },
) {
  try {
    const post = await prisma.post.update({
      where: { id: postId },
      data: {
        slug: input.slug,
        title: input.title,
        excerpt: input.excerpt,
        content: input.content,
        coverImage: input.coverImage,
        publishedAt: input.publishedAt,
        isPublished: input.isPublished,
      },
    });
    return toPostRecord(post);
  } catch {
    return null;
  }
}

export async function deletePost(postId: string) {
  try {
    await prisma.post.delete({ where: { id: postId } });
    return true;
  } catch {
    return false;
  }
}

export async function createAnalyticsEvent(input: {
  eventName: AnalyticsEventName;
  userId?: string | null;
  path?: string | null;
  payload?: Prisma.InputJsonValue | null;
}) {
  try {
    const row = await prisma.analyticsEvent.create({
      data: {
        eventName: input.eventName,
        userId: input.userId ?? null,
        path: input.path ?? null,
        payload: input.payload ?? Prisma.JsonNull,
      },
    });
    return toAnalyticsEventRecord(row);
  } catch {
    return null;
  }
}

export async function listAnalyticsEvents(input?: {
  userId?: string;
  eventName?: AnalyticsEventName;
  from?: Date;
  to?: Date;
  take?: number;
  skip?: number;
}) {
  const where: Prisma.AnalyticsEventWhereInput = {
    userId: input?.userId,
    eventName: input?.eventName,
    createdAt: {
      gte: input?.from,
      lte: input?.to,
    },
  };

  const [rows, total] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.max(1, Math.min(input?.take ?? 100, 500)),
      skip: Math.max(0, input?.skip ?? 0),
    }),
    prisma.analyticsEvent.count({ where }),
  ]);

  return {
    rows: rows.map(toAnalyticsEventRecord),
    total,
  } satisfies AnalyticsEventListResult;
}

async function getActiveUserIdsInRange(
  from: Date,
  to: Date,
  userIds?: string[],
): Promise<Set<string>> {
  const filterIds = userIds && userIds.length > 0 ? userIds : undefined;
  const [eventUsers, lessonUsers, attemptUsers, chatUsers, aiUsers] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where: {
        createdAt: { gte: from, lt: to },
        userId: {
          not: null,
          ...(filterIds ? { in: filterIds } : {}),
        },
      },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.lessonProgress.findMany({
      where: {
        updatedAt: { gte: from, lt: to },
        ...(filterIds ? { userId: { in: filterIds } } : {}),
      },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.taskAttempt.findMany({
      where: {
        createdAt: { gte: from, lt: to },
        ...(filterIds ? { userId: { in: filterIds } } : {}),
      },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.chatSession.findMany({
      where: {
        ...(filterIds ? { userId: { in: filterIds } } : {}),
        messages: { some: { createdAt: { gte: from, lt: to } } },
      },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.aiSolutionAnalysis.findMany({
      where: {
        createdAt: { gte: from, lt: to },
        ...(filterIds ? { userId: { in: filterIds } } : {}),
      },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  const all = new Set<string>();
  for (const row of eventUsers) {
    if (row.userId) all.add(row.userId);
  }
  for (const row of lessonUsers) all.add(row.userId);
  for (const row of attemptUsers) all.add(row.userId);
  for (const row of chatUsers) all.add(row.userId);
  for (const row of aiUsers) all.add(row.userId);
  return all;
}

export async function getLearningAnalyticsSnapshot(days: number): Promise<LearningAnalyticsSnapshotRecord> {
  const safeDays = Math.max(1, Math.min(Math.floor(days), 90));
  const now = new Date();
  const from = new Date(now.getTime() - safeDays * DAY_MS);
  const dauFrom = startOfUtcDay(now);
  const wauFrom = new Date(dauFrom.getTime() - 6 * DAY_MS);

  const [registrations, lessonProgressUpdates, lessonCompletions, taskAttempts, taskCorrectAttempts, aiChatMessages, aiSolutionAnalyses, paymentSuccesses, revenueAgg, activeUsers, dauUsers, wauUsers, retentionAgg] =
    await Promise.all([
      prisma.user.count({
        where: {
          role: "STUDENT",
          createdAt: { gte: from },
        },
      }),
      prisma.lessonProgress.count({
        where: {
          updatedAt: { gte: from },
          status: { in: ["IN_PROGRESS", "COMPLETED"] },
        },
      }),
      prisma.lessonProgress.count({
        where: {
          updatedAt: { gte: from },
          status: "COMPLETED",
        },
      }),
      prisma.taskAttempt.count({
        where: { createdAt: { gte: from } },
      }),
      prisma.taskAttempt.count({
        where: {
          createdAt: { gte: from },
          isCorrect: true,
        },
      }),
      prisma.chatMessage.count({
        where: {
          createdAt: { gte: from },
          role: "USER",
        },
      }),
      prisma.aiSolutionAnalysis.count({
        where: {
          createdAt: { gte: from },
          status: "completed",
        },
      }),
      prisma.paymentIntent.count({
        where: {
          status: "SUCCEEDED",
          paidAt: { gte: from },
        },
      }),
      prisma.paymentIntent.aggregate({
        _sum: { amountCents: true },
        where: {
          status: "SUCCEEDED",
          paidAt: { gte: from },
        },
      }),
      getActiveUserIdsInRange(from, now),
      getActiveUserIdsInRange(dauFrom, now),
      getActiveUserIdsInRange(wauFrom, now),
      prisma.dailyMetricAggregate.aggregate({
        _sum: {
          registrations: true,
          retainedD1: true,
          retainedD7: true,
        },
        where: {
          day: { gte: from },
        },
      }),
    ]);

  const conversion = registrations > 0 ? (paymentSuccesses / registrations) * 100 : 0;
  const retentionBase = retentionAgg._sum.registrations ?? 0;
  const retentionD1Percent =
    retentionBase > 0 ? ((retentionAgg._sum.retainedD1 ?? 0) / retentionBase) * 100 : 0;
  const retentionD7Percent =
    retentionBase > 0 ? ((retentionAgg._sum.retainedD7 ?? 0) / retentionBase) * 100 : 0;
  return {
    periodDays: safeDays,
    registrations,
    activeUsers: activeUsers.size,
    dau: dauUsers.size,
    wau: wauUsers.size,
    lessonProgressUpdates,
    lessonCompletions,
    taskAttempts,
    taskCorrectAttempts,
    aiChatMessages,
    aiSolutionAnalyses,
    paymentSuccesses,
    revenueCents: revenueAgg._sum.amountCents ?? 0,
    paymentConversionPercent: Number(conversion.toFixed(2)),
    retentionD1Percent: Number(retentionD1Percent.toFixed(2)),
    retentionD7Percent: Number(retentionD7Percent.toFixed(2)),
  };
}

async function countRetentionForCohort(cohortDay: Date, offsetDays: number) {
  const cohortStart = startOfUtcDay(cohortDay);
  const cohortEnd = endOfUtcDay(cohortDay);
  const activeStart = new Date(cohortStart.getTime() + offsetDays * DAY_MS);
  const activeEnd = new Date(activeStart.getTime() + DAY_MS);

  const cohortUsers = await prisma.user.findMany({
    where: {
      role: "STUDENT",
      createdAt: { gte: cohortStart, lt: cohortEnd },
    },
    select: { id: true },
  });
  if (cohortUsers.length === 0) return 0;
  const cohortIds = cohortUsers.map((user) => user.id);
  const activeSet = await getActiveUserIdsInRange(activeStart, activeEnd, cohortIds);
  return activeSet.size;
}

async function computeDailyMetric(day: Date): Promise<DailyMetricAggregateRecord> {
  const dayStart = startOfUtcDay(day);
  const dayEnd = endOfUtcDay(dayStart);
  const wauStart = new Date(dayStart.getTime() - 6 * DAY_MS);

  const [dauSet, wauSet, registrations, paidUsersRows, revenue, aiChatMessages, retainedD1, retainedD7] =
    await Promise.all([
      getActiveUserIdsInRange(dayStart, dayEnd),
      getActiveUserIdsInRange(wauStart, dayEnd),
      prisma.user.count({
        where: {
          role: "STUDENT",
          createdAt: { gte: dayStart, lt: dayEnd },
        },
      }),
      prisma.paymentIntent.findMany({
        where: {
          status: "SUCCEEDED",
          paidAt: { gte: dayStart, lt: dayEnd },
        },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.paymentIntent.aggregate({
        _sum: { amountCents: true },
        where: {
          status: "SUCCEEDED",
          paidAt: { gte: dayStart, lt: dayEnd },
        },
      }),
      prisma.chatMessage.count({
        where: {
          createdAt: { gte: dayStart, lt: dayEnd },
          role: "USER",
        },
      }),
      countRetentionForCohort(dayStart, 1),
      countRetentionForCohort(dayStart, 7),
    ]);

  const paidUsers = paidUsersRows.length;
  const conversion = registrations > 0 ? (paidUsers / registrations) * 100 : 0;
  return {
    day: toIsoDay(dayStart),
    dau: dauSet.size,
    wau: wauSet.size,
    registrations,
    paidUsers,
    paymentConversion: Number(conversion.toFixed(2)),
    retainedD1,
    retainedD7,
    aiChatMessages,
    revenueCents: revenue._sum.amountCents ?? 0,
  };
}

export async function recomputeDailyMetricAggregates(days = 30) {
  const safeDays = Math.max(1, Math.min(Math.floor(days), 90));
  const today = startOfUtcDay(new Date());
  const targetDays = Array.from({ length: safeDays }, (_, index) => {
    const offset = safeDays - index - 1;
    return new Date(today.getTime() - offset * DAY_MS);
  });

  const computed = await Promise.all(targetDays.map((day) => computeDailyMetric(day)));

  await prisma.$transaction(
    computed.map((metric) =>
      prisma.dailyMetricAggregate.upsert({
        where: { day: new Date(metric.day) },
        update: {
          dau: metric.dau,
          wau: metric.wau,
          registrations: metric.registrations,
          paidUsers: metric.paidUsers,
          paymentConversion: metric.paymentConversion,
          retainedD1: metric.retainedD1,
          retainedD7: metric.retainedD7,
          aiChatMessages: metric.aiChatMessages,
          revenueCents: metric.revenueCents,
        },
        create: {
          day: new Date(metric.day),
          dau: metric.dau,
          wau: metric.wau,
          registrations: metric.registrations,
          paidUsers: metric.paidUsers,
          paymentConversion: metric.paymentConversion,
          retainedD1: metric.retainedD1,
          retainedD7: metric.retainedD7,
          aiChatMessages: metric.aiChatMessages,
          revenueCents: metric.revenueCents,
        },
      }),
    ),
  );

  return computed;
}

export async function listDailyMetricAggregates(days = 30): Promise<DailyMetricAggregateRecord[]> {
  const safeDays = Math.max(1, Math.min(Math.floor(days), 90));
  const from = startOfUtcDay(new Date(Date.now() - (safeDays - 1) * DAY_MS));
  const rows = await prisma.dailyMetricAggregate.findMany({
    where: { day: { gte: from } },
    orderBy: { day: "asc" },
  });
  return rows.map(toDailyMetricAggregateRecord);
}

export async function ensureDailyMetricAggregates(days = 30): Promise<DailyMetricAggregateRecord[]> {
  try {
    const existing = await listDailyMetricAggregates(days);
    if (existing.length >= Math.max(1, Math.min(Math.floor(days), 90))) {
      return existing;
    }
    return await recomputeDailyMetricAggregates(days);
  } catch {
    return [];
  }
}

export async function createAdminAuditLog(input: {
  adminUserId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: input.adminUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata ?? Prisma.JsonNull,
      },
    });
  } catch {
    // Audit logging is best-effort for MVP.
  }
}

export async function createServiceErrorLog(input: {
  route?: string;
  message: string;
  details?: Prisma.InputJsonValue | null;
  stack?: string | null;
  requestId?: string | null;
  userId?: string | null;
  level?: "debug" | "info" | "warn" | "error" | "fatal";
}) {
  try {
    await prisma.serviceError.create({
      data: {
        route: input.route ?? null,
        message: input.message,
        details: input.details ?? Prisma.JsonNull,
        stack: input.stack ?? null,
        requestId: input.requestId ?? null,
        userId: input.userId ?? null,
        level:
          input.level === "fatal"
            ? "FATAL"
            : input.level === "warn"
              ? "WARN"
              : input.level === "info"
                ? "INFO"
                : input.level === "debug"
                  ? "DEBUG"
                  : "ERROR",
      },
    });
  } catch {
    // Prevent recursive failures when persistence is unavailable.
  }
}

export async function listServiceErrorLogs(input?: {
  level?: "debug" | "info" | "warn" | "error" | "fatal";
  route?: string;
  requestId?: string;
  userId?: string;
  from?: Date;
  to?: Date;
  take?: number;
  skip?: number;
}) {
  const mappedLevel =
    input?.level === "fatal"
      ? "FATAL"
      : input?.level === "error"
        ? "ERROR"
        : input?.level === "warn"
          ? "WARN"
          : input?.level === "info"
            ? "INFO"
            : input?.level === "debug"
              ? "DEBUG"
              : undefined;

  const where: Prisma.ServiceErrorWhereInput = {
    level: mappedLevel,
    route: input?.route
      ? {
          contains: input.route,
          mode: "insensitive",
        }
      : undefined,
    requestId: input?.requestId
      ? {
          contains: input.requestId,
          mode: "insensitive",
        }
      : undefined,
    userId: input?.userId,
    occurredAt: {
      gte: input?.from,
      lte: input?.to,
    },
  };

  const [rows, total] = await Promise.all([
    prisma.serviceError.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      take: Math.max(1, Math.min(input?.take ?? 100, 500)),
      skip: Math.max(0, input?.skip ?? 0),
    }),
    prisma.serviceError.count({ where }),
  ]);

  return {
    rows: rows.map(toServiceErrorRecord),
    total,
  } satisfies ServiceErrorListResult;
}

export async function enqueueJob(input: {
  jobType: string;
  payload?: Prisma.InputJsonValue;
  idempotencyKey?: string | null;
  runAt?: Date;
  maxAttempts?: number;
}) {
  try {
    const row = await prisma.jobQueue.create({
      data: {
        jobType: input.jobType,
        payload: (input.payload ?? {}) as Prisma.InputJsonValue,
        status: "PENDING",
        runAt: input.runAt ?? new Date(),
        maxAttempts: Math.max(1, Math.min(input.maxAttempts ?? 5, 20)),
        idempotencyKey: input.idempotencyKey ?? null,
      },
    });
    return toJobQueueRecord(row);
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }

    if (!input.idempotencyKey) {
      throw error;
    }

    const existing = await prisma.jobQueue.findFirst({
      where: {
        jobType: input.jobType,
        idempotencyKey: input.idempotencyKey,
      },
      orderBy: { createdAt: "desc" },
    });
    if (!existing) throw error;
    return toJobQueueRecord(existing);
  }
}

export async function listJobs(input?: {
  status?: JobQueueRecord["status"];
  take?: number;
}) {
  const rows = await prisma.jobQueue.findMany({
    where: {
      status:
        input?.status === "failed"
          ? "FAILED"
          : input?.status === "succeeded"
            ? "SUCCEEDED"
            : input?.status === "processing"
              ? "PROCESSING"
              : input?.status === "pending"
                ? "PENDING"
                : undefined,
    },
    orderBy: [{ runAt: "asc" }, { createdAt: "desc" }],
    take: Math.max(1, Math.min(Math.floor(input?.take ?? 30), 100)),
  });

  return rows.map(toJobQueueRecord);
}

type DailyMetricsJobPayload = {
  days?: number;
};

function isDailyMetricsJobPayload(value: unknown): value is DailyMetricsJobPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { days?: unknown };
  return candidate.days === undefined || (typeof candidate.days === "number" && Number.isFinite(candidate.days));
}

type DatasetFileProcessingJobPayload = {
  fileId?: string;
};

function isDatasetFileProcessingJobPayload(value: unknown): value is DatasetFileProcessingJobPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { fileId?: unknown };
  return candidate.fileId === undefined || typeof candidate.fileId === "string";
}

function computeRetryBackoffMs(attempt: number) {
  const safeAttempt = Math.max(1, Math.floor(attempt));
  const baseMs = 30_000;
  const capMs = 30 * 60_000;
  const exponential = Math.min(capMs, baseMs * 2 ** (safeAttempt - 1));
  const jitter = Math.floor(Math.random() * 5_000);
  return Math.min(capMs, exponential + jitter);
}

export async function enqueueDailyMetricsRecomputeJob(input?: {
  days?: number;
  idempotencyKey?: string | null;
  runAt?: Date;
}) {
  const safeDays = Math.max(1, Math.min(Math.floor(input?.days ?? 30), 90));
  const idempotencyKey =
    input?.idempotencyKey?.trim() || `daily_metrics:${safeDays}:${new Date().toISOString().slice(0, 10)}`;
  return enqueueJob({
    jobType: "daily_metrics_recompute",
    payload: { days: safeDays },
    idempotencyKey,
    runAt: input?.runAt,
    maxAttempts: 5,
  });
}

export async function enqueueDatasetFileProcessingJob(input: {
  fileId: string;
  idempotencyKey?: string | null;
  runAt?: Date;
}) {
  const normalizedFileId = input.fileId.trim();
  const idempotencyKey = input.idempotencyKey?.trim() || `dataset_process:${normalizedFileId}`;
  return enqueueJob({
    jobType: "dataset_file_process",
    payload: { fileId: normalizedFileId },
    idempotencyKey,
    runAt: input.runAt,
    maxAttempts: 6,
  });
}

async function executeDatasetFileProcessingJob(fileId: string) {
  const file = await prisma.datasetFile.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      storagePath: true,
    },
  });
  if (!file) {
    throw new Error(`Dataset file not found: ${fileId}`);
  }

  await updateDatasetFileProcessingStatus({
    fileId,
    status: "processing",
    processingError: null,
  });

  const extracted = await extractUploadContent({
    mimeType: file.mimeType,
    originalName: file.originalName,
    storagePath: file.storagePath,
  });
  await updateDatasetFileProcessingStatus({
    fileId,
    status: "parsed",
    extractedText: extracted.extractedText,
    summary: extracted.summary,
    pageCount: extracted.pageCount,
    textChars: extracted.textChars,
    processingError: null,
  });

  const chunks = buildDatasetChunks({ text: extracted.extractedText });
  await replaceDatasetTextChunks({
    fileId,
    chunks,
  });

  await updateDatasetFileProcessingStatus({
    fileId,
    status: "ready",
    extractedText: extracted.extractedText,
    summary: extracted.summary,
    pageCount: extracted.pageCount,
    textChars: extracted.textChars,
    processingError: null,
    processedAt: new Date(),
  });
}

export async function executePendingJobs(limit = 3) {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 10));
  const now = new Date();
  const queued = await prisma.jobQueue.findMany({
    where: {
      status: "PENDING",
      runAt: { lte: now },
    },
    orderBy: [{ runAt: "asc" }, { createdAt: "asc" }],
    take: safeLimit,
  });

  const results: Array<{ id: string; status: "succeeded" | "failed" | "skipped"; error?: string }> = [];

  for (const job of queued) {
    const locked = await prisma.jobQueue.updateMany({
      where: { id: job.id, status: "PENDING" },
      data: {
        status: "PROCESSING",
        attempts: { increment: 1 },
      },
    });
    if (locked.count === 0) {
      results.push({ id: job.id, status: "skipped" });
      continue;
    }

    try {
      if (job.jobType === "daily_metrics_recompute") {
        const payload = isDailyMetricsJobPayload(job.payload) ? job.payload : {};
        await recomputeDailyMetricAggregates(payload.days ?? 30);
      } else if (job.jobType === "dataset_file_process") {
        const payload = isDatasetFileProcessingJobPayload(job.payload) ? job.payload : {};
        if (!payload.fileId) {
          throw new Error("Invalid dataset file processing payload");
        }
        await executeDatasetFileProcessingJob(payload.fileId);
      } else {
        throw new Error(`Unsupported job type: ${job.jobType}`);
      }

      await prisma.jobQueue.update({
        where: { id: job.id },
        data: {
          status: "SUCCEEDED",
          completedAt: new Date(),
          lastError: null,
        },
      });
      results.push({ id: job.id, status: "succeeded" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown job error";
      const latest = await prisma.jobQueue.findUnique({ where: { id: job.id } });
      const attempt = latest?.attempts ?? job.attempts + 1;
      const shouldRetry = attempt < (latest?.maxAttempts ?? job.maxAttempts);
      const nextRunAt = shouldRetry ? new Date(Date.now() + computeRetryBackoffMs(attempt)) : job.runAt;
      await prisma.jobQueue.update({
        where: { id: job.id },
        data: {
          status: shouldRetry ? "PENDING" : "FAILED",
          runAt: nextRunAt,
          lastError: message.slice(0, 500),
          completedAt: shouldRetry ? null : new Date(),
        },
      });

      if (job.jobType === "dataset_file_process") {
        const payload = isDatasetFileProcessingJobPayload(job.payload) ? job.payload : {};
        if (payload.fileId) {
          await updateDatasetFileProcessingStatus({
            fileId: payload.fileId,
            status: shouldRetry ? "processing" : "failed",
            processingError: message.slice(0, 500),
            processedAt: shouldRetry ? null : new Date(),
          }).catch(() => undefined);
        }
      }

      results.push({ id: job.id, status: "failed", error: message });
    }
  }

  return results;
}

function resolveRegistrationChannel(input: {
  email: string;
  passwordHash: string | null;
  authProviders: string[];
}) {
  if (input.email.endsWith("@telegram.local")) return "telegram" as const;
  if (input.authProviders.includes("telegram") && !input.passwordHash) return "telegram" as const;
  if (input.authProviders.includes("google") && !input.passwordHash) return "google" as const;
  return "email" as const;
}

export async function getRegistrationChannelStats(days: number): Promise<RegistrationChannelStats> {
  const from = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000);
  const users = await prisma.user.findMany({
    where: {
      createdAt: { gte: from },
      role: "STUDENT",
    },
    select: {
      email: true,
      passwordHash: true,
      authAccounts: {
        select: { provider: true },
      },
    },
  });

  const stats: RegistrationChannelStats = {
    total: users.length,
    email: 0,
    google: 0,
    telegram: 0,
  };

  for (const user of users) {
    const channel = resolveRegistrationChannel({
      email: user.email.toLowerCase(),
      passwordHash: user.passwordHash,
      authProviders: user.authAccounts.map((account) => account.provider),
    });
    stats[channel] += 1;
  }

  return stats;
}

export async function getBlogPostViewCount(days: number) {
  const from = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000);
  try {
    return await prisma.analyticsEvent.count({
      where: {
        eventName: "blog_post_view",
        createdAt: { gte: from },
      },
    });
  } catch {
    return 0;
  }
}

export async function bulkUpdateCustomTaskStatus(input: {
  taskIds: string[];
  status: "published" | "unpublished" | "archived";
}) {
  if (input.taskIds.length === 0) {
    return { count: 0 };
  }

  const result = await prisma.customTask.updateMany({
    where: { id: { in: input.taskIds } },
    data: {
      status:
        input.status === "archived"
          ? "ARCHIVED"
          : input.status === "unpublished"
            ? "UNPUBLISHED"
            : "PUBLISHED",
    },
  });

  return { count: result.count };
}

export async function createPasswordResetToken(input: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}) {
  const row = await prisma.passwordResetToken.create({
    data: {
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
    },
  });

  return {
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt.toISOString(),
    usedAt: null,
    createdAt: row.createdAt.toISOString(),
  } satisfies PasswordResetTokenRecord;
}

export async function findValidPasswordResetToken(tokenHash: string) {
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!row || row.usedAt || row.expiresAt <= new Date()) {
    return null;
  }

  return {
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt.toISOString(),
    usedAt: null,
    createdAt: row.createdAt.toISOString(),
  } satisfies PasswordResetTokenRecord;
}

export async function markPasswordResetTokenUsed(tokenId: string) {
  await prisma.passwordResetToken.update({
    where: { id: tokenId },
    data: { usedAt: new Date() },
  });
}

export async function invalidateUserPasswordResetTokens(userId: string) {
  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });
}

export async function updateUserPassword(userId: string, passwordHash: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}

export async function createPaymentIntent(input: {
  userId: string;
  planId: string;
  amountCents: number;
  currency?: string;
  provider?: string;
  providerPaymentId?: string | null;
  metadata?: string | null;
  status?: PaymentIntentRecord["status"];
  idempotencyKey?: string | null;
  checkoutToken?: string;
}) {
  const checkoutToken = input.checkoutToken ?? crypto.randomUUID();
  const mappedStatus =
    input.status === "created"
      ? "CREATED"
      : input.status === "processing"
        ? "PROCESSING"
        : input.status === "succeeded"
          ? "SUCCEEDED"
          : input.status === "failed"
            ? "FAILED"
            : input.status === "canceled"
              ? "CANCELED"
              : "REQUIRES_ACTION";

  try {
    const row = await prisma.paymentIntent.create({
      data: {
        userId: input.userId,
        planId: input.planId,
        amountCents: input.amountCents,
        currency: input.currency ?? "RUB",
        provider: input.provider ?? "mock",
        providerPaymentId: input.providerPaymentId ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        metadata: input.metadata ?? null,
        checkoutToken,
        status: mappedStatus,
      },
    });
    return toPaymentRecord(row);
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002" || !input.idempotencyKey) {
      throw error;
    }

    const existing = await prisma.paymentIntent.findFirst({
      where: {
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
      },
      orderBy: { createdAt: "desc" },
    });
    if (!existing) {
      throw error;
    }
    return toPaymentRecord(existing);
  }
}

export async function findPaymentByCheckoutToken(checkoutToken: string) {
  const row = await prisma.paymentIntent.findUnique({ where: { checkoutToken } });
  return row ? toPaymentRecord(row) : null;
}

export async function findPaymentByProviderPaymentId(provider: string, providerPaymentId: string) {
  const row = await prisma.paymentIntent.findFirst({
    where: {
      provider,
      providerPaymentId,
    },
    orderBy: { createdAt: "desc" },
  });
  return row ? toPaymentRecord(row) : null;
}

export async function updatePaymentProviderReference(input: {
  checkoutToken: string;
  provider: string;
  providerPaymentId: string;
  metadata?: string | null;
}) {
  const row = await prisma.paymentIntent.update({
    where: { checkoutToken: input.checkoutToken },
    data: {
      provider: input.provider,
      providerPaymentId: input.providerPaymentId,
      metadata: input.metadata,
    },
  });
  return toPaymentRecord(row);
}

function mapStatus(status: PaymentIntentRecord["status"]) {
  return status === "created"
    ? "CREATED"
    : status === "processing"
      ? "PROCESSING"
      : status === "succeeded"
        ? "SUCCEEDED"
        : status === "failed"
          ? "FAILED"
          : status === "canceled"
            ? "CANCELED"
            : "REQUIRES_ACTION";
}

export async function updatePaymentStatusByCheckoutToken(input: {
  checkoutToken: string;
  status: PaymentIntentRecord["status"];
  failureReason?: string | null;
}) {
  const row = await prisma.paymentIntent.update({
    where: { checkoutToken: input.checkoutToken },
    data: {
      status: mapStatus(input.status),
      paidAt: input.status === "succeeded" ? new Date() : null,
      failedAt: input.status === "failed" ? new Date() : null,
      canceledAt: input.status === "canceled" ? new Date() : null,
      failureReason: input.status === "failed" || input.status === "canceled" ? input.failureReason ?? null : null,
    },
  });
  return toPaymentRecord(row);
}

export async function markPaymentProcessing(checkoutToken: string) {
  return updatePaymentStatusByCheckoutToken({ checkoutToken, status: "processing" });
}

export async function markPaymentSucceeded(checkoutToken: string) {
  return updatePaymentStatusByCheckoutToken({ checkoutToken, status: "succeeded" });
}

export async function markPaymentFailed(checkoutToken: string, failureReason?: string) {
  return updatePaymentStatusByCheckoutToken({ checkoutToken, status: "failed", failureReason });
}

export async function markPaymentCanceled(checkoutToken: string, failureReason?: string) {
  return updatePaymentStatusByCheckoutToken({ checkoutToken, status: "canceled", failureReason });
}

export async function createPaymentEvent(input: {
  paymentId: string;
  userId: string;
  provider: string;
  providerEventId: string;
  status: PaymentIntentRecord["status"];
  payload?: unknown;
}) {
  const mappedStatus = mapStatus(input.status);

  try {
    const row = await prisma.paymentEvent.create({
      data: {
        paymentId: input.paymentId,
        userId: input.userId,
        provider: input.provider,
        providerEventId: input.providerEventId,
        status: mappedStatus,
        payload: (input.payload ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
    return {
      record: toPaymentEventRecord(row),
      deduplicated: false,
    };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }
    const existing = await prisma.paymentEvent.findFirst({
      where: {
        provider: input.provider,
        providerEventId: input.providerEventId,
      },
      orderBy: { createdAt: "desc" },
    });
    if (!existing) throw error;
    return {
      record: toPaymentEventRecord(existing),
      deduplicated: true,
    };
  }
}

export async function listAdminPayments(input?: {
  from?: Date;
  to?: Date;
  userId?: string;
  userEmail?: string;
  status?: PaymentIntentRecord["status"];
  planId?: string;
  sortBy?: "createdAt" | "amountCents" | "status" | "paidAt";
  sortDir?: "asc" | "desc";
  take?: number;
  skip?: number;
}) {
  const mappedStatus =
    input?.status === "created"
      ? "CREATED"
      : input?.status === "requires_action"
        ? "REQUIRES_ACTION"
        : input?.status === "processing"
          ? "PROCESSING"
          : input?.status === "succeeded"
            ? "SUCCEEDED"
            : input?.status === "failed"
              ? "FAILED"
              : input?.status === "canceled"
                ? "CANCELED"
                : undefined;

  const sortField = input?.sortBy ?? "createdAt";
  const sortDirection = input?.sortDir ?? "desc";
  const where: Prisma.PaymentIntentWhereInput = {
    createdAt: {
      gte: input?.from,
      lte: input?.to,
    },
    userId: input?.userId,
    planId: input?.planId,
    status: mappedStatus,
    user: input?.userEmail
      ? {
          email: {
            contains: input.userEmail.toLowerCase(),
            mode: "insensitive",
          },
        }
      : undefined,
  };

  const [rows, total] = await Promise.all([
    prisma.paymentIntent.findMany({
      where,
      include: {
        user: {
          select: { email: true },
        },
      },
      orderBy: {
        [sortField]: sortDirection,
      },
      take: Math.max(1, Math.min(input?.take ?? 100, 500)),
      skip: Math.max(0, input?.skip ?? 0),
    }),
    prisma.paymentIntent.count({ where }),
  ]);

  return {
    rows: rows.map(toAdminPaymentRecord),
    total,
  };
}

export async function getPaymentStatusCounts(days = 30): Promise<PaymentStatusCountsRecord> {
  const safeDays = Math.max(1, Math.min(Math.floor(days), 365));
  const from = new Date(Date.now() - safeDays * DAY_MS);

  const grouped = await prisma.paymentIntent.groupBy({
    by: ["status"],
    where: {
      createdAt: { gte: from },
    },
    _count: {
      status: true,
    },
  });

  const counts: PaymentStatusCountsRecord = {
    created: 0,
    requires_action: 0,
    processing: 0,
    succeeded: 0,
    failed: 0,
    canceled: 0,
    total: 0,
  };

  for (const item of grouped) {
    const value = item._count.status ?? 0;
    if (item.status === "CREATED") counts.created += value;
    else if (item.status === "REQUIRES_ACTION") counts.requires_action += value;
    else if (item.status === "PROCESSING") counts.processing += value;
    else if (item.status === "SUCCEEDED") counts.succeeded += value;
    else if (item.status === "FAILED") counts.failed += value;
    else if (item.status === "CANCELED") counts.canceled += value;
    counts.total += value;
  }

  return counts;
}

export async function listSucceededPaymentsForAnalytics(days = 30): Promise<SucceededPaymentForAnalyticsRecord[]> {
  const safeDays = Math.max(1, Math.min(Math.floor(days), 365));
  const from = new Date(Date.now() - safeDays * DAY_MS);
  const rows = await prisma.paymentIntent.findMany({
    where: {
      status: "SUCCEEDED",
      paidAt: { gte: from },
    },
    select: {
      id: true,
      planId: true,
      amountCents: true,
      currency: true,
      userId: true,
      paidAt: true,
      createdAt: true,
    },
    orderBy: { paidAt: "desc" },
    take: 10_000,
  });

  return rows
    .filter((row) => row.paidAt)
    .map((row) => ({
      id: row.id,
      planId: row.planId,
      amountCents: row.amountCents,
      currency: row.currency,
      userId: row.userId,
      paidAt: row.paidAt!.toISOString(),
      createdAt: row.createdAt.toISOString(),
    }));
}

export async function getOrCreateWallet(userId: string, currency = "RUB") {
  const row = await prisma.wallet.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      currency,
      balanceCents: 0,
    },
  });
  return toWalletRecord(row);
}

export async function getWalletByUserId(userId: string) {
  const row = await prisma.wallet.findUnique({
    where: { userId },
  });
  return row ? toWalletRecord(row) : null;
}

export async function listWalletTransactions(input: {
  userId: string;
  direction?: WalletDirectionRecord;
  operationType?: WalletOperationTypeRecord;
  take?: number;
  skip?: number;
}) {
  const where: Prisma.WalletTransactionWhereInput = {
    userId: input.userId,
    direction: input.direction ? mapWalletDirection(input.direction) : undefined,
    operationType: input.operationType ? mapWalletOperationType(input.operationType) : undefined,
  };

  const [rows, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.max(1, Math.min(input.take ?? 50, 500)),
      skip: Math.max(0, input.skip ?? 0),
    }),
    prisma.walletTransaction.count({ where }),
  ]);

  return {
    rows: rows.map(toWalletTransactionRecord),
    total,
  };
}

class InsufficientFundsError extends Error {
  constructor() {
    super("INSUFFICIENT_FUNDS");
    this.name = "InsufficientFundsError";
  }
}

export function isInsufficientFundsError(error: unknown) {
  return error instanceof InsufficientFundsError || (error instanceof Error && error.message === "INSUFFICIENT_FUNDS");
}

async function applyWalletTransaction(input: {
  userId: string;
  direction: WalletDirectionRecord;
  operationType: WalletOperationTypeRecord;
  amountCents: number;
  paymentIntentId?: string | null;
  idempotencyKey?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}): Promise<WalletTransactionMutationResult> {
  const amountCents = Math.max(0, Math.floor(input.amountCents));
  if (amountCents <= 0) {
    throw new Error("INVALID_WALLET_AMOUNT");
  }
  const normalizedIdempotency = input.idempotencyKey?.trim() || null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (normalizedIdempotency) {
        const existing = await tx.walletTransaction.findUnique({
          where: {
            userId_idempotencyKey: {
              userId: input.userId,
              idempotencyKey: normalizedIdempotency,
            },
          },
        });
        if (existing) {
          return {
            record: toWalletTransactionRecord(existing),
            deduplicated: true,
          } satisfies WalletTransactionMutationResult;
        }
      }

      const wallet = await tx.wallet.upsert({
        where: { userId: input.userId },
        update: {},
        create: {
          userId: input.userId,
          currency: "RUB",
          balanceCents: 0,
        },
      });

      const balanceBefore = wallet.balanceCents;
      const isDebit = input.direction === "debit";
      if (isDebit && balanceBefore < amountCents) {
        throw new InsufficientFundsError();
      }

      const balanceAfter = isDebit ? balanceBefore - amountCents : balanceBefore + amountCents;
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balanceCents: balanceAfter },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: updatedWallet.id,
          userId: input.userId,
          direction: mapWalletDirection(input.direction),
          operationType: mapWalletOperationType(input.operationType),
          amountCents,
          balanceBefore,
          balanceAfter,
          paymentIntentId: input.paymentIntentId ?? null,
          idempotencyKey: normalizedIdempotency,
          metadata: (input.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      });

      return {
        record: toWalletTransactionRecord(transaction),
        deduplicated: false,
      } satisfies WalletTransactionMutationResult;
    });

    return result;
  } catch (error) {
    if (error instanceof InsufficientFundsError) {
      throw error;
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      normalizedIdempotency
    ) {
      const existing = await prisma.walletTransaction.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: input.userId,
            idempotencyKey: normalizedIdempotency,
          },
        },
      });
      if (existing) {
        return {
          record: toWalletTransactionRecord(existing),
          deduplicated: true,
        };
      }
    }
    throw error;
  }
}

export async function topupWallet(input: {
  userId: string;
  amountCents: number;
  idempotencyKey?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}) {
  return applyWalletTransaction({
    userId: input.userId,
    direction: "credit",
    operationType: "topup",
    amountCents: input.amountCents,
    idempotencyKey: input.idempotencyKey,
    metadata: input.metadata,
  });
}

export async function debitWalletForPurchase(input: {
  userId: string;
  amountCents: number;
  paymentIntentId?: string | null;
  idempotencyKey?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}) {
  return applyWalletTransaction({
    userId: input.userId,
    direction: "debit",
    operationType: "purchase",
    amountCents: input.amountCents,
    paymentIntentId: input.paymentIntentId ?? null,
    idempotencyKey: input.idempotencyKey,
    metadata: input.metadata,
  });
}

export async function adjustWalletBalance(input: {
  userId: string;
  direction: WalletDirectionRecord;
  amountCents: number;
  idempotencyKey?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}) {
  return applyWalletTransaction({
    userId: input.userId,
    direction: input.direction,
    operationType: "manual_adjustment",
    amountCents: input.amountCents,
    idempotencyKey: input.idempotencyKey,
    metadata: input.metadata,
  });
}

export async function getWalletSnapshot(userId: string, take = 20): Promise<WalletSnapshotRecord> {
  const wallet = await getOrCreateWallet(userId);
  const transactions = await listWalletTransactions({
    userId,
    take,
  });
  return {
    wallet,
    transactions: transactions.rows,
    totalTransactions: transactions.total,
  };
}

export async function listAdminWallets(input?: {
  userId?: string;
  userEmail?: string;
  take?: number;
  skip?: number;
}) {
  const where: Prisma.WalletWhereInput = {
    userId: input?.userId,
    user: input?.userEmail
      ? {
          email: {
            contains: input.userEmail.toLowerCase(),
            mode: "insensitive",
          },
        }
      : undefined,
  };
  const [rows, total] = await Promise.all([
    prisma.wallet.findMany({
      where,
      include: {
        user: { select: { email: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: Math.max(1, Math.min(input?.take ?? 100, 500)),
      skip: Math.max(0, input?.skip ?? 0),
    }),
    prisma.wallet.count({ where }),
  ]);

  return {
    rows: rows.map(toAdminWalletRecord),
    total,
  };
}

export async function listAdminWalletTransactions(input?: {
  userId?: string;
  userEmail?: string;
  direction?: WalletDirectionRecord;
  operationType?: WalletOperationTypeRecord;
  from?: Date;
  to?: Date;
  take?: number;
  skip?: number;
}) {
  const where: Prisma.WalletTransactionWhereInput = {
    userId: input?.userId,
    direction: input?.direction ? mapWalletDirection(input.direction) : undefined,
    operationType: input?.operationType ? mapWalletOperationType(input.operationType) : undefined,
    createdAt: {
      gte: input?.from,
      lte: input?.to,
    },
    user: input?.userEmail
      ? {
          email: {
            contains: input.userEmail.toLowerCase(),
            mode: "insensitive",
          },
        }
      : undefined,
  };

  const [rows, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      include: {
        user: {
          select: { email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: Math.max(1, Math.min(input?.take ?? 100, 500)),
      skip: Math.max(0, input?.skip ?? 0),
    }),
    prisma.walletTransaction.count({ where }),
  ]);

  return {
    rows: rows.map((row) => ({
      ...toWalletTransactionRecord(row),
      userEmail: row.user.email,
    })) satisfies AdminWalletTransactionRecord[],
    total,
  };
}

export async function createUserUpload(input: {
  userId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  extractedText?: string | null;
}) {
  const row = await prisma.userUpload.create({
    data: {
      userId: input.userId,
      originalName: input.originalName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storagePath: input.storagePath,
      extractedText: input.extractedText ?? null,
    },
  });

  return {
    id: row.id,
    userId: row.userId,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    storagePath: row.storagePath,
    extractedText: row.extractedText,
    createdAt: row.createdAt.toISOString(),
  } satisfies UserUploadRecord;
}

export async function updateUserUploadText(uploadId: string, extractedText: string) {
  const row = await prisma.userUpload.update({
    where: { id: uploadId },
    data: { extractedText },
  });

  return {
    id: row.id,
    userId: row.userId,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    storagePath: row.storagePath,
    extractedText: row.extractedText,
    createdAt: row.createdAt.toISOString(),
  } satisfies UserUploadRecord;
}

export async function findUserUploadById(uploadId: string, userId: string) {
  const row = await prisma.userUpload.findFirst({ where: { id: uploadId, userId } });
  if (!row) return null;

  return {
    id: row.id,
    userId: row.userId,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    storagePath: row.storagePath,
    extractedText: row.extractedText,
    createdAt: row.createdAt.toISOString(),
  } satisfies UserUploadRecord;
}

export async function listUserUploads(userId: string) {
  const rows = await prisma.userUpload.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    storagePath: row.storagePath,
    extractedText: row.extractedText,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function upsertLessonKnowledge(input: {
  lessonId: string;
  originalName: string;
  mimeType: string;
  storagePath: string;
  extractedText: string;
  summary?: string | null;
  pageCount?: number | null;
  textChars?: number;
}) {
  const row = await prisma.lessonKnowledge.upsert({
    where: { lessonId: input.lessonId },
    update: {
      originalName: input.originalName,
      mimeType: input.mimeType,
      storagePath: input.storagePath,
      extractedText: input.extractedText,
      summary: input.summary ?? null,
      pageCount: input.pageCount ?? null,
      textChars: input.textChars ?? input.extractedText.length,
    },
    create: {
      lessonId: input.lessonId,
      originalName: input.originalName,
      mimeType: input.mimeType,
      storagePath: input.storagePath,
      extractedText: input.extractedText,
      summary: input.summary ?? null,
      pageCount: input.pageCount ?? null,
      textChars: input.textChars ?? input.extractedText.length,
    },
  });

  return {
    id: row.id,
    lessonId: row.lessonId,
    originalName: row.originalName,
    mimeType: row.mimeType,
    storagePath: row.storagePath,
    extractedText: row.extractedText,
    summary: row.summary,
    pageCount: row.pageCount,
    textChars: row.textChars,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  } satisfies LessonKnowledgeRecord;
}

export async function getLessonKnowledge(lessonId: string) {
  const row = await prisma.lessonKnowledge.findUnique({ where: { lessonId } });
  if (!row) return null;

  return {
    id: row.id,
    lessonId: row.lessonId,
    originalName: row.originalName,
    mimeType: row.mimeType,
    storagePath: row.storagePath,
    extractedText: row.extractedText,
    summary: row.summary,
    pageCount: row.pageCount,
    textChars: row.textChars,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  } satisfies LessonKnowledgeRecord;
}

function toAiSolutionAnalysisRecord(row: {
  id: string;
  userId: string;
  lessonId: string | null;
  taskId: string | null;
  mode: string;
  status: string;
  model: string | null;
  latencyMs: number | null;
  input: unknown;
  result: unknown;
  error: unknown;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}) {
  return {
    id: row.id,
    userId: row.userId,
    lessonId: row.lessonId,
    taskId: row.taskId,
    mode: row.mode as AiAnalysisMode,
    status: row.status as AiAnalysisStatus,
    model: row.model,
    latencyMs: row.latencyMs,
    input: row.input as AiAnalysisInput,
    result: (row.result ?? null) as AiAnalysisResult | null,
    error: (row.error ?? null) as AiAnalysisError | null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  } satisfies AiSolutionAnalysisRecord;
}

export async function createAiSolutionAnalysis(input: {
  userId: string;
  lessonId?: string;
  taskId?: string;
  mode: AiAnalysisMode;
  status: AiAnalysisStatus;
  inputPayload: AiAnalysisInput;
  resultPayload?: AiAnalysisResult;
  errorPayload?: AiAnalysisError;
  model?: string;
  latencyMs?: number;
  completedAt?: Date;
}) {
  const row = await prisma.aiSolutionAnalysis.create({
    data: {
      userId: input.userId,
      lessonId: input.lessonId ?? null,
      taskId: input.taskId ?? null,
      mode: input.mode,
      status: input.status,
      input: input.inputPayload as unknown as object,
      result: (input.resultPayload ?? null) as unknown as object,
      error: (input.errorPayload ?? null) as unknown as object,
      model: input.model ?? null,
      latencyMs: input.latencyMs ?? null,
      completedAt: input.completedAt ?? null,
    },
  });

  return toAiSolutionAnalysisRecord(row);
}

export async function listAiSolutionAnalyses(input?: {
  userId?: string;
  taskId?: string;
  lessonId?: string;
  mode?: AiAnalysisMode;
  status?: AiAnalysisStatus;
  take?: number;
  skip?: number;
}) {
  const take = clampTake(input?.take, 50, 200);
  const skip = clampSkip(input?.skip);
  const where: Prisma.AiSolutionAnalysisWhereInput = {
    userId: input?.userId,
    taskId: input?.taskId,
    lessonId: input?.lessonId,
    mode: input?.mode,
    status: input?.status,
  };
  const rows = await prisma.aiSolutionAnalysis.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    skip,
  });

  return rows.map(toAiSolutionAnalysisRecord);
}

export async function listAiSolutionAnalysesPaged(input?: {
  userId?: string;
  taskId?: string;
  lessonId?: string;
  mode?: AiAnalysisMode;
  status?: AiAnalysisStatus;
  take?: number;
  skip?: number;
}): Promise<PagedResult<AiSolutionAnalysisRecord>> {
  const take = clampTake(input?.take, 50, 200);
  const skip = clampSkip(input?.skip);
  const where: Prisma.AiSolutionAnalysisWhereInput = {
    userId: input?.userId,
    taskId: input?.taskId,
    lessonId: input?.lessonId,
    mode: input?.mode,
    status: input?.status,
  };
  const [rows, total] = await Promise.all([
    prisma.aiSolutionAnalysis.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.aiSolutionAnalysis.count({ where }),
  ]);
  return {
    rows: rows.map(toAiSolutionAnalysisRecord),
    total,
    take,
    skip,
  };
}

export async function createDatasetFile(input: {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
}) {
  const row = await prisma.datasetFile.create({
    data: {
      originalName: input.originalName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storagePath: input.storagePath,
      processingStatus: "UPLOADED",
    },
  });

  return {
    id: row.id,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    storagePath: row.storagePath,
    processingStatus: "uploaded",
    extractedText: row.extractedText,
    summary: row.summary,
    pageCount: row.pageCount,
    textChars: row.textChars,
    processingError: row.processingError,
    processedAt: row.processedAt?.toISOString() ?? null,
    chunkCount: 0,
    createdAt: row.createdAt.toISOString(),
  } satisfies DatasetFileRecord;
}

export async function findDatasetFileById(fileId: string) {
  const row = await prisma.datasetFile.findUnique({
    where: { id: fileId },
    include: {
      _count: {
        select: { chunks: true },
      },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    storagePath: row.storagePath,
    processingStatus:
      row.processingStatus === "FAILED"
        ? "failed"
        : row.processingStatus === "READY"
          ? "ready"
          : row.processingStatus === "PROCESSING"
            ? "processing"
            : row.processingStatus === "PARSED"
              ? "parsed"
              : "uploaded",
    extractedText: row.extractedText,
    summary: row.summary,
    pageCount: row.pageCount,
    textChars: row.textChars,
    processingError: row.processingError,
    processedAt: row.processedAt?.toISOString() ?? null,
    chunkCount: row._count.chunks,
    createdAt: row.createdAt.toISOString(),
  } satisfies DatasetFileRecord;
}

export async function updateDatasetFileProcessingStatus(input: {
  fileId: string;
  status: "uploaded" | "processing" | "parsed" | "ready" | "failed";
  extractedText?: string | null;
  summary?: string | null;
  pageCount?: number | null;
  textChars?: number;
  processingError?: string | null;
  processedAt?: Date | null;
}) {
  const row = await prisma.datasetFile.update({
    where: { id: input.fileId },
    data: {
      processingStatus:
        input.status === "failed"
          ? "FAILED"
          : input.status === "ready"
            ? "READY"
            : input.status === "processing"
              ? "PROCESSING"
            : input.status === "parsed"
              ? "PARSED"
              : "UPLOADED",
      extractedText: input.extractedText,
      summary: input.summary,
      pageCount: input.pageCount,
      textChars: input.textChars,
      processingError: input.processingError,
      processedAt: input.processedAt,
    },
  });

  const chunkCount = await prisma.datasetTextChunk.count({ where: { datasetFileId: row.id } });
  return {
    id: row.id,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    storagePath: row.storagePath,
    processingStatus:
      row.processingStatus === "FAILED"
        ? "failed"
        : row.processingStatus === "READY"
          ? "ready"
          : row.processingStatus === "PROCESSING"
            ? "processing"
            : row.processingStatus === "PARSED"
            ? "parsed"
            : "uploaded",
    extractedText: row.extractedText,
    summary: row.summary,
    pageCount: row.pageCount,
    textChars: row.textChars,
    processingError: row.processingError,
    processedAt: row.processedAt?.toISOString() ?? null,
    chunkCount,
    createdAt: row.createdAt.toISOString(),
  } satisfies DatasetFileRecord;
}

export async function replaceDatasetTextChunks(input: {
  fileId: string;
  chunks: Array<{ chunkIndex: number; content: string; charCount: number }>;
}) {
  await prisma.$transaction([
    prisma.datasetTextChunk.deleteMany({ where: { datasetFileId: input.fileId } }),
    ...(input.chunks.length > 0
      ? [
          prisma.datasetTextChunk.createMany({
            data: input.chunks.map((chunk) => ({
              datasetFileId: input.fileId,
              chunkIndex: chunk.chunkIndex,
              content: chunk.content,
              charCount: chunk.charCount,
            })),
          }),
        ]
      : []),
  ]);
}

export async function listDatasetFiles(limit = 50) {
  const rows = await prisma.datasetFile.findMany({
    include: {
      _count: {
        select: { chunks: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(Math.floor(limit), 200)),
  });

  return rows.map((row) => ({
    id: row.id,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    storagePath: row.storagePath,
    processingStatus:
      row.processingStatus === "FAILED"
        ? "failed"
        : row.processingStatus === "READY"
          ? "ready"
          : row.processingStatus === "PROCESSING"
            ? "processing"
            : row.processingStatus === "PARSED"
            ? "parsed"
            : "uploaded",
    extractedText: row.extractedText,
    summary: row.summary,
    pageCount: row.pageCount,
    textChars: row.textChars,
    processingError: row.processingError,
    processedAt: row.processedAt?.toISOString() ?? null,
    chunkCount: row._count.chunks,
    createdAt: row.createdAt.toISOString(),
  })) satisfies DatasetFileRecord[];
}
