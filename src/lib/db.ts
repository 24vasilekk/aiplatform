import { promises as fs } from "node:fs";
import path from "node:path";
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

type DbShape = {
  users: UserRecord[];
  courseAccesses: CourseAccessRecord[];
  lessonProgress: LessonProgressRecord[];
  taskAttempts: TaskAttemptRecord[];
  chatSessions: ChatSessionRecord[];
  customCourses: CustomCourseRecord[];
  customSections: CustomSectionRecord[];
  customLessons: CustomLessonRecord[];
  customTasks: CustomTaskRecord[];
};

const DB_PATH = path.join(process.cwd(), "data", "db.json");

const initialDb: DbShape = {
  users: [],
  courseAccesses: [],
  lessonProgress: [],
  taskAttempts: [],
  chatSessions: [],
  customCourses: [],
  customSections: [],
  customLessons: [],
  customTasks: [],
};

function uid(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

async function ensureDbFile() {
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(initialDb, null, 2), "utf8");
  }
}

export async function readDb(): Promise<DbShape> {
  await ensureDbFile();
  const raw = await fs.readFile(DB_PATH, "utf8");
  const parsed = JSON.parse(raw) as Partial<DbShape>;

  return {
    users: parsed.users ?? [],
    courseAccesses: parsed.courseAccesses ?? [],
    lessonProgress: parsed.lessonProgress ?? [],
    taskAttempts: parsed.taskAttempts ?? [],
    chatSessions: parsed.chatSessions ?? [],
    customCourses: parsed.customCourses ?? [],
    customSections: parsed.customSections ?? [],
    customLessons: parsed.customLessons ?? [],
    customTasks: parsed.customTasks ?? [],
  };
}

export async function writeDb(data: DbShape) {
  await ensureDbFile();
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf8");
}

