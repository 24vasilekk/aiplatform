import {
  courses as staticCourses,
  lessons as staticLessons,
  sections as staticSections,
  type Course,
  type Section,
  type Lesson,
  type Task,
} from "@/lib/mvp-data";
import {
  findCustomLessonById,
  findCustomSectionById,
  listCustomCourses,
  listCustomLessonsPaged,
  listCustomSectionsPaged,
  listCustomTasksByLessonIds,
} from "@/lib/db";

export type CatalogCourse = Course & {
  source: "static" | "custom";
};

export type CatalogSection = Section & {
  source: "static" | "custom";
};

export type CatalogLesson = Lesson & {
  source: "static" | "custom";
};

const CATALOG_CACHE_TTL_MS = 30_000;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const catalogCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const item = catalogCache.get(key);
  if (!item) return null;
  if (item.expiresAt <= Date.now()) {
    catalogCache.delete(key);
    return null;
  }
  return item.value as T;
}

function setCached<T>(key: string, value: T, ttlMs = CATALOG_CACHE_TTL_MS) {
  catalogCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

export async function listAllCourses(): Promise<CatalogCourse[]> {
  const cacheKey = "courses";
  const cached = getCached<CatalogCourse[]>(cacheKey);
  if (cached) return cached;

  let customCourses: Awaited<ReturnType<typeof listCustomCourses>> = [];
  try {
    customCourses = await listCustomCourses();
  } catch {
    // Keep catalog available even when DB custom tables are temporarily unavailable.
    customCourses = [];
  }

  const result = [
    ...staticCourses.map((course) => ({ ...course, source: "static" as const })),
    ...customCourses.map((course) => ({
      id: course.id,
      subject: course.subject,
      title: course.title,
      description: course.description,
      sectionIds: [],
      progress: 0,
      source: "custom" as const,
    })),
  ];
  setCached(cacheKey, result);
  return result;
}

export async function getCatalogCourseById(courseId: string) {
  const all = await listAllCourses();
  return all.find((course) => course.id === courseId) ?? null;
}

export async function listSectionsByCourseId(courseId: string): Promise<CatalogSection[]> {
  const cacheKey = `sections:${courseId}`;
  const cached = getCached<CatalogSection[]>(cacheKey);
  if (cached) return cached;

  const customSectionsPage = await listCustomSectionsPaged({
    courseId,
    take: 1_000,
    skip: 0,
  });
  const customSections = customSectionsPage.rows;

  const result = [
    ...staticSections
      .filter((section) => section.courseId === courseId)
      .map((section) => ({ ...section, source: "static" as const })),
    ...customSections
      .filter((section) => section.courseId === courseId)
      .map((section) => ({
        id: section.id,
        courseId: section.courseId,
        title: section.title,
        lessonIds: [],
        source: "custom" as const,
      })),
  ];
  setCached(cacheKey, result);
  return result;
}

export async function listLessonsBySectionId(sectionId: string): Promise<CatalogLesson[]> {
  const cacheKey = `lessons:${sectionId}`;
  const cached = getCached<CatalogLesson[]>(cacheKey);
  if (cached) return cached;

  const customLessonsPage = await listCustomLessonsPaged({
    sectionId,
    take: 1_000,
    skip: 0,
  });
  const customLessons = customLessonsPage.rows;
  const customTasks = await listCustomTasksByLessonIds(
    customLessons.map((lesson) => lesson.id),
    { publishedOnly: true },
  );
  const customTasksByLessonId = customTasks.reduce<Record<string, typeof customTasks>>((acc, task) => {
    if (!acc[task.lessonId]) {
      acc[task.lessonId] = [];
    }
    acc[task.lessonId].push(task);
    return acc;
  }, {});

  const result = [
    ...staticLessons
      .filter((lesson) => lesson.sectionId === sectionId)
      .map((lesson) => ({ ...lesson, source: "static" as const })),
    ...customLessons
      .filter((lesson) => lesson.sectionId === sectionId)
      .map((lesson) => ({
        id: lesson.id,
        sectionId: lesson.sectionId,
        title: lesson.title,
        description: lesson.description,
        videoUrl: lesson.videoUrl,
        tasks: (customTasksByLessonId[lesson.id] ?? []).map(
            (task): Task => ({
              id: task.id,
              type: task.type,
              question: task.question,
              options: task.options ?? undefined,
              answer: task.answer,
              solution: task.solution,
            }),
          ),
        source: "custom" as const,
      })),
  ];
  setCached(cacheKey, result);
  return result;
}

export async function getCatalogLessonById(lessonId: string): Promise<CatalogLesson | null> {
  const cacheKey = `lesson:${lessonId}`;
  const cached = getCached<CatalogLesson | null>(cacheKey);
  if (cached !== null) return cached;

  const staticLesson = staticLessons.find((lesson) => lesson.id === lessonId);
  if (staticLesson) {
    const lesson = { ...staticLesson, source: "static" as const };
    setCached(cacheKey, lesson);
    return lesson;
  }

  const customLesson = await findCustomLessonById(lessonId);
  if (!customLesson) {
    setCached(cacheKey, null);
    return null;
  }
  const customTasks = await listCustomTasksByLessonIds([customLesson.id], { publishedOnly: true });

  const result = {
    id: customLesson.id,
    sectionId: customLesson.sectionId,
    title: customLesson.title,
    description: customLesson.description,
    videoUrl: customLesson.videoUrl,
    tasks: customTasks.map(
        (task): Task => ({
          id: task.id,
          type: task.type,
          question: task.question,
          options: task.options ?? undefined,
          answer: task.answer,
          solution: task.solution,
        }),
      ),
    source: "custom" as const,
  };
  setCached(cacheKey, result);
  return result;
}

export async function getCourseIdByLessonId(lessonId: string): Promise<string | null> {
  const lesson = await getCatalogLessonById(lessonId);
  if (!lesson) return null;

  const staticSection = staticSections.find((section) => section.id === lesson.sectionId);
  if (staticSection) {
    return staticSection.courseId;
  }

  const customSection = await findCustomSectionById(lesson.sectionId);
  return customSection?.courseId ?? null;
}
