"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type TutorCourse = {
  id: string;
  ownerId: string | null;
  title: string;
  description: string;
  subject: "math" | "physics";
  createdAt: string;
};

type TutorSection = {
  id: string;
  courseId: string;
  title: string;
  createdAt: string;
};

type TutorLesson = {
  id: string;
  sectionId: string;
  title: string;
  description: string;
  videoUrl: string;
  createdAt: string;
};

type TutorTask = {
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

type LessonFile = {
  id: string;
  lessonId: string;
  originalName: string;
  mimeType: string;
  summary: string | null;
  pageCount: number | null;
  textChars: number;
  updatedAt: string;
};

type PagedApiResponse<T> = {
  items: T[];
  total: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiErrorMessage(status: number, payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "string"
  ) {
    return (payload as { error: string }).error;
  }
  if (status === 401) return "Сессия истекла. Войдите снова.";
  if (status === 403) return "Недостаточно прав для этой операции.";
  if (status === 404) return "Запись не найдена или уже удалена.";
  if (status === 429) return "Слишком много запросов. Подождите и повторите.";
  if (status >= 500) return "Сервис временно недоступен. Попробуйте еще раз.";
  return fallback;
}

async function fetchJsonWithRetry<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: { retries?: number; timeoutMs?: number; fallbackMessage?: string },
) {
  const retries = Math.max(0, options?.retries ?? 0);
  const timeoutMs = Math.max(1_000, options?.timeoutMs ?? 12_000);
  const fallbackMessage = options?.fallbackMessage ?? "Не удалось выполнить запрос.";

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      const payload = (await response.json().catch(() => ({}))) as unknown;
      if (!response.ok) {
        const message = getApiErrorMessage(response.status, payload, fallbackMessage);
        if (response.status >= 500 && attempt < retries) {
          await sleep(250 * (attempt + 1));
          continue;
        }
        throw new Error(message);
      }
      return payload as T;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        if (attempt < retries) {
          await sleep(250 * (attempt + 1));
          continue;
        }
        throw new Error("Сервер отвечает слишком долго. Повторите попытку.");
      }
      if (attempt < retries) {
        await sleep(250 * (attempt + 1));
        continue;
      }
      if (error instanceof Error) throw error;
      throw new Error(fallbackMessage);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(fallbackMessage);
}