export async function findUserByEmail(email: string) {
  const db = await readDb();
  return db.users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function findUserById(userId: string) {
  const db = await readDb();
  return db.users.find((user) => user.id === userId) ?? null;
}

export async function createUser(input: { email: string; passwordHash: string; role?: UserRole }) {
  const db = await readDb();

  const user: UserRecord = {
    id: uid("usr"),
    email: input.email,
    passwordHash: input.passwordHash,
    role: input.role ?? "student",
    createdAt: new Date().toISOString(),
  };

  db.users.push(user);

  db.courseAccesses.push({
    id: uid("acc"),
    userId: user.id,
    courseId: "math-base",
    accessType: "trial",
    expiresAt: null,
  });

  await writeDb(db);
  return user;
}

export async function listCourseAccess(userId: string) {
  const db = await readDb();
  return db.courseAccesses.filter((access) => access.userId === userId);
}

export async function hasCourseAccess(userId: string, courseId: string) {
  const db = await readDb();
  return db.courseAccesses.some((access) => access.userId === userId && access.courseId === courseId);
}

export async function grantCourseAccess(
  userId: string,
  courseId: string,
  accessType: CourseAccessRecord["accessType"] = "subscription",
) {
  const db = await readDb();
  const exists = db.courseAccesses.find((item) => item.userId === userId && item.courseId === courseId);

  if (!exists) {
    db.courseAccesses.push({
      id: uid("acc"),
      userId,
      courseId,
      accessType,
      expiresAt: null,
    });
    await writeDb(db);
  }
}

export async function saveLessonProgress(input: {
  userId: string;
  lessonId: string;
  status: LessonProgressRecord["status"];
  lastPositionSec: number;
}) {
  const db = await readDb();
  const existing = db.lessonProgress.find(
    (item) => item.userId === input.userId && item.lessonId === input.lessonId,
  );

  if (existing) {
    existing.status = input.status;
    existing.lastPositionSec = input.lastPositionSec;
    existing.updatedAt = new Date().toISOString();
  } else {
    db.lessonProgress.push({
      id: uid("prg"),
      userId: input.userId,
      lessonId: input.lessonId,
      status: input.status,
      lastPositionSec: input.lastPositionSec,
      updatedAt: new Date().toISOString(),
    });
  }

  await writeDb(db);
}

export async function listProgress(userId: string) {
  const db = await readDb();
  return db.lessonProgress.filter((item) => item.userId === userId);
}

export async function saveTaskAttempt(input: {
  userId: string;
  taskId: string;
  answerText: string;
  isCorrect: boolean;
}) {
  const db = await readDb();
  db.taskAttempts.push({
    id: uid("att"),
    userId: input.userId,
    taskId: input.taskId,
    answerText: input.answerText,
    isCorrect: input.isCorrect,
    createdAt: new Date().toISOString(),
  });
  await writeDb(db);
}

async function ensureChatSession(input: {
  userId: string;
  chatType: ChatSessionRecord["chatType"];
  lessonId: string | null;
}) {
  const db = await readDb();
  let session = db.chatSessions.find(
    (item) =>
      item.userId === input.userId &&
      item.chatType === input.chatType &&
      item.lessonId === input.lessonId,
  );

  if (!session) {
    session = {
      id: uid("chat"),
      userId: input.userId,
      chatType: input.chatType,
      lessonId: input.lessonId,
      createdAt: new Date().toISOString(),
      messages: [],
    };
    db.chatSessions.push(session);
    await writeDb(db);
  }

  return session;
}

export async function listChatMessages(input: {
  userId: string;
  chatType: ChatSessionRecord["chatType"];
  lessonId: string | null;
}) {
  const session = await ensureChatSession(input);
  return session.messages;
}

export async function addChatMessage(input: {
  userId: string;
  chatType: ChatSessionRecord["chatType"];
  lessonId: string | null;
  role: ChatMessageRecord["role"];
  content: string;
  mode?: string;
}) {
  const db = await readDb();
  let session = db.chatSessions.find(
    (item) =>
      item.userId === input.userId &&
      item.chatType === input.chatType &&
      item.lessonId === input.lessonId,
  );

  if (!session) {
    session = {
      id: uid("chat"),
      userId: input.userId,
      chatType: input.chatType,
      lessonId: input.lessonId,
      createdAt: new Date().toISOString(),
      messages: [],
    };
    db.chatSessions.push(session);
  }

  const message: ChatMessageRecord = {
    id: uid("msg"),
    role: input.role,
    content: input.content,
    mode: input.mode ?? "default",
    createdAt: new Date().toISOString(),
  };

  session.messages.push(message);
  await writeDb(db);
  return message;
}

export async function listUsers() {
  const db = await readDb();
  return db.users;
}

export async function listCustomCourses() {
  const db = await readDb();
  return db.customCourses;
}

export async function createCustomCourse(input: {
  title: string;
  description: string;
  subject: Subject;
}) {
  const db = await readDb();

  const course: CustomCourseRecord = {
    id: `custom-${uid("course")}`,
    title: input.title,
    description: input.description,
    subject: input.subject,
    createdAt: new Date().toISOString(),
  };

  db.customCourses.push(course);
  await writeDb(db);

  return course;
}

export async function updateCustomCourse(
  courseId: string,
  input: { title?: string; description?: string; subject?: Subject },
) {
  const db = await readDb();
  const course = db.customCourses.find((item) => item.id === courseId);
  if (!course) return null;

  if (typeof input.title === "string") {
    course.title = input.title;
  }
  if (typeof input.description === "string") {
    course.description = input.description;
  }
  if (typeof input.subject === "string") {
    course.subject = input.subject;
  }

  await writeDb(db);
  return course;
}

export async function deleteCustomCourse(courseId: string) {
  const db = await readDb();
  const course = db.customCourses.find((item) => item.id === courseId);
  if (!course) return false;

  const sectionIds = db.customSections
    .filter((section) => section.courseId === courseId)
    .map((section) => section.id);
  const lessonIds = db.customLessons
    .filter((lesson) => sectionIds.includes(lesson.sectionId))
    .map((lesson) => lesson.id);

  db.customCourses = db.customCourses.filter((item) => item.id !== courseId);
  db.customSections = db.customSections.filter((item) => item.courseId !== courseId);
  db.customLessons = db.customLessons.filter((lesson) => !sectionIds.includes(lesson.sectionId));
  db.customTasks = db.customTasks.filter((task) => !lessonIds.includes(task.lessonId));
  db.courseAccesses = db.courseAccesses.filter((access) => access.courseId !== courseId);

  await writeDb(db);
  return true;
}

export async function listCustomSections() {
  const db = await readDb();
  return db.customSections;
}

export async function createCustomSection(input: { courseId: string; title: string }) {
  const db = await readDb();

  const section: CustomSectionRecord = {
    id: `custom-${uid("section")}`,
    courseId: input.courseId,
    title: input.title,
    createdAt: new Date().toISOString(),
  };

  db.customSections.push(section);
  await writeDb(db);

  return section;
}

export async function updateCustomSection(sectionId: string, input: { title?: string }) {
  const db = await readDb();
  const section = db.customSections.find((item) => item.id === sectionId);
  if (!section) return null;

  if (typeof input.title === "string") {
    section.title = input.title;
  }

  await writeDb(db);
  return section;
}

export async function deleteCustomSection(sectionId: string) {
  const db = await readDb();
  const section = db.customSections.find((item) => item.id === sectionId);
  if (!section) return false;

  const lessonIds = db.customLessons
    .filter((lesson) => lesson.sectionId === sectionId)
    .map((lesson) => lesson.id);

  db.customSections = db.customSections.filter((item) => item.id !== sectionId);
  db.customLessons = db.customLessons.filter((lesson) => lesson.sectionId !== sectionId);
  db.customTasks = db.customTasks.filter((task) => !lessonIds.includes(task.lessonId));

  await writeDb(db);
  return true;
}

export async function listCustomLessons() {
  const db = await readDb();
  return db.customLessons;
}

export async function createCustomLesson(input: {
  sectionId: string;
  title: string;
  description: string;
  videoUrl: string;
}) {
  const db = await readDb();

  const lesson: CustomLessonRecord = {
    id: `custom-${uid("lesson")}`,
    sectionId: input.sectionId,
    title: input.title,
    description: input.description,
    videoUrl: input.videoUrl,
    createdAt: new Date().toISOString(),
  };

  db.customLessons.push(lesson);
  await writeDb(db);

  return lesson;
}

export async function updateCustomLesson(
  lessonId: string,
  input: { title?: string; description?: string; videoUrl?: string },
) {
  const db = await readDb();
  const lesson = db.customLessons.find((item) => item.id === lessonId);
  if (!lesson) return null;

  if (typeof input.title === "string") {
    lesson.title = input.title;
  }
  if (typeof input.description === "string") {
    lesson.description = input.description;
  }
  if (typeof input.videoUrl === "string") {
    lesson.videoUrl = input.videoUrl;
  }

  await writeDb(db);
  return lesson;
}

export async function deleteCustomLesson(lessonId: string) {
  const db = await readDb();
  const exists = db.customLessons.some((item) => item.id === lessonId);
  if (!exists) return false;

  db.customLessons = db.customLessons.filter((item) => item.id !== lessonId);
  db.customTasks = db.customTasks.filter((task) => task.lessonId !== lessonId);
  await writeDb(db);
  return true;
}

export async function listCustomTasks() {
  const db = await readDb();
  return db.customTasks;
}

export async function listCustomTasksByLessonId(lessonId: string) {
  const db = await readDb();
  return db.customTasks.filter((task) => task.lessonId === lessonId);
}

export async function findCustomTaskById(taskId: string) {
  const db = await readDb();
  return db.customTasks.find((task) => task.id === taskId) ?? null;
}

export async function createCustomTask(input: {
  lessonId: string;
  type: "numeric" | "choice";
  question: string;
  options?: string[] | null;
  answer: string;
  solution: string;
}) {
  const db = await readDb();

  const task: CustomTaskRecord = {
    id: `custom-${uid("task")}`,
    lessonId: input.lessonId,
    type: input.type,
    question: input.question,
    options: input.type === "choice" ? (input.options ?? []) : null,
    answer: input.answer,
    solution: input.solution,
    createdAt: new Date().toISOString(),
  };

  db.customTasks.push(task);
  await writeDb(db);

  return task;
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
  const db = await readDb();
  const task = db.customTasks.find((item) => item.id === taskId);
  if (!task) return null;

  if (typeof input.lessonId === "string") {
    task.lessonId = input.lessonId;
  }
  if (typeof input.type === "string") {
    task.type = input.type;
    if (input.type === "numeric") {
      task.options = null;
    }
  }
  if (typeof input.question === "string") {
    task.question = input.question;
  }
  if (typeof input.answer === "string") {
    task.answer = input.answer;
  }
  if (typeof input.solution === "string") {
    task.solution = input.solution;
  }
  if (input.options !== undefined) {
    task.options = input.options;
  }

  if (task.type === "numeric") {
    task.options = null;
  } else {
    task.options = task.options ?? [];
  }

  await writeDb(db);
  return task;
}

export async function deleteCustomTask(taskId: string) {
  const db = await readDb();
  const exists = db.customTasks.some((item) => item.id === taskId);
  if (!exists) return false;

  db.customTasks = db.customTasks.filter((item) => item.id !== taskId);
  await writeDb(db);
  return true;
}
