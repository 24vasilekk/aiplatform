import {
  courses as staticCourses,
  lessons as staticLessons,
  sections as staticSections,
  type Course,
  type Section,
  type Lesson,
} from "@/lib/mvp-data";
import { listCustomCourses, listCustomLessons, listCustomSections } from "@/lib/db";

export type CatalogCourse = Course & {
  source: "static" | "custom";
};

export type CatalogSection = Section & {
  source: "static" | "custom";
};

export type CatalogLesson = Lesson & {
  source: "static" | "custom";
};

export async function listAllCourses(): Promise<CatalogCourse[]> {
  const customCourses = await listCustomCourses();

  return [
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
}

export async function getCatalogCourseById(courseId: string) {
  const all = await listAllCourses();
  return all.find((course) => course.id === courseId) ?? null;
}

export async function listSectionsByCourseId(courseId: string): Promise<CatalogSection[]> {
  const customSections = await listCustomSections();

  return [
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
}

export async function listLessonsBySectionId(sectionId: string): Promise<CatalogLesson[]> {
  const customLessons = await listCustomLessons();

  return [
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
        tasks: [],
        source: "custom" as const,
      })),
  ];
}

export async function getCatalogLessonById(lessonId: string): Promise<CatalogLesson | null> {
  const staticLesson = staticLessons.find((lesson) => lesson.id === lessonId);
  if (staticLesson) {
    return { ...staticLesson, source: "static" };
  }

  const customLessons = await listCustomLessons();
  const customLesson = customLessons.find((lesson) => lesson.id === lessonId);
  if (!customLesson) {
    return null;
  }

  return {
    id: customLesson.id,
    sectionId: customLesson.sectionId,
    title: customLesson.title,
    description: customLesson.description,
    videoUrl: customLesson.videoUrl,
    tasks: [],
    source: "custom",
  };
}

export async function getCourseIdByLessonId(lessonId: string): Promise<string | null> {
  const lesson = await getCatalogLessonById(lessonId);
  if (!lesson) return null;

  const staticSection = staticSections.find((section) => section.id === lesson.sectionId);
  if (staticSection) {
    return staticSection.courseId;
  }

  const customSections = await listCustomSections();
  const customSection = customSections.find((section) => section.id === lesson.sectionId);
  return customSection?.courseId ?? null;
}
