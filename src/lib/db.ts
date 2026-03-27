import { prisma } from "@/lib/prisma";
import type { Subject } from "@/lib/mvp-data";

export type UserRole = "student" | "admin";

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
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
  question: string;
  options: string[] | null;
  answer: string;
  solution: string;
  createdAt: string;
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
  checkoutToken: string;
  metadata: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
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

function uid(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function mapRole(role: "STUDENT" | "ADMIN"): UserRole {
  return role === "ADMIN" ? "admin" : "student";
}

function toUserRecord(user: {
  id: string;
  email: string;
  passwordHash: string;
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

function toTaskRecord(task: {
  id: string;
  lessonId: string;
  type: "numeric" | "choice";
  question: string;
  options: string | null;
  answer: string;
  solution: string;
  createdAt: Date;
}): CustomTaskRecord {
  return {
    id: task.id,
    lessonId: task.lessonId,
    type: task.type,
    question: task.question,
    options: task.options ? (JSON.parse(task.options) as string[]) : null,
    answer: task.answer,
    solution: task.solution,
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
  checkoutToken: string;
  metadata: string | null;
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
    checkoutToken: payment.checkoutToken,
    metadata: payment.metadata,
    paidAt: payment.paidAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
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

export async function saveTaskAttempt(input: {
  userId: string;
  taskId: string;
  answerText: string;
  isCorrect: boolean;
}) {
  await prisma.taskAttempt.create({
    data: {
      userId: input.userId,
      taskId: input.taskId,
      answerText: input.answerText,
      isCorrect: input.isCorrect,
    },
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
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  return users.map(toUserRecord);
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

export async function listCustomTasksByLessonId(lessonId: string) {
  const tasks = await prisma.customTask.findMany({
    where: { lessonId },
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
  question: string;
  options?: string[] | null;
  answer: string;
  solution: string;
}) {
  const task = await prisma.customTask.create({
    data: {
      id: `custom-${uid("task")}`,
      lessonId: input.lessonId,
      type: input.type,
      question: input.question,
      options: input.type === "choice" ? JSON.stringify(input.options ?? []) : null,
      answer: input.answer,
      solution: input.solution,
    },
  });

  return toTaskRecord(task);
}

export async function updateCustomTask(
  taskId: string,
  input: {
    type?: "numeric" | "choice";
    question?: string;
    options?: string[] | null;
    answer?: string;
    solution?: string;
    lessonId?: string;
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
        type: finalType,
        question: input.question,
        answer: input.answer,
        solution: input.solution,
        options: finalType === "choice" ? JSON.stringify(nextOptions ?? []) : null,
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
}) {
  const checkoutToken = crypto.randomUUID();
  const row = await prisma.paymentIntent.create({
    data: {
      userId: input.userId,
      planId: input.planId,
      amountCents: input.amountCents,
      currency: input.currency ?? "RUB",
      provider: input.provider ?? "mock",
      providerPaymentId: input.providerPaymentId ?? null,
      metadata: input.metadata ?? null,
      checkoutToken,
      status: "REQUIRES_ACTION",
    },
  });

  return toPaymentRecord(row);
}

export async function findPaymentByCheckoutToken(checkoutToken: string) {
  const row = await prisma.paymentIntent.findUnique({ where: { checkoutToken } });
  return row ? toPaymentRecord(row) : null;
}

export async function markPaymentProcessing(checkoutToken: string) {
  const row = await prisma.paymentIntent.update({
    where: { checkoutToken },
    data: { status: "PROCESSING" },
  });
  return toPaymentRecord(row);
}

export async function markPaymentSucceeded(checkoutToken: string) {
  const row = await prisma.paymentIntent.update({
    where: { checkoutToken },
    data: { status: "SUCCEEDED", paidAt: new Date() },
  });
  return toPaymentRecord(row);
}

export async function markPaymentFailed(checkoutToken: string) {
  const row = await prisma.paymentIntent.update({
    where: { checkoutToken },
    data: { status: "FAILED" },
  });
  return toPaymentRecord(row);
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
