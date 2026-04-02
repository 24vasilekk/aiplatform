"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

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

type AdminUser = {
  id: string;
  email: string;
  role: "student" | "tutor" | "admin";
  createdAt: string;
};

type AdminAuditEventName =
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

type AdminAuditPayment = {
  id: string;
  userId: string;
  userEmail: string;
  planId: string;
  amountCents: number;
  currency: string;
  status: "created" | "requires_action" | "processing" | "succeeded" | "failed" | "canceled";
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

type AdminAuditWallet = {
  id: string;
  userId: string;
  balanceCents: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

type AdminAuditWalletTransaction = {
  id: string;
  walletId: string;
  userId: string;
  direction: "credit" | "debit";
  operationType: "topup" | "purchase" | "refund" | "manual_adjustment";
  amountCents: number;
  balanceBefore: number;
  balanceAfter: number;
  paymentIntentId: string | null;
  idempotencyKey: string | null;
  metadata: unknown;
  createdAt: string;
};

type AdminAuditCourseAccess = {
  id: string;
  userId: string;
  courseId: string;
  courseTitle: string;
  accessType: "trial" | "subscription" | "purchase";
  expiresAt: string | null;
};

type AdminAuditTaskProgress = {
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

type AdminAuditLessonProgress = {
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
  tasks: AdminAuditTaskProgress[];
};

type AdminAuditCourseProgress = {
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
  lessons: AdminAuditLessonProgress[];
};

type AdminAuditProgressSnapshot = {
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
  courses: AdminAuditCourseProgress[];
};

type AdminAuditActivityEvent = {
  id: string;
  eventName: AdminAuditEventName;
  userId: string | null;
  path: string | null;
  payload: unknown;
  createdAt: string;
};

type AdminUserAudit = {
  user: AdminUser;
  accesses: AdminAuditCourseAccess[];
  progress: AdminAuditProgressSnapshot;
  payments: {
    items: AdminAuditPayment[];
    total: number;
  };
  aiAnalyses: {
    items: AdminAiAnalysis[];
    total: number;
  };
  wallet: {
    wallet: AdminAuditWallet;
    transactions: {
      items: AdminAuditWalletTransaction[];
      total: number;
    };
  };
  activityEvents: {
    items: AdminAuditActivityEvent[];
    total: number;
  };
};

const USER_360_TABS = [
  { id: "overview", label: "Обзор" },
  { id: "payments", label: "Платежи" },
  { id: "wallet", label: "Кошелек" },
  { id: "accesses", label: "Доступы" },
  { id: "progress", label: "Прогресс" },
  { id: "ai", label: "AI" },
  { id: "events", label: "События" },
  { id: "actions", label: "Быстрые действия" },
] as const;

const AUDIT_EVENT_FILTERS: Array<{ value: "all" | AdminAuditEventName; label: string }> = [
  { value: "all", label: "Все события" },
  { value: "checkout_created", label: "checkout_created" },
  { value: "payment_succeeded", label: "payment_succeeded" },
  { value: "payment_failed", label: "payment_failed" },
  { value: "payment_canceled", label: "payment_canceled" },
  { value: "ai_chat_message", label: "ai_chat_message" },
  { value: "ai_solution_analyzed", label: "ai_solution_analyzed" },
  { value: "lesson_progress_updated", label: "lesson_progress_updated" },
  { value: "task_checked", label: "task_checked" },
  { value: "login_success", label: "login_success" },
  { value: "registration_success", label: "registration_success" },
];

type AdminAiAnalysis = {
  id: string;
  userId: string;
  lessonId: string | null;
  taskId: string | null;
  mode: "default" | "beginner" | "similar_task";
  status: "queued" | "running" | "completed" | "failed";
  model: string | null;
  latencyMs: number | null;
  result: {
    verdict?: string;
    scorePercent?: number;
    conciseSummary?: string;
  } | null;
  error: {
    code?: string;
    message?: string;
  } | null;
  createdAt: string;
};

type AdminDatasetFile = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  processingStatus: "uploaded" | "processing" | "parsed" | "ready" | "failed";
  textChars: number;
  chunkCount: number;
  processingError: string | null;
  createdAt: string;
};

type PagedApiResponse<T> = {
  items: T[];
  total: number;
  take: number;
  skip: number;
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
  const [taskStatus, setTaskStatus] = useState<"published" | "unpublished">("published");
  const [taskQuestion, setTaskQuestion] = useState("");
  const [taskOptionsRaw, setTaskOptionsRaw] = useState("");
  const [taskAnswer, setTaskAnswer] = useState("");
  const [taskSolution, setTaskSolution] = useState("");
  const [taskDifficulty, setTaskDifficulty] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [taskTopicTagsRaw, setTaskTopicTagsRaw] = useState("");
  const [taskExemplarSolution, setTaskExemplarSolution] = useState("");
  const [taskCriteriaRaw, setTaskCriteriaRaw] = useState("");

  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [sections, setSections] = useState<Section[]>(initialSections);
  const [lessons, setLessons] = useState<Lesson[]>(initialLessons);
  const [tasks, setTasks] = useState<CustomTask[]>(initialTasks);
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [usersTotal, setUsersTotal] = useState(initialUsers.length);
  const [usersTake] = useState(50);
  const [usersSkip, setUsersSkip] = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedKnowledgeFiles, setSelectedKnowledgeFiles] = useState<Record<string, File | null>>({});
  const [knowledgeStatus, setKnowledgeStatus] = useState<Record<string, string>>({});
  const [lessonKnowledge, setLessonKnowledge] = useState<Record<string, LessonKnowledge | null>>({});
  const [adminTab, setAdminTab] = useState<"builder" | "content" | "users" | "ai_quality">("builder");
  const [builderStep, setBuilderStep] = useState<1 | 2 | 3 | 4>(1);
  const [aiAnalyses, setAiAnalyses] = useState<AdminAiAnalysis[]>([]);
  const [aiAnalysesLoading, setAiAnalysesLoading] = useState(false);
  const [aiFilterTaskId, setAiFilterTaskId] = useState("");
  const [aiFilterMode, setAiFilterMode] = useState<"all" | "default" | "beginner" | "similar_task">("all");
  const [datasetFiles, setDatasetFiles] = useState<AdminDatasetFile[]>([]);
  const [datasetFileToUpload, setDatasetFileToUpload] = useState<File | null>(null);
  const [datasetUploadStatus, setDatasetUploadStatus] = useState<string | null>(null);
  const [datasetUploading, setDatasetUploading] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [bulkTaskActionLoading, setBulkTaskActionLoading] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [selectedAuditUserId, setSelectedAuditUserId] = useState<string | null>(
    initialUsers.find((user) => user.role !== "admin")?.id ?? null,
  );
  const [userAudit, setUserAudit] = useState<AdminUserAudit | null>(null);
  const [userAuditLoading, setUserAuditLoading] = useState(false);
  const [userAuditError, setUserAuditError] = useState<string | null>(null);
  const [user360Tab, setUser360Tab] = useState<
    "overview" | "payments" | "wallet" | "accesses" | "progress" | "ai" | "events" | "actions"
  >("overview");
  const [roleMutationLoading, setRoleMutationLoading] = useState(false);
  const [roleMutationStatus, setRoleMutationStatus] = useState<string | null>(null);
  const [accessGrantCourseId, setAccessGrantCourseId] = useState("");
  const [accessGrantType, setAccessGrantType] = useState<"trial" | "subscription" | "purchase">("subscription");
  const [accessGrantExpiresAt, setAccessGrantExpiresAt] = useState("");
  const [accessGrantLoading, setAccessGrantLoading] = useState(false);
  const [walletAdjustDirection, setWalletAdjustDirection] = useState<"credit" | "debit">("credit");
  const [walletAdjustAmountRub, setWalletAdjustAmountRub] = useState("1000");
  const [walletAdjustReason, setWalletAdjustReason] = useState("");
  const [walletAdjustLoading, setWalletAdjustLoading] = useState(false);
  const [auditFrom, setAuditFrom] = useState("");
  const [auditTo, setAuditTo] = useState("");
  const [auditEventName, setAuditEventName] = useState<"all" | AdminAuditEventName>("all");
  const userAuditRequestRef = useRef<{ requestId: number; controller: AbortController | null }>({
    requestId: 0,
    controller: null,
  });

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

  const filteredUsers = useMemo(() => {
    const normalized = userSearchQuery.trim().toLowerCase();
    const manageableUsers = users.filter((user) => user.role !== "admin");
    if (!normalized) return manageableUsers;
    return manageableUsers.filter(
      (user) => user.email.toLowerCase().includes(normalized) || user.id.toLowerCase().includes(normalized),
    );
  }, [users, userSearchQuery]);
  const selectedAuditUser = useMemo(
    () => users.find((user) => user.id === selectedAuditUserId) ?? null,
    [users, selectedAuditUserId],
  );

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
    const response = await fetch("/api/admin/courses?take=120&skip=0", { cache: "no-store" });
    if (!response.ok) return;

    const data = (await response.json()) as Course[] | PagedApiResponse<Course>;
    setCourses(Array.isArray(data) ? data : data.items ?? []);
  }

  async function loadSections() {
    const response = await fetch("/api/admin/sections?take=180&skip=0", { cache: "no-store" });
    if (!response.ok) return;

    const data = (await response.json()) as Section[] | PagedApiResponse<Section>;
    setSections(Array.isArray(data) ? data : data.items ?? []);
  }

  async function loadLessons() {
    const response = await fetch("/api/admin/lessons?take=240&skip=0", { cache: "no-store" });
    if (!response.ok) return;

    const data = (await response.json()) as Lesson[] | PagedApiResponse<Lesson>;
    const items = Array.isArray(data) ? data : data.items ?? [];
    setLessons(items);
  }

  async function loadTasks() {
    const response = await fetch("/api/admin/tasks?take=320&skip=0", { cache: "no-store" });
    if (!response.ok) return;

    const data = (await response.json()) as CustomTask[] | PagedApiResponse<CustomTask>;
    const items = Array.isArray(data) ? data : data.items ?? [];
    setTasks(items);
    setSelectedTaskIds((current) => current.filter((id) => items.some((task) => task.id === id)));
  }

  async function loadUsers(nextSkip = usersSkip) {
    setUsersLoading(true);
    try {
      setUserAuditError(null);
      const query = userSearchQuery.trim();
      const params = new URLSearchParams({
        take: String(usersTake),
        skip: String(Math.max(0, nextSkip)),
      });
      if (query) {
        params.set("q", query);
      }

      const response = await fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setUserAuditError(payload.error ?? "Не удалось загрузить список пользователей.");
        return;
      }

      const data = (await response.json()) as AdminUser[] | PagedApiResponse<AdminUser>;
      if (Array.isArray(data)) {
        setUsers(data);
        setUsersTotal(data.length);
        setUsersSkip(Math.max(0, nextSkip));
        return;
      }

      setUsers(data.items ?? []);
      setUsersTotal(data.total ?? (data.items?.length ?? 0));
      setUsersSkip(data.skip ?? Math.max(0, nextSkip));
    } catch (error) {
      setUserAuditError(error instanceof Error ? error.message : "Сетевая ошибка при загрузке пользователей.");
    } finally {
      setUsersLoading(false);
    }
  }

  async function loadAiAnalyses() {
    setAiAnalysesLoading(true);
    const params = new URLSearchParams();
    if (aiFilterTaskId.trim()) params.set("taskId", aiFilterTaskId.trim());
    if (aiFilterMode !== "all") params.set("mode", aiFilterMode);
    params.set("take", "100");
    params.set("skip", "0");

    try {
      const response = await fetch(`/api/admin/ai-analyses?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as
        | { analyses: AdminAiAnalysis[] }
        | PagedApiResponse<AdminAiAnalysis>;
      if ("analyses" in data) {
        setAiAnalyses(data.analyses ?? []);
      } else {
        setAiAnalyses(data.items ?? []);
      }
    } finally {
      setAiAnalysesLoading(false);
    }
  }

  async function loadDatasetFiles() {
    const response = await fetch("/api/admin/dataset-files?take=50", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { files: AdminDatasetFile[] };
    setDatasetFiles(data.files ?? []);
  }

  async function uploadDatasetFile() {
    if (!datasetFileToUpload) {
      setDatasetUploadStatus("Сначала выберите файл.");
      return;
    }

    setDatasetUploading(true);
    setDatasetUploadStatus("Загружаем файл...");
    const formData = new FormData();
    formData.append("file", datasetFileToUpload);

    try {
      const response = await fetch("/api/admin/dataset-files", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setDatasetUploadStatus(data.error ?? "Не удалось загрузить файл.");
        return;
      }

      setDatasetFileToUpload(null);
      setDatasetUploadStatus("Файл загружен и поставлен в очередь на процессинг.");
      await loadDatasetFiles();
    } finally {
      setDatasetUploading(false);
    }
  }

  async function refreshAll() {
    await Promise.all([loadCourses(), loadSections(), loadLessons(), loadTasks(), loadUsers()]);
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
    const topicTags = taskTopicTagsRaw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const evaluationCriteria = taskCriteriaRaw
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    const response = await fetch("/api/admin/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lessonId: activeTaskLessonId,
        type: taskType,
        status: taskStatus,
        question: taskQuestion,
        options,
        answer: taskAnswer,
        solution: taskSolution,
        difficulty: taskDifficulty,
        topicTags,
        exemplarSolution: taskExemplarSolution.trim() || null,
        evaluationCriteria,
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
    setTaskDifficulty(2);
    setTaskTopicTagsRaw("");
    setTaskExemplarSolution("");
    setTaskCriteriaRaw("");
    setTaskStatus("published");
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
    const nextStatusRaw = window.prompt("Статус (published, unpublished, archived)", task.status);
    if (nextStatusRaw === null) return;
    const nextStatus =
      nextStatusRaw === "archived"
        ? "archived"
        : nextStatusRaw === "unpublished"
          ? "unpublished"
          : "published";

    const nextOptionsRaw =
      nextType === "choice"
        ? window.prompt("Варианты через запятую", (task.options ?? []).join(", "))
        : null;
    if (nextType === "choice" && nextOptionsRaw === null) return;

    const nextAnswer = window.prompt("Правильный ответ", task.answer);
    if (nextAnswer === null) return;

    const nextSolution = window.prompt("Решение", task.solution);
    if (nextSolution === null) return;
    const nextDifficultyRaw = window.prompt("Сложность (1-5)", String(task.difficulty));
    if (nextDifficultyRaw === null) return;
    const nextDifficultyNumber = Number(nextDifficultyRaw);
    const nextDifficulty =
      Number.isFinite(nextDifficultyNumber) && nextDifficultyNumber >= 1 && nextDifficultyNumber <= 5
        ? Math.floor(nextDifficultyNumber)
        : 2;
    const nextTopicTagsRaw = window.prompt("Темы через запятую", task.topicTags.join(", "));
    if (nextTopicTagsRaw === null) return;
    const nextExemplarSolution = window.prompt("Эталонное решение", task.exemplarSolution ?? "");
    if (nextExemplarSolution === null) return;
    const nextCriteriaRaw = window.prompt(
      "Критерии проверки через ;",
      task.evaluationCriteria.join("; "),
    );
    if (nextCriteriaRaw === null) return;

    const response = await fetch(`/api/admin/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: nextType,
        status: nextStatus,
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
        difficulty: nextDifficulty,
        topicTags: nextTopicTagsRaw
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        exemplarSolution: nextExemplarSolution.trim() || null,
        evaluationCriteria: nextCriteriaRaw
          .split(";")
          .map((item) => item.trim())
          .filter(Boolean),
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

  function toggleTaskSelection(taskId: string) {
    setSelectedTaskIds((current) =>
      current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId],
    );
  }

  async function applyBulkTaskAction(action: "publish" | "unpublish" | "archive") {
    if (selectedTaskIds.length === 0) {
      setError("Выберите хотя бы одно задание.");
      return;
    }

    setBulkTaskActionLoading(true);
    setError(null);
    const response = await fetch("/api/admin/tasks/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskIds: selectedTaskIds, action }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setBulkTaskActionLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Не удалось выполнить массовое действие");
      return;
    }

    setSelectedTaskIds([]);
    await loadTasks();
  }

  async function loadUserAudit(userId: string) {
    userAuditRequestRef.current.requestId += 1;
    const requestId = userAuditRequestRef.current.requestId;
    userAuditRequestRef.current.controller?.abort();
    const controller = new AbortController();
    userAuditRequestRef.current.controller = controller;

    setUserAuditLoading(true);
    setUserAuditError(null);

    const params = new URLSearchParams();
    params.set("userId", userId);
    if (auditFrom) params.set("from", auditFrom);
    if (auditTo) params.set("to", auditTo);
    params.set("eventsTake", "30");
    params.set("paymentsTake", "25");
    params.set("walletTake", "25");
    params.set("accessesTake", "25");
    params.set("aiTake", "20");
    const sectionsByTab: Record<typeof user360Tab, string> = {
      overview: "payments,wallet,accesses,progress,ai,events",
      payments: "payments",
      wallet: "wallet",
      accesses: "accesses",
      progress: "progress",
      ai: "ai",
      events: "events",
      actions: "wallet,accesses",
    };
    params.set("sections", sectionsByTab[user360Tab]);
    if (auditEventName !== "all") {
      params.set("eventTypes", auditEventName);
    }

    try {
      const response = await fetch(`/api/admin/users/360?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        selector?: {
          users?: AdminUser[];
          total?: number;
        };
        sections?: {
          profile: AdminUser;
          accesses: { items: AdminAuditCourseAccess[] };
          progress: AdminAuditProgressSnapshot;
          payments: { items: AdminAuditPayment[]; total: number };
          aiAnalyses: { items: AdminAiAnalysis[]; total: number };
          events: { items: AdminAuditActivityEvent[]; total: number };
          wallet: {
            wallet: AdminAuditWallet;
            transactions: { items: AdminAuditWalletTransaction[]; total: number };
          };
        } | null;
      };

      if (requestId !== userAuditRequestRef.current.requestId) {
        return;
      }

      if (!response.ok) {
        setUserAuditError(data.error ?? "Не удалось загрузить аудит пользователя.");
        return;
      }

      if (data.selector?.users) {
        setUsers(data.selector.users);
        setUsersTotal(data.selector.total ?? data.selector.users.length);
      }
      if (!data.sections) {
        setUserAudit(null);
      } else {
        setUserAudit({
          user: data.sections.profile,
          accesses: data.sections.accesses.items,
          progress: data.sections.progress,
          payments: {
            items: data.sections.payments.items,
            total: data.sections.payments.total,
          },
          aiAnalyses: {
            items: data.sections.aiAnalyses.items,
            total: data.sections.aiAnalyses.total,
          },
          wallet: {
            wallet: data.sections.wallet.wallet,
            transactions: {
              items: data.sections.wallet.transactions.items,
              total: data.sections.wallet.transactions.total,
            },
          },
          activityEvents: {
            items: data.sections.events.items,
            total: data.sections.events.total,
          },
        });
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      setUserAuditError(error instanceof Error ? error.message : "Не удалось загрузить аудит пользователя.");
    } finally {
      if (requestId === userAuditRequestRef.current.requestId) {
        setUserAuditLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!selectedAuditUserId) return;
    void loadUserAudit(selectedAuditUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAuditUserId, user360Tab, auditFrom, auditTo, auditEventName]);

  function formatDateTime(iso: string | null) {
    if (!iso) return "—";
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) return iso;
    return date.toLocaleString();
  }

  function formatMoney(cents: number, currency: string) {
    try {
      return new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: currency.toUpperCase(),
      }).format(cents / 100);
    } catch {
      return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
    }
  }

  function createRoleMutationIdempotencyKey(userId: string, role: "student" | "tutor") {
    const randomPart =
      typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
        ? globalThis.crypto.randomUUID()
        : Math.random().toString(36).slice(2, 12);
    return `admin-user-role:${userId}:${role}:${randomPart}`;
  }

  function createAdminActionIdempotencyKey(prefix: string, userId: string) {
    const randomPart =
      typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
        ? globalThis.crypto.randomUUID()
        : Math.random().toString(36).slice(2, 12);
    return `${prefix}:${userId}:${randomPart}`;
  }

  async function setUserTutorRole(userId: string, role: "student" | "tutor") {
    setRoleMutationLoading(true);
    setRoleMutationStatus(null);
    setUserAuditError(null);

    const idempotencyKey = createRoleMutationIdempotencyKey(userId, role);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          userId,
          role,
          idempotencyKey,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        deduplicated?: boolean;
      };
      if (!response.ok) {
        setUserAuditError(data.error ?? "Не удалось обновить роль.");
        return;
      }

      setRoleMutationStatus(
        role === "tutor"
          ? data.deduplicated
            ? "Роль tutor уже была назначена."
            : "Роль tutor назначена."
          : data.deduplicated
            ? "Роль tutor уже была снята."
            : "Роль tutor снята.",
      );
      await loadUsers(usersSkip);
      await loadUserAudit(userId);
    } finally {
      setRoleMutationLoading(false);
    }
  }

  async function grantCourseAccessForUser(userId: string) {
    const courseId = accessGrantCourseId.trim();
    if (!courseId) {
      setUserAuditError("Укажите courseId для выдачи доступа.");
      return;
    }
    setAccessGrantLoading(true);
    setUserAuditError(null);
    setRoleMutationStatus(null);
    const idempotencyKey = createAdminActionIdempotencyKey("admin-course-access", userId);
    try {
      const payload: {
        userId: string;
        courseId: string;
        accessType: "trial" | "subscription" | "purchase";
        expiresAt?: string;
        idempotencyKey: string;
      } = {
        userId,
        courseId,
        accessType: accessGrantType,
        idempotencyKey,
      };
      if (accessGrantExpiresAt) {
        payload.expiresAt = new Date(accessGrantExpiresAt).toISOString();
      }
      const response = await fetch("/api/admin/users/access", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; deduplicated?: boolean };
      if (!response.ok) {
        setUserAuditError(data.error ?? "Не удалось выдать доступ.");
        return;
      }
      setRoleMutationStatus(data.deduplicated ? "Доступ уже был выдан (dedup)." : "Доступ к курсу выдан.");
      await loadUserAudit(userId);
    } finally {
      setAccessGrantLoading(false);
    }
  }

  async function adjustWalletForUser(userId: string) {
    const amountRub = Number.parseFloat(walletAdjustAmountRub.replace(",", "."));
    if (!Number.isFinite(amountRub) || amountRub <= 0) {
      setUserAuditError("Укажите корректную сумму для корректировки кошелька.");
      return;
    }
    setWalletAdjustLoading(true);
    setUserAuditError(null);
    const idempotencyKey = createAdminActionIdempotencyKey("admin-wallet-adjust", userId);
    try {
      const response = await fetch("/api/admin/wallets", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          userId,
          direction: walletAdjustDirection,
          amountRub,
          reason: walletAdjustReason.trim() || undefined,
          idempotencyKey,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setUserAuditError(data.error ?? "Не удалось скорректировать баланс.");
        return;
      }
      setRoleMutationStatus(
        walletAdjustDirection === "credit" ? "Баланс пополнен админом." : "Баланс списан админом.",
      );
      await loadUserAudit(userId);
    } finally {
      setWalletAdjustLoading(false);
    }
  }

  function exportUser360Json() {
    if (!userAudit) return;
    const content = JSON.stringify(userAudit, null, 2);
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `user-360-${userAudit.user.id}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportUser360Csv() {
    if (!userAudit) return;
    const rows: string[][] = [];
    const addRow = (...cols: Array<string | number | null | undefined>) =>
      rows.push(cols.map((value) => (value == null ? "" : String(value))));
    addRow("section", "field", "value1", "value2", "value3");
    addRow("profile", "email", userAudit.user.email);
    addRow("profile", "id", userAudit.user.id);
    addRow("profile", "role", userAudit.user.role);
    addRow("summary", "progress_percent", userAudit.progress.summary.percent);
    addRow("summary", "payments_total", userAudit.payments.total);
    addRow("summary", "wallet_balance_cents", userAudit.wallet.wallet.balanceCents);
    addRow("summary", "wallet_currency", userAudit.wallet.wallet.currency);
    for (const payment of userAudit.payments.items) {
      addRow("payments", payment.id, payment.status, payment.planId, payment.amountCents);
    }
    for (const access of userAudit.accesses) {
      addRow("accesses", access.id, access.courseId, access.accessType, access.expiresAt);
    }
    for (const tx of userAudit.wallet.transactions.items) {
      addRow("wallet", tx.id, tx.direction, tx.operationType, tx.amountCents);
    }
    for (const analysis of userAudit.aiAnalyses.items) {
      addRow("ai", analysis.id, analysis.status, analysis.mode, analysis.result?.scorePercent ?? "");
    }
    for (const event of userAudit.activityEvents.items) {
      addRow("events", event.id, event.eventName, event.path, event.createdAt);
    }
    const csv = rows
      .map((row) =>
        row
          .map((value) => {
            const escaped = value.replace(/\"/g, "\"\"");
            return /[\",\n;]/.test(escaped) ? `"${escaped}"` : escaped;
          })
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `user-360-${userAudit.user.id}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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
          <button
            type="button"
            role="tab"
            aria-selected={adminTab === "ai_quality"}
            className={`choice-chip ${adminTab === "ai_quality" ? "choice-chip-active" : ""}`}
            onClick={() => {
              setAdminTab("ai_quality");
              if (aiAnalyses.length === 0 && !aiAnalysesLoading) {
                void loadAiAnalyses();
              }
              if (datasetFiles.length === 0) {
                void loadDatasetFiles();
              }
            }}
          >
            Качество AI
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

          <div className="choice-group" role="radiogroup" aria-label="Статус задания">
            <button
              type="button"
              role="radio"
              aria-checked={taskStatus === "published"}
              className={`choice-chip ${taskStatus === "published" ? "choice-chip-active" : ""}`}
              onClick={() => setTaskStatus("published")}
            >
              Опубликовано
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={taskStatus === "unpublished"}
              className={`choice-chip ${taskStatus === "unpublished" ? "choice-chip-active" : ""}`}
              onClick={() => setTaskStatus("unpublished")}
            >
              Снято с публикации
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
          <div className="space-y-1">
            <label className="text-xs text-slate-600">Сложность (1-5)</label>
            <input
              type="number"
              min={1}
              max={5}
              step={1}
              className="w-full"
              value={taskDifficulty}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next)) return;
                const clamped = Math.max(1, Math.min(5, Math.floor(next))) as 1 | 2 | 3 | 4 | 5;
                setTaskDifficulty(clamped);
              }}
              required
            />
          </div>
          <input
            type="text"
            placeholder="Темы через запятую: квадратные уравнения, дискриминант"
            className="w-full"
            value={taskTopicTagsRaw}
            onChange={(event) => setTaskTopicTagsRaw(event.target.value)}
          />
          <textarea
            placeholder="Эталонное решение (подробный образец для AI-проверки)"
            className="w-full"
            rows={4}
            value={taskExemplarSolution}
            onChange={(event) => setTaskExemplarSolution(event.target.value)}
          />
          <textarea
            placeholder={"Критерии проверки (по одному на строку)\nНапример:\nКорректно выбран метод\nНет арифметических ошибок\nОтвет записан в нужном формате"}
            className="w-full"
            rows={4}
            value={taskCriteriaRaw}
            onChange={(event) => setTaskCriteriaRaw(event.target.value)}
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
        <div className="mb-3 rounded-md border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-600">Массовые действия по заданиям: выбрано {selectedTaskIds.length}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ghost px-2 py-1 text-xs"
              disabled={bulkTaskActionLoading || selectedTaskIds.length === 0}
              onClick={() => void applyBulkTaskAction("publish")}
            >
              {bulkTaskActionLoading ? "..." : "Опубликовать"}
            </button>
            <button
              type="button"
              className="btn-ghost px-2 py-1 text-xs"
              disabled={bulkTaskActionLoading || selectedTaskIds.length === 0}
              onClick={() => void applyBulkTaskAction("unpublish")}
            >
              {bulkTaskActionLoading ? "..." : "Снять с публикации"}
            </button>
            <button
              type="button"
              className="btn-danger px-2 py-1 text-xs"
              disabled={bulkTaskActionLoading || selectedTaskIds.length === 0}
              onClick={() => void applyBulkTaskAction("archive")}
            >
              {bulkTaskActionLoading ? "..." : "Архивировать"}
            </button>
            <button
              type="button"
              className="btn-ghost px-2 py-1 text-xs"
              disabled={selectedTaskIds.length === 0}
              onClick={() => setSelectedTaskIds([])}
            >
              Очистить выбор
            </button>
          </div>
        </div>
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
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="checkbox"
                                                checked={selectedTaskIds.includes(task.id)}
                                                onChange={() => toggleTaskSelection(task.id)}
                                                aria-label={`Выбрать задание ${task.id}`}
                                              />
                                              <p className="text-xs text-slate-500">
                                                {task.type === "numeric" ? "Числовой ответ" : "Выбор варианта"}
                                              </p>
                                            </div>
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
                                          <p className="text-xs text-slate-600">
                                            Статус:{" "}
                                            {task.status === "published"
                                              ? "опубликовано"
                                              : task.status === "unpublished"
                                                ? "снято с публикации"
                                                : "архив"}
                                          </p>
                                          {task.options?.length ? (
                                            <p className="text-xs text-slate-600">Варианты: {task.options.join(", ")}</p>
                                          ) : null}
                                          <p className="text-xs text-slate-600">Ответ: {task.answer}</p>
                                          <p className="text-xs text-slate-600">Сложность: {task.difficulty}/5</p>
                                          {task.topicTags.length > 0 ? (
                                            <p className="text-xs text-slate-600">Темы: {task.topicTags.join(", ")}</p>
                                          ) : null}
                                          {task.evaluationCriteria.length > 0 ? (
                                            <p className="text-xs text-slate-600">
                                              Критерии: {task.evaluationCriteria.join(" • ")}
                                            </p>
                                          ) : null}
                                          {task.exemplarSolution ? (
                                            <p className="text-xs text-slate-600">
                                              Эталон: {task.exemplarSolution.slice(0, 180)}
                                              {task.exemplarSolution.length > 180 ? "..." : ""}
                                            </p>
                                          ) : null}
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
        <h2 className="mb-2 text-lg font-semibold">Поиск и аудит пользователей</h2>
        <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-2">
            <div className="rounded-md border border-slate-200 bg-white p-2">
              <p className="text-xs text-slate-600">Поиск по email или id</p>
              <input
                type="text"
                className="mt-1 w-full"
                placeholder="example@mail.com или user id"
                value={userSearchQuery}
                onChange={(event) => setUserSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void loadUsers(0);
                  }
                }}
              />
              <button type="button" className="btn-ghost mt-2 w-full" onClick={() => void loadUsers()}>
                {usersLoading ? "Загрузка..." : "Обновить список"}
              </button>
              <p className="mt-2 text-xs text-slate-500">
                Показано: {filteredUsers.length} из {usersTotal}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={usersLoading || usersSkip <= 0}
                  onClick={() => void loadUsers(Math.max(0, usersSkip - usersTake))}
                >
                  Назад
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={usersLoading || usersSkip + usersTake >= usersTotal}
                  onClick={() => void loadUsers(usersSkip + usersTake)}
                >
                  Вперед
                </button>
              </div>
            </div>
            {filteredUsers.length === 0 ? (
              <p className="text-sm text-slate-500">Пользователи не найдены.</p>
            ) : (
              <ul className="max-h-[560px] space-y-2 overflow-auto pr-1 text-sm">
                {filteredUsers.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      className={`w-full rounded-md border p-2 text-left ${
                        selectedAuditUserId === user.id
                          ? "border-sky-400 bg-sky-100"
                          : "border-sky-100 bg-sky-50/30 hover:bg-sky-50"
                      }`}
                      onClick={() => {
                        setRoleMutationStatus(null);
                        setSelectedAuditUserId(user.id);
                        void loadUserAudit(user.id);
                      }}
                    >
                      <p className="font-medium">{user.email}</p>
                      <p className="text-xs text-slate-600">role: {user.role}</p>
                      <p className="text-xs text-slate-500">{user.id}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <div className="space-y-3">
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <p className="text-sm font-medium">Фильтры активности</p>
              <div className="mt-2 grid gap-2 md:grid-cols-4">
                <label className="text-xs text-slate-600">
                  С
                  <input
                    type="date"
                    className="mt-1 w-full"
                    value={auditFrom}
                    onChange={(event) => setAuditFrom(event.target.value)}
                  />
                </label>
                <label className="text-xs text-slate-600">
                  По
                  <input
                    type="date"
                    className="mt-1 w-full"
                    value={auditTo}
                    onChange={(event) => setAuditTo(event.target.value)}
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Событие
                  <select
                    className="mt-1 w-full"
                    value={auditEventName}
                    onChange={(event) => setAuditEventName(event.target.value as "all" | AdminAuditEventName)}
                  >
                    {AUDIT_EVENT_FILTERS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn-ghost mt-5"
                  disabled={!selectedAuditUserId || userAuditLoading || roleMutationLoading}
                  onClick={() => {
                    if (!selectedAuditUserId) return;
                    void loadUserAudit(selectedAuditUserId);
                  }}
                >
                  {userAuditLoading ? "Загрузка..." : "Обновить аудит"}
                </button>
              </div>
            </div>

            {!selectedAuditUserId ? (
              <p className="text-sm text-slate-500">Выберите пользователя слева.</p>
            ) : null}
            {userAuditError ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-rose-600">{userAuditError}</p>
                <button
                  type="button"
                  className="btn-ghost px-2 py-1 text-xs"
                  disabled={userAuditLoading}
                  onClick={() => {
                    if (selectedAuditUserId) {
                      void loadUserAudit(selectedAuditUserId);
                      return;
                    }
                    void loadUsers(usersSkip);
                  }}
                >
                  Повторить
                </button>
              </div>
            ) : null}

            {userAudit && selectedAuditUserId === userAudit.user.id ? (
              <div className="rounded-md border border-sky-200 bg-sky-50/30 p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold">User 360</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={exportUser360Json}>
                      Экспорт JSON
                    </button>
                    <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={exportUser360Csv}>
                      Экспорт CSV
                    </button>
                  </div>
                </div>
                <div className="mb-3 flex flex-wrap gap-2">
                  {USER_360_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`btn-ghost px-2 py-1 text-xs ${
                        user360Tab === tab.id ? "border-sky-400 bg-sky-100" : ""
                      }`}
                      onClick={() => setUser360Tab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <p className="text-base font-semibold">{userAudit.user.email}</p>
                  <p className="text-xs text-slate-600">
                    id: <code>{userAudit.user.id}</code> · created: {formatDateTime(userAudit.user.createdAt)}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">Текущая роль: {userAudit.user.role}</p>
                  <div className="mt-2 grid gap-2 md:grid-cols-6">
                    <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                      Прогресс: {userAudit.progress.summary.percent}%
                    </p>
                    <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                      Курсы: {userAudit.progress.summary.completedCourses}/{userAudit.progress.summary.totalCourses}
                    </p>
                    <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                      Платежи: {userAudit.payments.total}
                    </p>
                    <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                      AI-анализы: {userAudit.aiAnalyses.total}
                    </p>
                    <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                      Кошелек: {userAudit.wallet.transactions.total}
                    </p>
                    <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                      События: {userAudit.activityEvents.total}
                    </p>
                  </div>
                </div>

                {(user360Tab === "overview" || user360Tab === "payments") && (
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <h3 className="text-sm font-semibold">История оплат</h3>
                  {userAudit.payments.items.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-500">Платежей нет.</p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-xs">
                      {userAudit.payments.items.map((item) => (
                        <li key={item.id} className="rounded border border-slate-200 bg-slate-50 p-2">
                          <p className="font-medium">
                            {formatMoney(item.amountCents, item.currency)} · {item.status} · {item.planId}
                          </p>
                          <p className="text-slate-600">
                            created: {formatDateTime(item.createdAt)} · paid: {formatDateTime(item.paidAt)}
                          </p>
                          <p className="text-slate-600">
                            provider: {item.provider} · paymentId: {item.providerPaymentId ?? "—"}
                          </p>
                          {item.failureReason ? (
                            <p className="text-rose-700">Причина ошибки: {item.failureReason}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                )}

                {(user360Tab === "overview" || user360Tab === "wallet") && (
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <h3 className="text-sm font-semibold">Кошелек: пополнения и списания</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Баланс: {formatMoney(userAudit.wallet.wallet.balanceCents, userAudit.wallet.wallet.currency)} ·
                    транзакций: {userAudit.wallet.transactions.total}
                  </p>
                  {userAudit.wallet.transactions.items.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-500">Транзакций кошелька нет.</p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-xs">
                      {userAudit.wallet.transactions.items.map((item) => (
                        <li key={item.id} className="rounded border border-slate-200 bg-slate-50 p-2">
                          <p className="font-medium">
                            {item.direction === "credit" ? "+" : "-"}
                            {formatMoney(item.amountCents, userAudit.wallet.wallet.currency)} · {item.operationType}
                          </p>
                          <p className="text-slate-600">
                            Баланс: {formatMoney(item.balanceBefore, userAudit.wallet.wallet.currency)} →{" "}
                            {formatMoney(item.balanceAfter, userAudit.wallet.wallet.currency)}
                          </p>
                          <p className="text-slate-600">created: {formatDateTime(item.createdAt)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                )}

                {(user360Tab === "overview" || user360Tab === "accesses") && (
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <h3 className="text-sm font-semibold">Доступы к курсам</h3>
                  {userAudit.accesses.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-500">Активных записей нет.</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-xs">
                      {userAudit.accesses.map((access) => (
                        <li key={access.id} className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                          {access.courseTitle} (<code>{access.courseId}</code>) · {access.accessType} · expires:{" "}
                          {formatDateTime(access.expiresAt)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                )}

                {(user360Tab === "overview" || user360Tab === "progress") && (
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <h3 className="text-sm font-semibold">Прогресс</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Статус: {userAudit.progress.summary.status} · уроки:{" "}
                    {userAudit.progress.summary.completedLessons}/{userAudit.progress.summary.totalLessons} · задания:{" "}
                    {userAudit.progress.summary.completedTasks}/{userAudit.progress.summary.totalTasks}
                  </p>
                  <ul className="mt-2 space-y-2 text-xs">
                    {userAudit.progress.courses.map((course) => (
                      <li key={course.courseId} className="rounded border border-slate-200 bg-slate-50 p-2">
                        <p className="font-medium">
                          {course.title} · {course.percent}% · {course.status}
                        </p>
                        <p className="text-slate-600">
                          Уроки: {course.completedLessons}/{course.totalLessons} · Задания: {course.completedTasks}/
                          {course.totalTasks}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
                )}

                {(user360Tab === "overview" || user360Tab === "ai") && (
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <h3 className="text-sm font-semibold">AI-анализы</h3>
                  {userAudit.aiAnalyses.items.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-500">Записей нет.</p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-xs">
                      {userAudit.aiAnalyses.items.map((item) => (
                        <li key={item.id} className="rounded border border-slate-200 bg-slate-50 p-2">
                          <p className="font-medium">
                            {item.status} · {item.mode} · score: {item.result?.scorePercent ?? "—"}%
                          </p>
                          <p className="text-slate-600">
                            lesson: <code>{item.lessonId ?? "—"}</code> · task: <code>{item.taskId ?? "—"}</code>
                          </p>
                          <p className="text-slate-600">
                            model: {item.model ?? "—"} · latency: {item.latencyMs ?? "—"} ms ·{" "}
                            {formatDateTime(item.createdAt)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                )}

                {(user360Tab === "overview" || user360Tab === "events") && (
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <h3 className="text-sm font-semibold">События активности</h3>
                  {userAudit.activityEvents.items.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-500">События не найдены.</p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-xs">
                      {userAudit.activityEvents.items.map((event) => (
                        <li key={event.id} className="rounded border border-slate-200 bg-slate-50 p-2">
                          <p className="font-medium">{event.eventName}</p>
                          <p className="text-slate-600">
                            {formatDateTime(event.createdAt)} · path: {event.path ?? "—"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                )}

                {user360Tab === "actions" ? (
                  <div className="space-y-3">
                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <h3 className="text-sm font-semibold">Быстрые действия: роль tutor</h3>
                      {selectedAuditUser && selectedAuditUser.role !== "admin" ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="btn-ghost px-2 py-1 text-xs"
                            disabled={roleMutationLoading || selectedAuditUser.role === "tutor"}
                            onClick={() => void setUserTutorRole(selectedAuditUser.id, "tutor")}
                          >
                            {roleMutationLoading && selectedAuditUser.role !== "tutor"
                              ? "Сохраняем..."
                              : "Назначить tutor"}
                          </button>
                          <button
                            type="button"
                            className="btn-ghost px-2 py-1 text-xs"
                            disabled={roleMutationLoading || selectedAuditUser.role === "student"}
                            onClick={() => void setUserTutorRole(selectedAuditUser.id, "student")}
                          >
                            {roleMutationLoading && selectedAuditUser.role !== "student"
                              ? "Сохраняем..."
                              : "Снять роль tutor"}
                          </button>
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-slate-500">Роль администратора не меняется из этого экрана.</p>
                      )}
                    </div>

                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <h3 className="text-sm font-semibold">Быстрые действия: выдать доступ к курсу</h3>
                      <div className="mt-2 grid gap-2 md:grid-cols-4">
                        <input
                          type="text"
                          className="w-full"
                          placeholder="courseId"
                          value={accessGrantCourseId}
                          onChange={(event) => setAccessGrantCourseId(event.target.value)}
                        />
                        <select
                          className="w-full"
                          value={accessGrantType}
                          onChange={(event) =>
                            setAccessGrantType(event.target.value as "trial" | "subscription" | "purchase")
                          }
                        >
                          <option value="subscription">subscription</option>
                          <option value="trial">trial</option>
                          <option value="purchase">purchase</option>
                        </select>
                        <input
                          type="date"
                          className="w-full"
                          value={accessGrantExpiresAt}
                          onChange={(event) => setAccessGrantExpiresAt(event.target.value)}
                        />
                        <button
                          type="button"
                          className="btn-ghost"
                          disabled={accessGrantLoading}
                          onClick={() => void grantCourseAccessForUser(userAudit.user.id)}
                        >
                          {accessGrantLoading ? "Выдача..." : "Выдать доступ"}
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Если дата пустая, доступ выдается без срока истечения.
                      </p>
                    </div>

                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <h3 className="text-sm font-semibold">Быстрые действия: корректировка кошелька</h3>
                      <div className="mt-2 grid gap-2 md:grid-cols-4">
                        <select
                          className="w-full"
                          value={walletAdjustDirection}
                          onChange={(event) => setWalletAdjustDirection(event.target.value as "credit" | "debit")}
                        >
                          <option value="credit">Пополнение (credit)</option>
                          <option value="debit">Списание (debit)</option>
                        </select>
                        <input
                          type="text"
                          className="w-full"
                          value={walletAdjustAmountRub}
                          onChange={(event) => setWalletAdjustAmountRub(event.target.value)}
                          placeholder="Сумма, RUB"
                        />
                        <input
                          type="text"
                          className="w-full"
                          value={walletAdjustReason}
                          onChange={(event) => setWalletAdjustReason(event.target.value)}
                          placeholder="Причина (optional)"
                        />
                        <button
                          type="button"
                          className="btn-ghost"
                          disabled={walletAdjustLoading}
                          onClick={() => void adjustWalletForUser(userAudit.user.id)}
                        >
                          {walletAdjustLoading ? "Сохраняем..." : "Применить"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
                {roleMutationStatus ? <p className="text-xs text-slate-600">{roleMutationStatus}</p> : null}
              </div>
            ) : null}
          </div>
        </div>
      </section> : null}

      {adminTab === "ai_quality" ? <section className="panel-accent">
        <h2 className="mb-2 text-lg font-semibold">Качество AI</h2>
        <p className="text-xs text-slate-500">Последние AI-анализы решений с фильтром по заданию и режиму.</p>
        <div className="mt-2 grid gap-2 md:grid-cols-4">
          <input
            type="text"
            className="w-full"
            placeholder="taskId"
            value={aiFilterTaskId}
            onChange={(event) => setAiFilterTaskId(event.target.value)}
          />
          <select
            className="w-full"
            value={aiFilterMode}
            onChange={(event) =>
              setAiFilterMode(event.target.value as "all" | "default" | "beginner" | "similar_task")
            }
          >
            <option value="all">Все режимы</option>
            <option value="default">default</option>
            <option value="beginner">beginner</option>
            <option value="similar_task">similar_task</option>
          </select>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => void loadAiAnalyses()}
            disabled={aiAnalysesLoading}
          >
            {aiAnalysesLoading ? "Загрузка..." : "Применить"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setAiFilterTaskId("");
              setAiFilterMode("all");
            }}
            disabled={aiAnalysesLoading}
          >
            Сбросить
          </button>
        </div>

        {aiAnalyses.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Записей пока нет.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {aiAnalyses.map((item) => (
              <li key={item.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                <p className="font-medium">
                  {item.status.toUpperCase()} · {item.mode} · {item.result?.scorePercent ?? "?"}%
                </p>
                <p className="text-xs text-slate-600">
                  task: <code>{item.taskId ?? "—"}</code> · user: <code>{item.userId}</code>
                </p>
                <p className="text-xs text-slate-600">
                  verdict: {item.result?.verdict ?? "—"} · model: {item.model ?? "mvp"} · latency:{" "}
                  {item.latencyMs ?? "—"} ms
                </p>
                {item.result?.conciseSummary ? (
                  <p className="mt-1 text-xs text-slate-700">{item.result.conciseSummary}</p>
                ) : null}
                {item.error?.message ? (
                  <p className="mt-1 text-xs text-rose-700">
                    {item.error.code ?? "error"}: {item.error.message}
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-base font-semibold">Датасет: загрузка файлов</h3>
          <p className="text-xs text-slate-500">Поддерживаемые форматы: pdf, docx, txt. Лимит: до 20 MB.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={(event) => setDatasetFileToUpload(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              className="btn-ghost px-2 py-1 text-xs"
              onClick={() => void uploadDatasetFile()}
              disabled={datasetUploading}
            >
              {datasetUploading ? "Загрузка..." : "Загрузить файл"}
            </button>
            <button
              type="button"
              className="btn-ghost px-2 py-1 text-xs"
              onClick={() => void loadDatasetFiles()}
              disabled={datasetUploading}
            >
              Обновить список
            </button>
          </div>
          {datasetUploadStatus ? <p className="mt-1 text-xs text-slate-700">{datasetUploadStatus}</p> : null}

          {datasetFiles.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">Файлы датасета пока не загружены.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-xs text-slate-700">
              {datasetFiles.map((file) => (
                <li key={file.id} className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                  <span className="font-medium">{file.originalName}</span> ·{" "}
                  {(file.sizeBytes / (1024 * 1024)).toFixed(2)} MB · статус:{" "}
                  {file.processingStatus === "uploaded"
                    ? "uploaded"
                    : file.processingStatus === "parsed"
                      ? "parsed"
                      : file.processingStatus === "ready"
                        ? "ready"
                        : "failed"}
                  {file.processingStatus === "ready" ? ` · чанков: ${file.chunkCount} · символов: ${file.textChars}` : ""}
                  {file.processingStatus === "failed" && file.processingError
                    ? ` · ошибка: ${file.processingError}`
                    : ""}
                  {" · "}
                  {new Date(file.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section> : null}
    </div>
  );
}
