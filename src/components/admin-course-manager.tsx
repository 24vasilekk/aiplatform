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

type LessonKnowledge = {
  id: string;
  lessonId: string;
  originalName: string;
  mimeType: string;
  extractedText: string;
  summary: string | null;
  pageCount: number | null;
  textChars: number;
  updatedAt: string;
};

type CustomTask = {
  id: string;
  lessonId: string;
  type: "numeric" | "choice";
  question: string;
  options: string[] | null;
  answer: string;
  solution: string;
  createdAt: string;
};

type AdminUser = {
  id: string;
  email: string;
  role: "student" | "admin";
  createdAt: string;
};

export function AdminCourseManager({
  initialCourses,
  initialSections,
  initialLessons,
  initialTasks,
  initialUsers,
}: {
  initialCourses: Course[];
  initialSections: Section[];
  initialLessons: Lesson[];
  initialTasks: CustomTask[];
  initialUsers: AdminUser[];
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

  const [taskLessonId, setTaskLessonId] = useState(initialLessons[0]?.id ?? "");
  const [taskType, setTaskType] = useState<"numeric" | "choice">("numeric");
  const [taskQuestion, setTaskQuestion] = useState("");
  const [taskOptionsRaw, setTaskOptionsRaw] = useState("");
  const [taskAnswer, setTaskAnswer] = useState("");
  const [taskSolution, setTaskSolution] = useState("");

  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [sections, setSections] = useState<Section[]>(initialSections);
  const [lessons, setLessons] = useState<Lesson[]>(initialLessons);
  const [tasks, setTasks] = useState<CustomTask[]>(initialTasks);
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [selectedKnowledgeFiles, setSelectedKnowledgeFiles] = useState<Record<string, File | null>>({});
  const [knowledgeStatus, setKnowledgeStatus] = useState<Record<string, string>>({});
  const [lessonKnowledge, setLessonKnowledge] = useState<Record<string, LessonKnowledge | null>>({});
  const [adminTab, setAdminTab] = useState<"builder" | "content" | "users">("builder");
  const [builderStep, setBuilderStep] = useState<1 | 2 | 3 | 4>(1);

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

  const lessonsBySection = useMemo(() => {
    return lessons.reduce<Record<string, Lesson[]>>((acc, lesson) => {
      if (!acc[lesson.sectionId]) {
        acc[lesson.sectionId] = [];
      }
      acc[lesson.sectionId].push(lesson);
      return acc;
    }, {});
  }, [lessons]);

  const tasksByLesson = useMemo(() => {
    return tasks.reduce<Record<string, CustomTask[]>>((acc, task) => {
      if (!acc[task.lessonId]) {
        acc[task.lessonId] = [];
      }
      acc[task.lessonId].push(task);
      return acc;
    }, {});
  }, [tasks]);

  const activeSectionCourseId = courses.some((course) => course.id === sectionCourseId)
    ? sectionCourseId
    : (courses[0]?.id ?? "");
  const activeLessonSectionId = sections.some((section) => section.id === lessonSectionId)
    ? lessonSectionId
    : (sections[0]?.id ?? "");
  const activeTaskLessonId = lessons.some((lesson) => lesson.id === taskLessonId)
    ? taskLessonId
    : (lessons[0]?.id ?? "");

  async function loadCourses() {
    const response = await fetch("/api/admin/courses", { cache: "no-store" });
    if (!response.ok) return;

    const data = (await response.json()) as Course[];
    setCourses(data);
  }

  async function loadSections() {
    const response = await fetch("/api/admin/sections", { cache: "no-store" });
    if (!response.ok) return;

    const data = (await response.json()) as Section[];
    setSections(data);
  }

  async function loadLessons() {
    const response = await fetch("/api/admin/lessons", { cache: "no-store" });
    if (!response.ok) return;

    const data = (await response.json()) as Lesson[];
    setLessons(data);
    await Promise.all(data.map((lesson) => loadLessonKnowledgeByLessonId(lesson.id)));
  }

  async function loadTasks() {
    const response = await fetch("/api/admin/tasks", { cache: "no-store" });
    if (!response.ok) return;

    const data = (await response.json()) as CustomTask[];
    setTasks(data);
  }

  async function loadUsers() {
    const response = await fetch("/api/admin/users", { cache: "no-store" });
    if (!response.ok) return;

    const data = (await response.json()) as AdminUser[];
    setUsers(data);
  }

  async function refreshAll() {
    await Promise.all([loadCourses(), loadSections(), loadLessons(), loadTasks(), loadUsers()]);
  }

  async function loadLessonKnowledgeByLessonId(lessonId: string) {
    const response = await fetch(`/api/admin/lessons/${lessonId}/knowledge`, { cache: "no-store" });
    if (!response.ok) return;

    const data = (await response.json()) as { knowledge?: LessonKnowledge | null };
    setLessonKnowledge((current) => ({ ...current, [lessonId]: data.knowledge ?? null }));
  }

  async function uploadLessonKnowledge(lesson: Lesson) {
    const file = selectedKnowledgeFiles[lesson.id];
    if (!file) {
      setError("Выберите файл перед загрузкой");
      return;
    }

    setKnowledgeStatus((current) => ({ ...current, [lesson.id]: "Идет OCR и анализ файла..." }));
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`/api/admin/lessons/${lesson.id}/knowledge`, {
      method: "POST",
      body: formData,
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      knowledge?: LessonKnowledge;
    };

    if (!response.ok || !data.knowledge) {
      setKnowledgeStatus((current) => ({
        ...current,
        [lesson.id]: data.error ?? "Не удалось загрузить файл теории",
      }));
      return;
    }

    setLessonKnowledge((current) => ({ ...current, [lesson.id]: data.knowledge ?? null }));
    setSelectedKnowledgeFiles((current) => ({ ...current, [lesson.id]: null }));
    const pageLabel =
      data.knowledge.pageCount && data.knowledge.pageCount > 0
        ? ` · страниц: ${data.knowledge.pageCount}`
        : "";
    setKnowledgeStatus((current) => ({ ...current, [lesson.id]: `Файл теории обновлен${pageLabel}` }));
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

  async function onTaskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const options =
      taskType === "choice"
        ? taskOptionsRaw
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : undefined;

    const response = await fetch("/api/admin/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lessonId: activeTaskLessonId,
        type: taskType,
        question: taskQuestion,
        options,
        answer: taskAnswer,
        solution: taskSolution,
      }),
    });

    const data = (await response.json()) as { error?: string };
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Не удалось создать задание");
      return;
    }

    setTaskQuestion("");
    setTaskAnswer("");
    setTaskSolution("");
    setTaskOptionsRaw("");
    await loadTasks();
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
    if (!window.confirm(`Удалить курс \"${course.title}\"? Это удалит разделы, уроки и задания.`)) {
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
    if (!window.confirm(`Удалить раздел \"${section.title}\"? Это удалит его уроки и задания.`)) {
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
    if (!window.confirm(`Удалить урок \"${lesson.title}\"? Это удалит задания урока.`)) {
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

  async function editTask(task: CustomTask) {
    const nextQuestion = window.prompt("Новый текст задания", task.question);
    if (nextQuestion === null) return;

    const nextTypeRaw = window.prompt("Тип (numeric или choice)", task.type);
    if (nextTypeRaw === null) return;
    const nextType = nextTypeRaw === "choice" ? "choice" : "numeric";

    const nextOptionsRaw =
      nextType === "choice"
        ? window.prompt("Варианты через запятую", (task.options ?? []).join(", "))
        : null;
    if (nextType === "choice" && nextOptionsRaw === null) return;

    const nextAnswer = window.prompt("Правильный ответ", task.answer);
    if (nextAnswer === null) return;

    const nextSolution = window.prompt("Решение", task.solution);
    if (nextSolution === null) return;

    const response = await fetch(`/api/admin/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: nextType,
        question: nextQuestion,
        options:
          nextType === "choice"
            ? (nextOptionsRaw ?? "")
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean)
            : null,
        answer: nextAnswer,
        solution: nextSolution,
      }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Не удалось обновить задание");
      return;
    }

    await loadTasks();
  }

  async function deleteTask(task: CustomTask) {
    if (!window.confirm("Удалить это задание?")) {
      return;
    }

    const response = await fetch(`/api/admin/tasks/${task.id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Не удалось удалить задание");
      return;
    }

    await loadTasks();
  }

  return (
    <div className="space-y-4">
      <div className="panel-accent space-y-3">
        <h2 className="text-lg font-semibold">Админ-режим</h2>
        <div className="choice-group" role="tablist" aria-label="Разделы админки">
          <button
            type="button"
            role="tab"
            aria-selected={adminTab === "builder"}
            className={`choice-chip ${adminTab === "builder" ? "choice-chip-active" : ""}`}
            onClick={() => setAdminTab("builder")}
          >
            Конструктор
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={adminTab === "content"}
            className={`choice-chip ${adminTab === "content" ? "choice-chip-active" : ""}`}
            onClick={() => setAdminTab("content")}
          >
            Контент
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={adminTab === "users"}
            className={`choice-chip ${adminTab === "users" ? "choice-chip-active" : ""}`}
            onClick={() => setAdminTab("users")}
          >
            Пользователи
          </button>
        </div>
      </div>

      {adminTab === "builder" ? (
        <>
          <div className="panel-accent space-y-3">
            <p className="text-sm font-medium text-slate-700">Пошаговое создание</p>
            <div className="choice-group" role="tablist" aria-label="Шаги конструктора">
              <button
                type="button"
                role="tab"
                aria-selected={builderStep === 1}
                className={`choice-chip ${builderStep === 1 ? "choice-chip-active" : ""}`}
                onClick={() => setBuilderStep(1)}
              >
                1. Курс
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={builderStep === 2}
                className={`choice-chip ${builderStep === 2 ? "choice-chip-active" : ""}`}
                onClick={() => setBuilderStep(2)}
              >
                2. Раздел
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={builderStep === 3}
                className={`choice-chip ${builderStep === 3 ? "choice-chip-active" : ""}`}
                onClick={() => setBuilderStep(3)}
              >
                3. Урок
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={builderStep === 4}
                className={`choice-chip ${builderStep === 4 ? "choice-chip-active" : ""}`}
                onClick={() => setBuilderStep(4)}
              >
                4. Задание
              </button>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
        {builderStep === 1 ? <form className="panel-accent space-y-3" onSubmit={onCourseSubmit}>
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
        </form> : null}

        {builderStep === 2 ? <form className="panel-accent space-y-3" onSubmit={onSectionSubmit}>
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
        </form> : null}

        {builderStep === 3 ? <form className="panel-accent space-y-3" onSubmit={onLessonSubmit}>
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
        </form> : null}

        {builderStep === 4 ? <form className="panel-accent space-y-3" onSubmit={onTaskSubmit}>
          <h2 className="text-lg font-semibold">4. Создать задание (часть 1)</h2>
          {lessons.length === 0 ? (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
              Сначала создайте урок.
            </p>
          ) : (
            <div className="choice-group" role="radiogroup" aria-label="Урок для задания">
              {lessons.map((lesson) => (
                <button
                  key={lesson.id}
                  type="button"
                  role="radio"
                  aria-checked={activeTaskLessonId === lesson.id}
                  className={`choice-chip ${activeTaskLessonId === lesson.id ? "choice-chip-active" : ""}`}
                  onClick={() => setTaskLessonId(lesson.id)}
                >
                  {lesson.title}
                </button>
              ))}
            </div>
          )}

          <div className="choice-group" role="radiogroup" aria-label="Тип задания">
            <button
              type="button"
              role="radio"
              aria-checked={taskType === "numeric"}
              className={`choice-chip ${taskType === "numeric" ? "choice-chip-active" : ""}`}
              onClick={() => setTaskType("numeric")}
            >
              Число
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={taskType === "choice"}
              className={`choice-chip ${taskType === "choice" ? "choice-chip-active" : ""}`}
              onClick={() => setTaskType("choice")}
            >
              Варианты
            </button>
          </div>

          <textarea
            placeholder="Текст задания"
            className="w-full"
            rows={3}
            value={taskQuestion}
            onChange={(event) => setTaskQuestion(event.target.value)}
            required
          />

          {taskType === "choice" ? (
            <input
              type="text"
              placeholder="Варианты через запятую: 2, 4, 8, 16"
              className="w-full"
              value={taskOptionsRaw}
              onChange={(event) => setTaskOptionsRaw(event.target.value)}
              required
            />
          ) : null}

          <input
            type="text"
            placeholder="Правильный ответ"
            className="w-full"
            value={taskAnswer}
            onChange={(event) => setTaskAnswer(event.target.value)}
            required
          />
          <textarea
            placeholder="Решение"
            className="w-full"
            rows={3}
            value={taskSolution}
            onChange={(event) => setTaskSolution(event.target.value)}
            required
          />

          <button type="submit" className="btn-primary" disabled={loading || lessons.length === 0}>
            {loading ? "Создание..." : "Создать задание"}
          </button>
        </form> : null}
          </div>
        </>
      ) : null}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {adminTab === "content" ? <section className="panel-accent">
        <h2 className="mb-2 text-lg font-semibold">Созданные курсы/разделы/уроки/задания</h2>
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
                    const relatedLessons = lessonsBySection[section.id] ?? [];

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
                          <ul className="mt-1 space-y-2 text-sm text-slate-700">
                            {relatedLessons.map((lesson) => {
                              const relatedTasks = tasksByLesson[lesson.id] ?? [];

                              return (
                                <li key={lesson.id} className="rounded border border-sky-100 bg-sky-50/40 p-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span>
                                      Урок: {lesson.title} (<code>{lesson.id}</code>)
                                    </span>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        className="btn-ghost px-2 py-1 text-xs"
                                        onClick={() => void editLesson(lesson)}
                                      >
                                        Редактировать
                                      </button>
                                      <button
                                        type="button"
                                        className="btn-danger px-2 py-1 text-xs"
                                        onClick={() => void deleteLesson(lesson)}
                                      >
                                        Удалить
                                      </button>
                                    </div>
                                  </div>

                                  <div className="mt-2 space-y-2">
                                    <div className="rounded border border-slate-200 bg-white p-2">
                                      <p className="text-xs font-medium text-slate-700">Файл теории для AI-чата урока</p>
                                      <p className="text-xs text-slate-500">
                                        {lessonKnowledge[lesson.id]
                                          ? `Текущий файл: ${lessonKnowledge[lesson.id]?.originalName}`
                                          : "Файл еще не загружен"}
                                      </p>
                                      {lessonKnowledge[lesson.id] ? (
                                        <p className="text-xs text-slate-500">
                                          Индикатор: {lessonKnowledge[lesson.id]?.pageCount ?? "?"} стр. ·{" "}
                                          {lessonKnowledge[lesson.id]?.textChars ?? 0} символов
                                        </p>
                                      ) : null}
                                      {lessonKnowledge[lesson.id]?.summary ? (
                                        <p className="mt-1 rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
                                          Выжимка: {lessonKnowledge[lesson.id]?.summary}
                                        </p>
                                      ) : null}
                                      <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <input
                                          type="file"
                                          className="text-xs"
                                          onChange={(event) =>
                                            setSelectedKnowledgeFiles((current) => ({
                                              ...current,
                                              [lesson.id]: event.target.files?.[0] ?? null,
                                            }))
                                          }
                                        />
                                        <button
                                          type="button"
                                          className="btn-ghost px-2 py-1 text-xs"
                                          onClick={() => void uploadLessonKnowledge(lesson)}
                                        >
                                          Загрузить теорию
                                        </button>
                                      </div>
                                      {knowledgeStatus[lesson.id] ? (
                                        <p className="mt-1 text-xs text-slate-600">{knowledgeStatus[lesson.id]}</p>
                                      ) : null}
                                    </div>
                                    {relatedTasks.length === 0 ? (
                                      <p className="text-xs text-slate-500">Задания пока не добавлены.</p>
                                    ) : (
                                      relatedTasks.map((task) => (
                                        <div key={task.id} className="rounded border border-sky-200 bg-white p-2">
                                          <div className="flex items-center justify-between gap-2">
                                            <p className="text-xs text-slate-500">
                                              {task.type === "numeric" ? "Числовой ответ" : "Выбор варианта"}
                                            </p>
                                            <div className="flex gap-2">
                                              <button
                                                type="button"
                                                className="btn-ghost px-2 py-1 text-xs"
                                                onClick={() => void editTask(task)}
                                              >
                                                Редактировать
                                              </button>
                                              <button
                                                type="button"
                                                className="btn-danger px-2 py-1 text-xs"
                                                onClick={() => void deleteTask(task)}
                                              >
                                                Удалить
                                              </button>
                                            </div>
                                          </div>
                                          <p className="text-sm font-medium">{task.question}</p>
                                          {task.options?.length ? (
                                            <p className="text-xs text-slate-600">Варианты: {task.options.join(", ")}</p>
                                          ) : null}
                                          <p className="text-xs text-slate-600">Ответ: {task.answer}</p>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </li>
                              );
                            })}
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
      </section> : null}

      {adminTab === "users" ? <section className="panel-accent">
        <h2 className="mb-2 text-lg font-semibold">Пользователи</h2>
        {users.length === 0 ? (
          <p className="text-sm text-slate-500">Пока пользователей нет.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {users.map((user) => (
              <li key={user.id} className="rounded-md border border-sky-100 bg-sky-50/30 p-2">
                <p className="font-medium">{user.email}</p>
                <p className="text-xs text-slate-500">Роль: {user.role}</p>
              </li>
            ))}
          </ul>
        )}
      </section> : null}
    </div>
  );
}