export function TutorLmsManager({
  initialCourses,
  initialSections,
  initialLessons,
  initialTasks,
}: {
  initialCourses: TutorCourse[];
  initialSections: TutorSection[];
  initialLessons: TutorLesson[];
  initialTasks: TutorTask[];
}) {
  const [courses, setCourses] = useState<TutorCourse[]>(initialCourses);
  const [sections, setSections] = useState<TutorSection[]>(initialSections);
  const [lessons, setLessons] = useState<TutorLesson[]>(initialLessons);
  const [tasks, setTasks] = useState<TutorTask[]>(initialTasks);
  const [selectedCourseId, setSelectedCourseId] = useState(initialCourses[0]?.id ?? "");
  const [selectedSectionId, setSelectedSectionId] = useState(initialSections[0]?.id ?? "");
  const [selectedLessonId, setSelectedLessonId] = useState(initialLessons[0]?.id ?? "");
  const [lessonFile, setLessonFile] = useState<LessonFile | null>(null);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [retryLabel, setRetryLabel] = useState<string | null>(null);
  const retryActionRef = useRef<null | (() => Promise<void>)>(null);
  const tasksRequestSeqRef = useRef(0);
  const lessonFileRequestSeqRef = useRef(0);

  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [courseSubject, setCourseSubject] = useState<"math" | "physics">("math");

  const [sectionTitle, setSectionTitle] = useState("");

  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDescription, setLessonDescription] = useState("");
  const [lessonVideoUrl, setLessonVideoUrl] = useState("https://www.youtube.com/embed/dQw4w9WgXcQ");

  const [taskType, setTaskType] = useState<"numeric" | "choice">("numeric");
  const [taskQuestion, setTaskQuestion] = useState("");
  const [taskAnswer, setTaskAnswer] = useState("");
  const [taskSolution, setTaskSolution] = useState("");
  const [taskOptionsRaw, setTaskOptionsRaw] = useState("");
  const [taskStatus, setTaskStatus] = useState<"published" | "unpublished" | "archived">("published");
  const [taskDifficulty, setTaskDifficulty] = useState<1 | 2 | 3 | 4 | 5>(2);

  const filteredSections = useMemo(
    () => sections.filter((section) => section.courseId === selectedCourseId),
    [sections, selectedCourseId],
  );
  const filteredLessons = useMemo(
    () => lessons.filter((lesson) => lesson.sectionId === selectedSectionId),
    [lessons, selectedSectionId],
  );
  const filteredTasks = useMemo(
    () => tasks.filter((task) => task.lessonId === selectedLessonId),
    [tasks, selectedLessonId],
  );

  function setRetryAction(label: string | null, action?: () => Promise<void>) {
    setRetryLabel(label);
    retryActionRef.current = action ?? null;
  }

  async function loadCourses() {
    const data = await fetchJsonWithRetry<PagedApiResponse<TutorCourse>>(
      "/api/tutor/lms/courses?take=120&skip=0",
      { cache: "no-store" },
      { retries: 1, fallbackMessage: "Не удалось загрузить курсы." },
    );
    setCourses(data.items ?? []);
  }

  async function loadSections() {
    const params = new URLSearchParams({ take: "180", skip: "0" });
    if (selectedCourseId) params.set("courseId", selectedCourseId);
    const data = await fetchJsonWithRetry<PagedApiResponse<TutorSection>>(
      `/api/tutor/lms/sections?${params.toString()}`,
      { cache: "no-store" },
      { retries: 1, fallbackMessage: "Не удалось загрузить разделы." },
    );
    setSections(data.items ?? []);
  }

  async function loadLessons() {
    const params = new URLSearchParams({ take: "240", skip: "0" });
    if (selectedSectionId) params.set("sectionId", selectedSectionId);
    const data = await fetchJsonWithRetry<PagedApiResponse<TutorLesson>>(
      `/api/tutor/lms/lessons?${params.toString()}`,
      { cache: "no-store" },
      { retries: 1, fallbackMessage: "Не удалось загрузить уроки." },
    );
    setLessons(data.items ?? []);
  }

  async function loadTasks() {
    const requestSeq = ++tasksRequestSeqRef.current;
    const params = new URLSearchParams({ take: "320", skip: "0" });
    if (selectedLessonId) params.set("lessonId", selectedLessonId);
    const data = await fetchJsonWithRetry<PagedApiResponse<TutorTask>>(
      `/api/tutor/lms/tasks?${params.toString()}`,
      { cache: "no-store" },
      { retries: 1, fallbackMessage: "Не удалось загрузить задания." },
    );
    if (requestSeq !== tasksRequestSeqRef.current) return;
    setTasks(data.items ?? []);
  }

  async function loadLessonFile() {
    const requestSeq = ++lessonFileRequestSeqRef.current;
    if (!selectedLessonId) {
      setLessonFile(null);
      return;
    }
    const data = await fetchJsonWithRetry<{ knowledge: LessonFile | null }>(
      `/api/tutor/lms/lessons/${selectedLessonId}/files`,
      { cache: "no-store" },
      { retries: 1, fallbackMessage: "Не удалось загрузить файл урока." },
    );
    if (requestSeq !== lessonFileRequestSeqRef.current) return;
    setLessonFile(data.knowledge ?? null);
  }

  async function refreshAll() {
    setError(null);
    setStatus("Обновляем данные...");
    setRetryAction(null);
    try {
      await Promise.all([loadCourses(), loadSections(), loadLessons(), loadTasks(), loadLessonFile()]);
      setStatus("Данные обновлены.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось обновить данные кабинета.");
      setStatus(null);
      setRetryAction("Повторить обновление", async () => {
        await refreshAll();
      });
    }
  }

  async function onCreateCourse(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setStatus(null);
    setRetryAction(null);
    try {
      const data = await fetchJsonWithRetry<{ course: TutorCourse }>(
        "/api/tutor/lms/courses",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: courseTitle,
            description: courseDescription,
            subject: courseSubject,
          }),
        },
        { fallbackMessage: "Не удалось создать курс." },
      );
      if (!data.course) {
        throw new Error("Не удалось создать курс.");
      }
      setCourseTitle("");
      setCourseDescription("");
      setCourses((current) => [...current, data.course]);
      setSelectedCourseId(data.course.id);
      setStatus("Курс создан.");
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Не удалось создать курс.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function onCreateSection(event: FormEvent) {
    event.preventDefault();
    if (!selectedCourseId || loading) return;
    setLoading(true);
    setError(null);
    setRetryAction(null);
    try {
      const data = await fetchJsonWithRetry<{ section: TutorSection }>(
        "/api/tutor/lms/sections",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ courseId: selectedCourseId, title: sectionTitle }),
        },
        { fallbackMessage: "Не удалось создать раздел." },
      );
      if (!data.section) {
        throw new Error("Не удалось создать раздел.");
      }
      setSectionTitle("");
      setSections((current) => [...current, data.section]);
      setSelectedSectionId(data.section.id);
      setStatus("Раздел создан.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось создать раздел.");
    } finally {
      setLoading(false);
    }
  }

  async function onCreateLesson(event: FormEvent) {
    event.preventDefault();
    if (!selectedSectionId || loading) return;
    setLoading(true);
    setError(null);
    setRetryAction(null);
    try {
      const data = await fetchJsonWithRetry<{ lesson: TutorLesson }>(
        "/api/tutor/lms/lessons",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sectionId: selectedSectionId,
            title: lessonTitle,
            description: lessonDescription,
            videoUrl: lessonVideoUrl,
          }),
        },
        { fallbackMessage: "Не удалось создать урок." },
      );
      if (!data.lesson) {
        throw new Error("Не удалось создать урок.");
      }
      setLessonTitle("");
      setLessonDescription("");
      setLessons((current) => [...current, data.lesson]);
      setSelectedLessonId(data.lesson.id);
      setStatus("Урок создан.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось создать урок.");
    } finally {
      setLoading(false);
    }
  }

  async function onCreateTask(event: FormEvent) {
    event.preventDefault();
    if (!selectedLessonId || loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJsonWithRetry<{ task: TutorTask }>(
        "/api/tutor/lms/tasks",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            lessonId: selectedLessonId,
            type: taskType,
            status: taskStatus,
            question: taskQuestion,
            options:
              taskType === "choice"
                ? taskOptionsRaw
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean)
                : undefined,
            answer: taskAnswer,
            solution: taskSolution,
            difficulty: taskDifficulty,
          }),
        },
        { fallbackMessage: "Не удалось создать задание." },
      );
      if (!data.task) {
        throw new Error("Не удалось создать задание.");
      }
      setTaskQuestion("");
      setTaskAnswer("");
      setTaskSolution("");
      setTaskOptionsRaw("");
      setTasks((current) => [...current, data.task]);
      setStatus("Задание создано.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось создать задание.");
    } finally {
      setLoading(false);
    }
  }

  async function uploadLessonFile() {
    if (!selectedLessonId || !fileToUpload || loading) return;
    setLoading(true);
    setError(null);
    setRetryAction(null);
    const formData = new FormData();
    formData.append("file", fileToUpload);
    try {
      const data = await fetchJsonWithRetry<{ knowledge: LessonFile }>(
        `/api/tutor/lms/lessons/${selectedLessonId}/files`,
        {
          method: "POST",
          body: formData,
        },
        { fallbackMessage: "Не удалось загрузить файл урока." },
      );
      if (!data.knowledge) {
        throw new Error("Не удалось загрузить файл урока.");
      }
      setLessonFile(data.knowledge);
      setFileToUpload(null);
      setStatus("Файл урока загружен.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось загрузить файл урока.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteLessonFile() {
    if (!selectedLessonId || loading) return;
    if (!window.confirm("Удалить файл урока?")) return;
    setLoading(true);
    setError(null);
    try {
      await fetchJsonWithRetry<{ ok: boolean }>(
        `/api/tutor/lms/lessons/${selectedLessonId}/files`,
        { method: "DELETE" },
        { fallbackMessage: "Не удалось удалить файл урока." },
      );
      setLessonFile(null);
      setStatus("Файл урока удален.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось удалить файл урока.");
    } finally {
      setLoading(false);
    }
  }

  async function editCourse(course: TutorCourse) {
    if (loading) return;
    const title = window.prompt("Новое название курса", course.title);
    if (!title) return;
    setLoading(true);
    setError(null);
    try {
      await fetchJsonWithRetry<{ ok: boolean }>(
        `/api/tutor/lms/courses/${course.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title }),
        },
        { fallbackMessage: "Не удалось обновить курс." },
      );
      await loadCourses();
      setStatus("Курс обновлен.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось обновить курс.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteCourse(course: TutorCourse) {
    if (loading) return;
    if (!window.confirm("Удалить курс и всё его содержимое?")) return;
    setLoading(true);
    setError(null);
    try {
      await fetchJsonWithRetry<{ ok: boolean }>(
        `/api/tutor/lms/courses/${course.id}`,
        { method: "DELETE" },
        { fallbackMessage: "Не удалось удалить курс." },
      );
      setCourses((current) => current.filter((item) => item.id !== course.id));
      setSelectedCourseId("");
      await refreshAll();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось удалить курс.");
    } finally {
      setLoading(false);
    }
  }

  async function editSection(section: TutorSection) {
    if (loading) return;
    const title = window.prompt("Новое название раздела", section.title);
    if (!title) return;
    setLoading(true);
    setError(null);
    try {
      await fetchJsonWithRetry<{ ok: boolean }>(
        `/api/tutor/lms/sections/${section.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title }),
        },
        { fallbackMessage: "Не удалось обновить раздел." },
      );
      await loadSections();
      setStatus("Раздел обновлен.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось обновить раздел.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteSection(section: TutorSection) {
    if (loading) return;
    if (!window.confirm("Удалить раздел и все уроки?")) return;
    setLoading(true);
    setError(null);
    try {
      await fetchJsonWithRetry<{ ok: boolean }>(
        `/api/tutor/lms/sections/${section.id}`,
        { method: "DELETE" },
        { fallbackMessage: "Не удалось удалить раздел." },
      );
      await refreshAll();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось удалить раздел.");
    } finally {
      setLoading(false);
    }
  }

  async function editLesson(lesson: TutorLesson) {
    if (loading) return;
    const title = window.prompt("Новое название урока", lesson.title);
    if (!title) return;
    const videoUrl = window.prompt("Новый videoUrl", lesson.videoUrl) ?? lesson.videoUrl;
    setLoading(true);
    setError(null);
    try {
      await fetchJsonWithRetry<{ ok: boolean }>(
        `/api/tutor/lms/lessons/${lesson.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title, videoUrl }),
        },
        { fallbackMessage: "Не удалось обновить урок." },
      );
      await loadLessons();
      setStatus("Урок обновлен.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось обновить урок.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteLesson(lesson: TutorLesson) {
    if (loading) return;
    if (!window.confirm("Удалить урок и его задания?")) return;
    setLoading(true);
    setError(null);
    try {
      await fetchJsonWithRetry<{ ok: boolean }>(
        `/api/tutor/lms/lessons/${lesson.id}`,
        { method: "DELETE" },
        { fallbackMessage: "Не удалось удалить урок." },
      );
      await refreshAll();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось удалить урок.");
    } finally {
      setLoading(false);
    }
  }

  async function editTask(task: TutorTask) {
    if (loading) return;
    const question = window.prompt("Новый текст задания", task.question);
    if (!question) return;
    setLoading(true);
    setError(null);
    try {
      await fetchJsonWithRetry<{ ok: boolean }>(
        `/api/tutor/lms/tasks/${task.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question }),
        },
        { fallbackMessage: "Не удалось обновить задание." },
      );
      await loadTasks();
      setStatus("Задание обновлено.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось обновить задание.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteTask(task: TutorTask) {
    if (loading) return;
    if (!window.confirm("Удалить задание?")) return;
    setLoading(true);
    setError(null);
    try {
      await fetchJsonWithRetry<{ ok: boolean }>(
        `/api/tutor/lms/tasks/${task.id}`,
        { method: "DELETE" },
        { fallbackMessage: "Не удалось удалить задание." },
      );
      await loadTasks();
      setStatus("Задание удалено.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось удалить задание.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedCourseId) {
      setSections([]);
      setSelectedSectionId("");
      return;
    }
    void loadSections().catch((nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Не удалось загрузить разделы.");
      setRetryAction("Повторить загрузку разделов", async () => {
        await loadSections();
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId]);

  useEffect(() => {
    if (!selectedSectionId) {
      setLessons([]);
      setSelectedLessonId("");
      return;
    }
    void loadLessons().catch((nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Не удалось загрузить уроки.");
      setRetryAction("Повторить загрузку уроков", async () => {
        await loadLessons();
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSectionId]);

  useEffect(() => {
    if (!selectedLessonId) {
      setTasks([]);
      setLessonFile(null);
      return;
    }
    void Promise.all([loadTasks(), loadLessonFile()]).catch((nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Не удалось загрузить данные урока.");
      setRetryAction("Повторить загрузку урока", async () => {
        await Promise.all([loadTasks(), loadLessonFile()]);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLessonId]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1>Кабинет репетитора (LMS)</h1>
          <p className="text-sm text-slate-700">
            Управляйте своими курсами, уроками и материалами. Доступ только к вашим данным.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost" disabled={loading} onClick={() => void refreshAll()}>
            {loading ? "Обновление..." : "Обновить"}
          </button>
          {retryActionRef.current ? (
            <button
              type="button"
              className="btn-ghost"
              disabled={loading}
              onClick={() => {
                if (!retryActionRef.current) return;
                void retryActionRef.current();
              }}
            >
              {retryLabel ?? "Повторить"}
            </button>
          ) : null}
        </div>
      </div>
      {status ? <p className="text-sm text-emerald-700">{status}</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Курсы</h2>
          <form className="mt-2 space-y-2" onSubmit={(event) => void onCreateCourse(event)}>
            <input value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} placeholder="Название курса" />
            <textarea value={courseDescription} onChange={(e) => setCourseDescription(e.target.value)} placeholder="Описание курса" />
            <select value={courseSubject} onChange={(e) => setCourseSubject(e.target.value as "math" | "physics")}>
              <option value="math">math</option>
              <option value="physics">physics</option>
            </select>
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? "Сохраняем..." : "Создать курс"}
            </button>
          </form>
          {courses.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Пока нет курсов.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {courses.map((course) => (
                <li key={course.id} className="rounded border border-slate-200 p-2">
                  <button
                    type="button"
                    className={`text-left font-medium ${selectedCourseId === course.id ? "text-sky-700" : ""}`}
                    disabled={loading}
                    onClick={() => {
                      setSelectedCourseId(course.id);
                      setSelectedSectionId("");
                      setSelectedLessonId("");
                    }}
                  >
                    {course.title}
                  </button>
                  <p className="text-xs text-slate-500">{course.subject}</p>
                  <div className="mt-1 flex gap-2">
                    <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => void editCourse(course)}>
                      Редактировать
                    </button>
                    <button
                      type="button"
                      className="btn-danger px-2 py-1 text-xs"
                      disabled={loading}
                      onClick={() => void deleteCourse(course)}
                    >
                      Удалить
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Разделы</h2>
          {!selectedCourseId ? <p className="mt-2 text-sm text-slate-500">Сначала выберите курс.</p> : null}
          <form className="mt-2 space-y-2" onSubmit={(event) => void onCreateSection(event)}>
            <input value={sectionTitle} onChange={(e) => setSectionTitle(e.target.value)} placeholder="Название раздела" />
            <button className="btn-primary" type="submit" disabled={loading || !selectedCourseId}>
              Создать раздел
            </button>
          </form>
          {filteredSections.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">В этом курсе пока нет разделов.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {filteredSections.map((section) => (
                <li key={section.id} className="rounded border border-slate-200 p-2">
                  <button
                    type="button"
                    className={`text-left font-medium ${selectedSectionId === section.id ? "text-sky-700" : ""}`}
                    disabled={loading}
                    onClick={() => {
                      setSelectedSectionId(section.id);
                      setSelectedLessonId("");
                    }}
                  >
                    {section.title}
                  </button>
                  <div className="mt-1 flex gap-2">
                    <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => void editSection(section)}>
                      Редактировать
                    </button>
                    <button
                      type="button"
                      className="btn-danger px-2 py-1 text-xs"
                      disabled={loading}
                      onClick={() => void deleteSection(section)}
                    >
                      Удалить
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Уроки и видео</h2>
          {!selectedSectionId ? <p className="mt-2 text-sm text-slate-500">Сначала выберите раздел.</p> : null}
          <form className="mt-2 space-y-2" onSubmit={(event) => void onCreateLesson(event)}>
            <input value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} placeholder="Название урока" />
            <textarea value={lessonDescription} onChange={(e) => setLessonDescription(e.target.value)} placeholder="Описание урока" />
            <input value={lessonVideoUrl} onChange={(e) => setLessonVideoUrl(e.target.value)} placeholder="Ссылка на видео" />
            <button className="btn-primary" type="submit" disabled={loading || !selectedSectionId}>
              Создать урок
            </button>
          </form>
          {filteredLessons.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">В этом разделе пока нет уроков.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {filteredLessons.map((lesson) => (
                <li key={lesson.id} className="rounded border border-slate-200 p-2">
                  <button
                    type="button"
                    className={`text-left font-medium ${selectedLessonId === lesson.id ? "text-sky-700" : ""}`}
                    disabled={loading}
                    onClick={() => {
                      setSelectedLessonId(lesson.id);
                    }}
                  >
                    {lesson.title}
                  </button>
                  <p className="text-xs text-slate-500">{lesson.videoUrl}</p>
                  <div className="mt-1 flex gap-2">
                    <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => void editLesson(lesson)}>
                      Редактировать
                    </button>
                    <button
                      type="button"
                      className="btn-danger px-2 py-1 text-xs"
                      disabled={loading}
                      onClick={() => void deleteLesson(lesson)}
                    >
                      Удалить
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Файлы урока</h2>
          {!selectedLessonId ? (
            <p className="mt-2 text-sm text-slate-500">Сначала выберите урок.</p>
          ) : (
            <div className="mt-2 space-y-2">
              <input type="file" onChange={(e) => setFileToUpload(e.target.files?.[0] ?? null)} />
              <div className="flex gap-2">
                <button type="button" className="btn-primary" disabled={!fileToUpload || loading} onClick={() => void uploadLessonFile()}>
                  Загрузить файл
                </button>
                <button type="button" className="btn-ghost" onClick={() => void loadLessonFile()}>
                  Обновить
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  disabled={!lessonFile || loading}
                  onClick={() => void deleteLessonFile()}
                >
                  Удалить файл
                </button>
              </div>
              {!lessonFile ? (
                <p className="text-sm text-slate-500">
                  Файл пока не загружен. Добавьте PDF/DOCX/TXT, чтобы использовать AI-контекст в уроке.
                </p>
              ) : (
                <div className="rounded border border-slate-200 bg-slate-50 p-2 text-sm">
                  <p className="font-medium">{lessonFile.originalName}</p>
                  <p className="text-xs text-slate-600">
                    {lessonFile.mimeType} · {lessonFile.textChars} символов · стр.: {lessonFile.pageCount ?? "—"}
                  </p>
                  {lessonFile.summary ? <p className="mt-1 text-xs text-slate-700">{lessonFile.summary}</p> : null}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Задания урока</h2>
        {!selectedLessonId ? <p className="mt-2 text-sm text-slate-500">Сначала выберите урок.</p> : null}
        <form className="mt-2 grid gap-2 md:grid-cols-2" onSubmit={(event) => void onCreateTask(event)}>
          <select value={taskType} onChange={(e) => setTaskType(e.target.value as "numeric" | "choice")}>
            <option value="numeric">numeric</option>
            <option value="choice">choice</option>
          </select>
          <select
            value={taskStatus}
            onChange={(e) => setTaskStatus(e.target.value as "published" | "unpublished" | "archived")}
          >
            <option value="published">published</option>
            <option value="unpublished">unpublished</option>
            <option value="archived">archived</option>
          </select>
          <input value={taskQuestion} onChange={(e) => setTaskQuestion(e.target.value)} placeholder="Текст задания" />
          <input value={taskAnswer} onChange={(e) => setTaskAnswer(e.target.value)} placeholder="Ответ" />
          <input value={taskSolution} onChange={(e) => setTaskSolution(e.target.value)} placeholder="Решение" />
          <input
            value={taskOptionsRaw}
            onChange={(e) => setTaskOptionsRaw(e.target.value)}
            placeholder="Варианты через запятую (для choice)"
          />
          <select
            value={String(taskDifficulty)}
            onChange={(e) => setTaskDifficulty(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
          <button className="btn-primary" type="submit" disabled={loading || !selectedLessonId}>
            Создать задание
          </button>
        </form>

        {filteredTasks.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">В уроке пока нет заданий.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {filteredTasks.map((task) => (
              <li key={task.id} className="rounded border border-slate-200 p-2">
                <p className="font-medium">{task.question}</p>
                <p className="text-xs text-slate-500">
                  {task.type} · {task.status} · {task.difficulty}/5
                </p>
                {task.options?.length ? <p className="text-xs text-slate-600">Опции: {task.options.join(", ")}</p> : null}
                <div className="mt-1 flex gap-2">
                  <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={loading} onClick={() => void editTask(task)}>
                    Редактировать
                  </button>
                  <button
                    type="button"
                    className="btn-danger px-2 py-1 text-xs"
                    disabled={loading}
                    onClick={() => void deleteTask(task)}
                  >
                    Удалить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
