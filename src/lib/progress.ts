import { listAllCourses, listLessonsBySectionId, listSectionsByCourseId } from "@/lib/course-catalog";
import { listProgress, listTaskProgress, type LessonProgressRecord, type TaskProgressRecord } from "@/lib/db";

export type TaskProgressView = {
  taskId: string;
  lessonId: string;
  status: "not_started" | "in_progress" | "completed";
  scorePercent: number | null;
  attemptsCount: number;
  firstCompletedAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type LessonProgressView = {
  lessonId: string;
  title: string;
  status: "not_started" | "in_progress" | "completed";
  percent: number;
  completedTasks: number;
  totalTasks: number;
  startedAt: string | null;
  completedAt: string | null;
  lastActivityAt: string | null;
  lessonProgressUpdatedAt: string | null;
  tasks: TaskProgressView[];
};

export type CourseProgressView = {
  courseId: string;
  title: string;
  subject: string;
  status: "not_started" | "in_progress" | "completed";
  percent: number;
  completedLessons: number;
  totalLessons: number;
  completedTasks: number;
  totalTasks: number;
  startedAt: string | null;
  completedAt: string | null;
  lastActivityAt: string | null;
  lessons: LessonProgressView[];
};

export type UserProgressSnapshot = {
  userId: string;
  generatedAt: string;
  summary: {
    percent: number;
    status: "not_started" | "in_progress" | "completed";
    completedCourses: number;
    totalCourses: number;
    completedLessons: number;
    totalLessons: number;
    completedTasks: number;
    totalTasks: number;
    startedAt: string | null;
    completedAt: string | null;
    lastActivityAt: string | null;
  };
  courses: CourseProgressView[];
};

function maxIso(values: Array<string | null | undefined>) {
  const filtered = values.filter((value): value is string => Boolean(value));
  if (filtered.length === 0) return null;
  return filtered.reduce((a, b) => (a > b ? a : b));
}

function minIso(values: Array<string | null | undefined>) {
  const filtered = values.filter((value): value is string => Boolean(value));
  if (filtered.length === 0) return null;
  return filtered.reduce((a, b) => (a < b ? a : b));
}

function roundPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function deriveLessonFromTasks(input: {
  lesson: { tasks: Array<{ id: string }> };
  lessonProgress: LessonProgressRecord | undefined;
  taskProgressById: Map<string, TaskProgressRecord>;
  title: string;
  lessonId: string;
}): LessonProgressView {
  const taskViews: TaskProgressView[] = input.lesson.tasks.map((task) => {
    const row = input.taskProgressById.get(task.id);
    return {
      taskId: task.id,
      lessonId: input.lessonId,
      status: row?.status ?? "not_started",
      scorePercent: row?.scorePercent ?? null,
      attemptsCount: row?.attemptsCount ?? 0,
      firstCompletedAt: row?.firstCompletedAt ?? null,
      completedAt: row?.completedAt ?? null,
      createdAt: row?.createdAt ?? null,
      updatedAt: row?.updatedAt ?? null,
    };
  });

  const totalTasks = taskViews.length;
  const completedTasks = taskViews.filter((task) => task.status === "completed").length;
  const attempted = taskViews.some((task) => task.attemptsCount > 0);

  const basePercent =
    totalTasks > 0
      ? roundPercent((completedTasks / totalTasks) * 100)
      : input.lessonProgress?.status === "completed"
        ? 100
        : input.lessonProgress?.status === "in_progress"
          ? 50
          : 0;

  const status: LessonProgressView["status"] =
    input.lessonProgress?.status === "completed" || (totalTasks > 0 && completedTasks === totalTasks)
      ? "completed"
      : input.lessonProgress?.status === "in_progress" || attempted
        ? "in_progress"
        : "not_started";

  const startedAt = minIso([
    input.lessonProgress && input.lessonProgress.status !== "not_started" ? input.lessonProgress.updatedAt : null,
    ...taskViews
      .filter((task) => task.attemptsCount > 0)
      .map((task) => task.createdAt),
  ]);
  const completedAt =
    status === "completed"
      ? maxIso([
          input.lessonProgress?.status === "completed" ? input.lessonProgress.updatedAt : null,
          ...taskViews.map((task) => task.completedAt),
        ])
      : null;
  const lastActivityAt = maxIso([
    input.lessonProgress?.updatedAt ?? null,
    ...taskViews.map((task) => task.updatedAt),
  ]);

  return {
    lessonId: input.lessonId,
    title: input.title,
    status,
    percent: status === "completed" ? 100 : basePercent,
    completedTasks,
    totalTasks,
    startedAt,
    completedAt,
    lastActivityAt,
    lessonProgressUpdatedAt: input.lessonProgress?.updatedAt ?? null,
    tasks: taskViews,
  };
}

export async function buildUserProgressSnapshot(userId: string): Promise<UserProgressSnapshot> {
  const [courses, lessonProgress, taskProgress] = await Promise.all([
    listAllCourses(),
    listProgress(userId),
    listTaskProgress({ userId }),
  ]);

  const lessonProgressByLessonId = new Map(lessonProgress.map((item) => [item.lessonId, item] as const));
  const taskProgressByTaskId = new Map(taskProgress.map((item) => [item.taskId, item] as const));

  const courseViews = await Promise.all(
    courses.map(async (course) => {
      const sections = await listSectionsByCourseId(course.id);
      const lessons = (await Promise.all(sections.map((section) => listLessonsBySectionId(section.id)))).flat();
      const lessonViews = lessons.map((lesson) =>
        deriveLessonFromTasks({
          lesson,
          lessonProgress: lessonProgressByLessonId.get(lesson.id),
          taskProgressById: taskProgressByTaskId,
          title: lesson.title,
          lessonId: lesson.id,
        }),
      );

      const totalLessons = lessonViews.length;
      const completedLessons = lessonViews.filter((lesson) => lesson.status === "completed").length;
      const totalTasks = lessonViews.reduce((sum, lesson) => sum + lesson.totalTasks, 0);
      const completedTasks = lessonViews.reduce((sum, lesson) => sum + lesson.completedTasks, 0);
      const percent = totalLessons > 0 ? roundPercent((completedLessons / totalLessons) * 100) : 0;
      const status: CourseProgressView["status"] =
        totalLessons > 0 && completedLessons === totalLessons
          ? "completed"
          : lessonViews.some((lesson) => lesson.status !== "not_started")
            ? "in_progress"
            : "not_started";

      return {
        courseId: course.id,
        title: course.title,
        subject: course.subject,
        status,
        percent: status === "completed" ? 100 : percent,
        completedLessons,
        totalLessons,
        completedTasks,
        totalTasks,
        startedAt: minIso(lessonViews.map((lesson) => lesson.startedAt)),
        completedAt: status === "completed" ? maxIso(lessonViews.map((lesson) => lesson.completedAt)) : null,
        lastActivityAt: maxIso(lessonViews.map((lesson) => lesson.lastActivityAt)),
        lessons: lessonViews,
      } satisfies CourseProgressView;
    }),
  );

  const totalCourses = courseViews.length;
  const completedCourses = courseViews.filter((course) => course.status === "completed").length;
  const totalLessons = courseViews.reduce((sum, course) => sum + course.totalLessons, 0);
  const completedLessons = courseViews.reduce((sum, course) => sum + course.completedLessons, 0);
  const totalTasks = courseViews.reduce((sum, course) => sum + course.totalTasks, 0);
  const completedTasks = courseViews.reduce((sum, course) => sum + course.completedTasks, 0);
  const overallPercent = totalLessons > 0 ? roundPercent((completedLessons / totalLessons) * 100) : 0;
  const overallStatus: UserProgressSnapshot["summary"]["status"] =
    totalCourses > 0 && completedCourses === totalCourses
      ? "completed"
      : courseViews.some((course) => course.status !== "not_started")
        ? "in_progress"
        : "not_started";

  return {
    userId,
    generatedAt: new Date().toISOString(),
    summary: {
      percent: overallStatus === "completed" ? 100 : overallPercent,
      status: overallStatus,
      completedCourses,
      totalCourses,
      completedLessons,
      totalLessons,
      completedTasks,
      totalTasks,
      startedAt: minIso(courseViews.map((course) => course.startedAt)),
      completedAt: overallStatus === "completed" ? maxIso(courseViews.map((course) => course.completedAt)) : null,
      lastActivityAt: maxIso(courseViews.map((course) => course.lastActivityAt)),
    },
    courses: courseViews,
  };
}

