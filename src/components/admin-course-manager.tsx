"use client";

import { FormEvent, useMemo, useState } from "react";

type Course = {
  id: string;
  title: string;
  description: string;
  subject: "math" | "physics";
  createdAt: string;
};

type Section = {
  id: string;
  courseId: string;
  title: string;
  createdAt: string;
};

type Lesson = {
  id: string;
  sectionId: string;
  title: string;
  description: string;
  videoUrl: string;
  createdAt: string;
};

export function AdminCourseManager({
  initialCourses,
  initialSections,
  initialLessons,
}: {
  initialCourses: Course[];
  initialSections: Section[];
  initialLessons: Lesson[];
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState<"math" | "physics">("math");

  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionCourseId, setSectionCourseId] = useState(initialCourses[0]?.id ?? "");

  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDescription, setLessonDescription] = useState("");
  const [lessonVideoUrl, setLessonVideoUrl] = useState("https://www.youtube.com/embed/dQw4w9WgXcQ");
  const [lessonSectionId, setLessonSectionId] = useState(initialSections[0]?.id ?? "");

  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [sections, setSections] = useState<Section[]>(initialSections);
  const [lessons, setLessons] = useState<Lesson[]>(initialLessons);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sectionsByCourse = useMemo(() => {
    return sections.reduce<Record<string, Section[]>>((acc, section) => {
      if (!acc[section.courseId]) {
        acc[section.courseId] = [];
      }
      acc[section.courseId].push(section);
      return acc;
    }, {});
  }, [sections]);

  const activeSectionCourseId = courses.some((course) => course.id === sectionCourseId)
    ? sectionCourseId
    : (courses[0]?.id ?? "");
  const activeLessonSectionId = sections.some((section) => section.id === lessonSectionId)
    ? lessonSectionId
    : (sections[0]?.id ?? "");

  async function loadCourses() {
    const response = await fetch("/api/admin/courses", { cache: "no-store" });
    if (!response.ok) return;

    const data = (await response.json()) as Course[];
    setCourses(data);
    if (!sectionCourseId && data[0]) {
      setSectionCourseId(data[0].id);
    }
  }

  async function loadSections() {
    const response = await fetch("/api/admin/sections", { cache: "no-store" });
    if (!response.ok) return;

    const data = (await response.json()) as Section[];
    setSections(data);
    if (!lessonSectionId && data[0]) {
      setLessonSectionId(data[0].id);
    }
  }

  async function loadLessons() {
    const response = await fetch("/api/admin/lessons", { cache: "no-store" });
    if (!response.ok) return;

    const data = (await response.json()) as Lesson[];
    setLessons(data);
  }

  async function refreshAll() {
    await Promise.all([loadCourses(), loadSections(), loadLessons()]);
  }

  async function onCourseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/admin/courses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, description, subject }),
    });

    const data = (await response.json()) as { error?: string };
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Не удалось создать курс");
      return;
    }

    setTitle("");
    setDescription("");
    await loadCourses();
  }

  async function onSectionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/admin/sections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courseId: activeSectionCourseId, title: sectionTitle }),
    });

    const data = (await response.json()) as { error?: string };
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Не удалось создать раздел");
      return;
    }

    setSectionTitle("");
    await loadSections();
  }

  async function onLessonSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/admin/lessons", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sectionId: activeLessonSectionId,
        title: lessonTitle,
        description: lessonDescription,
        videoUrl: lessonVideoUrl,
      }),
    });

    const data = (await response.json()) as { error?: string };
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Не удалось создать урок");
      return;
    }

    setLessonTitle("");
    setLessonDescription("");
    await loadLessons();
  }

  async function editCourse(course: Course) {
    const nextTitle = window.prompt("Новое название курса", course.title);
    if (nextTitle === null) return;

    const nextDescription = window.prompt("Новое описание курса", course.description);
    if (nextDescription === null) return;

    const nextSubjectRaw = window.prompt("Предмет (math или physics)", course.subject);
    if (nextSubjectRaw === null) return;

    const nextSubject = nextSubjectRaw === "physics" ? "physics" : "math";

    const response = await fetch(`/api/admin/courses/${course.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: nextTitle,
        description: nextDescription,
        subject: nextSubject,
      }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Не удалось обновить курс");
      return;
    }

    await refreshAll();
  }

  async function deleteCourse(course: Course) {
    if (!window.confirm(`Удалить курс \"${course.title}\"? Это удалит разделы и уроки.`)) {
      return;
    }

    const response = await fetch(`/api/admin/courses/${course.id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Не удалось удалить курс");
      return;
    }

    await refreshAll();
  }

  async function editSection(section: Section) {
    const nextTitle = window.prompt("Новое название раздела", section.title);
    if (nextTitle === null) return;

    const response = await fetch(`/api/admin/sections/${section.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: nextTitle }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Не удалось обновить раздел");
      return;
    }

    await refreshAll();
  }

  async function deleteSection(section: Section) {
    if (!window.confirm(`Удалить раздел \"${section.title}\"? Это удалит его уроки.`)) {
      return;
    }

    const response = await fetch(`/api/admin/sections/${section.id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Не удалось удалить раздел");
      return;
    }

    await refreshAll();
  }

  async function editLesson(lesson: Lesson) {
    const nextTitle = window.prompt("Новое название урока", lesson.title);
    if (nextTitle === null) return;

    const nextDescription = window.prompt("Новое описание урока", lesson.description);
    if (nextDescription === null) return;

    const nextVideoUrl = window.prompt("Новая ссылка видео (embed URL)", lesson.videoUrl);
    if (nextVideoUrl === null) return;

    const response = await fetch(`/api/admin/lessons/${lesson.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: nextTitle,
        description: nextDescription,
        videoUrl: nextVideoUrl,
      }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Не удалось обновить урок");
      return;
    }

    await refreshAll();
  }

  async function deleteLesson(lesson: Lesson) {
    if (!window.confirm(`Удалить урок \"${lesson.title}\"?`)) {
      return;
    }

    const response = await fetch(`/api/admin/lessons/${lesson.id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Не удалось удалить урок");
      return;
    }

    await refreshAll();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <form className="panel-accent space-y-3" onSubmit={onCourseSubmit}>
          <h2 className="text-lg font-semibold">1. Создать курс</h2>
          <input
            type="text"
            placeholder="Название курса"
            className="w-full"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
          <textarea
            placeholder="Описание курса"
            className="w-full"
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
          />
          <div className="choice-group" role="radiogroup" aria-label="Предмет курса">
            <button
              type="button"
              role="radio"
              aria-checked={subject === "math"}
              className={`choice-chip ${subject === "math" ? "choice-chip-active" : ""}`}
              onClick={() => setSubject("math")}
            >
              Математика
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={subject === "physics"}
              className={`choice-chip ${subject === "physics" ? "choice-chip-active" : ""}`}
              onClick={() => setSubject("physics")}
            >
              Физика
            </button>
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Создание..." : "Создать курс"}
          </button>
        </form>

        <form className="panel-accent space-y-3" onSubmit={onSectionSubmit}>
          <h2 className="text-lg font-semibold">2. Создать раздел</h2>
          {courses.length === 0 ? (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
              Сначала создайте курс.
            </p>
          ) : (
            <div className="choice-group" role="radiogroup" aria-label="Курс для раздела">
              {courses.map((course) => (
                <button
                  key={course.id}
                  type="button"
                  role="radio"
                  aria-checked={activeSectionCourseId === course.id}
                  className={`choice-chip ${activeSectionCourseId === course.id ? "choice-chip-active" : ""}`}
                  onClick={() => setSectionCourseId(course.id)}
                >
                  {course.title}
                </button>
              ))}
            </div>
          )}
          <input
            type="text"
            placeholder="Название раздела"
            className="w-full"
            value={sectionTitle}
            onChange={(event) => setSectionTitle(event.target.value)}
            required
          />
          <button type="submit" className="btn-primary" disabled={loading || courses.length === 0}>
            {loading ? "Создание..." : "Создать раздел"}
          </button>
        </form>

        <form className="panel-accent space-y-3" onSubmit={onLessonSubmit}>
          <h2 className="text-lg font-semibold">3. Создать урок</h2>
          {sections.length === 0 ? (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
              Сначала создайте раздел.
            </p>
          ) : (
            <div className="choice-group" role="radiogroup" aria-label="Раздел для урока">
              {sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  role="radio"
                  aria-checked={activeLessonSectionId === section.id}
                  className={`choice-chip ${activeLessonSectionId === section.id ? "choice-chip-active" : ""}`}
                  onClick={() => setLessonSectionId(section.id)}
                >
                  {section.title}
                </button>
              ))}
            </div>
          )}
          <input
            type="text"
            placeholder="Название урока"
            className="w-full"
            value={lessonTitle}
            onChange={(event) => setLessonTitle(event.target.value)}
            required
          />
          <textarea
            placeholder="Описание урока"
            className="w-full"
            rows={3}
            value={lessonDescription}
            onChange={(event) => setLessonDescription(event.target.value)}
            required
          />
          <input
            type="url"
            placeholder="https://www.youtube.com/embed/..."
            className="w-full"
            value={lessonVideoUrl}
            onChange={(event) => setLessonVideoUrl(event.target.value)}
            required
          />
          <button type="submit" className="btn-primary" disabled={loading || sections.length === 0}>
            {loading ? "Создание..." : "Создать урок"}
          </button>
        </form>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <section className="panel-accent">
        <h2 className="mb-2 text-lg font-semibold">Созданные курсы/разделы/уроки</h2>
        {courses.length === 0 ? <p className="text-sm text-slate-500">Пока нет созданных курсов.</p> : null}

        <ul className="space-y-3">
          {courses.map((course) => {
            const relatedSections = sectionsByCourse[course.id] ?? [];

            return (
              <li key={course.id} className="rounded-lg border border-sky-100 bg-sky-50/30 p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-xs uppercase text-slate-500">{course.subject}</p>
                  <div className="flex gap-2">
                    <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => void editCourse(course)}>
                      Редактировать
                    </button>
                    <button type="button" className="btn-danger px-2 py-1 text-xs" onClick={() => void deleteCourse(course)}>
                      Удалить
                    </button>
                  </div>
                </div>
                <p className="font-medium">{course.title}</p>
                <p className="text-sm text-slate-600">{course.description}</p>
                <p className="mt-1 text-xs text-slate-400">ID курса: {course.id}</p>

                <div className="mt-2 space-y-2">
                  {relatedSections.length === 0 ? <p className="text-sm text-slate-500">Разделы пока не добавлены.</p> : null}

                  {relatedSections.map((section) => {
                    const relatedLessons = lessons.filter((lesson) => lesson.sectionId === section.id);

                    return (
                      <div key={section.id} className="rounded-md border border-sky-100 bg-white p-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">Раздел: {section.title}</p>
                          <div className="flex gap-2">
                            <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => void editSection(section)}>
                              Редактировать
                            </button>
                            <button type="button" className="btn-danger px-2 py-1 text-xs" onClick={() => void deleteSection(section)}>
                              Удалить
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400">ID раздела: {section.id}</p>
                        {relatedLessons.length === 0 ? (
                          <p className="mt-1 text-xs text-slate-500">Уроки пока не добавлены.</p>
                        ) : (
                          <ul className="mt-1 space-y-1 text-sm text-slate-700">
                            {relatedLessons.map((lesson) => (
                              <li key={lesson.id} className="rounded border border-sky-100 bg-sky-50/40 p-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span>
                                    Урок: {lesson.title} (<code>{lesson.id}</code>)
                                  </span>
                                  <div className="flex gap-2">
                                    <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => void editLesson(lesson)}>
                                      Редактировать
                                    </button>
                                    <button type="button" className="btn-danger px-2 py-1 text-xs" onClick={() => void deleteLesson(lesson)}>
                                      Удалить
                                    </button>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
