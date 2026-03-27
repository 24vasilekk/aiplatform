"use client";

import { useEffect, useMemo, useState } from "react";
import type { Task } from "@/lib/mvp-data";
import { ChatMessageContent } from "@/components/chat-message-content";

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  mode: string;
  createdAt: string;
};

export function LessonWorkspace({
  lessonId,
  tasks,
}: {
  lessonId: string;
  tasks: Task[];
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, { ok: boolean; solution: string }>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"default" | "beginner" | "similar_task">("default");
  const [loading, setLoading] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [attachmentContext, setAttachmentContext] = useState<string | null>(null);
  const [attachmentStatus, setAttachmentStatus] = useState<string | null>(null);
  const [processingAttachment, setProcessingAttachment] = useState(false);

  const quickModes = useMemo(
    () =>
      [
        { id: "beginner", label: "Для новичка" },
      ] as const,
    [],
  );

  function applyMode(nextMode: "default" | "beginner" | "similar_task") {
    setMode(nextMode);
    setSendStatus(null);
    setMessage((current) => {
      if (current.trim().length > 0) return current;
      if (nextMode === "beginner") return "Объясни как для новичка: ";
      return "";
    });
  }

  useEffect(() => {
    async function init() {
      await fetch(`/api/lessons/${lessonId}/progress`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "in_progress", lastPositionSec: 0 }),
      });

      const response = await fetch(`/api/chat/lesson/${lessonId}/messages`, { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as Message[];
      setMessages(data);
    }

    void init();
  }, [lessonId]);

  async function checkTask(taskId: string) {
    const answer = answers[taskId]?.trim();
    if (!answer) return;

    const response = await fetch(`/api/tasks/${taskId}/check`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answer }),
    });

    if (!response.ok) return;

    const data = (await response.json()) as { isCorrect: boolean; solution: string };
    setResults((current) => ({
      ...current,
      [taskId]: { ok: data.isCorrect, solution: data.solution },
    }));
  }

  async function send() {
    const trimmed = message.trim();
    if (loading) return;
    if (!trimmed) {
      setSendStatus("Введите сообщение перед отправкой.");
      return;
    }

    setLoading(true);
    setSendStatus(null);
    const userDraftId = crypto.randomUUID();
    const typingId = `typing-${crypto.randomUUID()}`;
    const nextMode = mode;

    setMessages((current) => [
      ...current,
      {
        id: userDraftId,
        role: "user",
        content: trimmed,
        mode: nextMode,
        createdAt: new Date().toISOString(),
      },
      {
        id: typingId,
        role: "assistant",
        content: "...",
        mode: nextMode,
        createdAt: new Date().toISOString(),
      },
    ]);
    setMessage("");

    try {
      const response = await fetch(`/api/chat/lesson/${lessonId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          mode: nextMode,
          ...(attachmentContext ? { attachmentContext } : {}),
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setSendStatus(data.error ?? `Ошибка отправки (HTTP ${response.status})`);
        setMessages((current) => current.filter((item) => item.id !== userDraftId && item.id !== typingId));
        setMessage(trimmed);
        return;
      }

      const data = (await response.json()) as { message: Message };
      setMessages((current) => current.map((item) => (item.id === typingId ? data.message : item)));
      setAttachmentContext(null);
      setAttachmentStatus(null);
    } catch {
      setSendStatus("Сетевая ошибка: не удалось отправить сообщение.");
      setMessages((current) => current.filter((item) => item.id !== userDraftId && item.id !== typingId));
      setMessage(trimmed);
    } finally {
      setLoading(false);
    }
  }

  async function processAttachment(file: File) {
    if (processingAttachment) return;

    setProcessingAttachment(true);
    setAttachmentStatus(`Обрабатываем фото: ${file.name}`);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadResponse = await fetch("/api/uploads", { method: "POST", body: formData });
      const uploadData = (await uploadResponse.json().catch(() => ({}))) as {
        upload?: { id: string };
        error?: string;
      };

      if (!uploadResponse.ok || !uploadData.upload) {
        setAttachmentStatus(uploadData.error ?? "Не удалось загрузить фото.");
        return;
      }

      const analyzeResponse = await fetch("/api/ai/attachments/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uploadId: uploadData.upload.id }),
      });
      const analyzeData = (await analyzeResponse.json().catch(() => ({}))) as {
        context?: string;
        error?: string;
      };

      if (!analyzeResponse.ok || !analyzeData.context) {
        setAttachmentStatus(analyzeData.error ?? "Не удалось распознать фото.");
        return;
      }

      setAttachmentContext(analyzeData.context);
      setAttachmentStatus("Фото добавлено в контекст следующего сообщения.");
    } catch {
      setAttachmentStatus("Сетевая ошибка при обработке фото.");
    } finally {
      setProcessingAttachment(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="card-soft space-y-4 p-6 lg:col-span-2">
        <h2>Задания (часть 1)</h2>
        {tasks.length === 0 ? <p className="text-sm text-slate-700">Для этого урока задания будут добавлены в админке.</p> : null}
        {tasks.map((task) => (
          <div key={task.id} className="card-soft space-y-3 p-4">
            <p className="font-medium">{task.question}</p>
            {task.type === "numeric" ? (
              <input
                type="text"
                placeholder="Введите ответ"
                className="w-full"
                value={answers[task.id] ?? ""}
                onChange={(event) => setAnswers((current) => ({ ...current, [task.id]: event.target.value }))}
              />
            ) : (
              <select
                className="w-full"
                value={answers[task.id] ?? ""}
                onChange={(event) => setAnswers((current) => ({ ...current, [task.id]: event.target.value }))}
              >
                <option value="">Выберите вариант</option>
                {task.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={() => checkTask(task.id)}>
                Проверить
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setResults((current) => ({ ...current, [task.id]: { ok: false, solution: task.solution } }))}
              >
                Показать решение
              </button>
              <button
                type="button"
                className="btn-ghost border-sky-500 text-sky-700"
                onClick={() => {
                  setMessage(`Помоги решить задачу: ${task.question}`);
                  setMode("beginner");
                }}
              >
                Спросить AI
              </button>
            </div>
            {results[task.id] ? (
              <div className="rounded-md bg-slate-50 p-2 text-sm">
                <p className={results[task.id].ok ? "text-emerald-700" : "text-rose-700"}>
                  {results[task.id].ok ? "Верно" : "Неверно"}
                </p>
                <p>{results[task.id].solution}</p>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <aside className="card-soft space-y-4 p-6">
        <h2>AI-чат урока</h2>
        <div className="flex flex-wrap gap-2">
          {quickModes.map((item) => (
            <button
              key={item.id}
              type="button"
              className={
                mode === item.id
                  ? "inline-flex items-center justify-center rounded-lg border border-sky-500 bg-sky-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-[transform,box-shadow,background-color,border-color,color,opacity] duration-200 ease-out hover:border-sky-400 hover:bg-sky-400 hover:shadow-[0_4px_10px_rgba(14,165,233,0.24)] active:scale-[0.98]"
                  : "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-[transform,box-shadow,background-color,border-color,color,opacity] duration-200 ease-out hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700 hover:shadow-[0_4px_10px_rgba(15,23,42,0.08)] active:scale-[0.98]"
              }
              onClick={() => applyMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="max-h-[240px] space-y-2 overflow-y-auto rounded-lg border border-sky-200 p-2 text-sm sm:max-h-[280px]">
          {messages.length === 0 ? <p className="text-slate-600">Задайте первый вопрос.</p> : null}
          {messages.map((item) => (
            <div
              key={item.id}
              className={
                item.role === "user"
                  ? "rounded-lg bg-sky-50 p-2 text-slate-900"
                  : "rounded-lg bg-sky-100 p-2 text-sky-950"
              }
            >
              <ChatMessageContent content={item.content} />
            </div>
          ))}
        </div>
        <div className="relative">
          <input
            id="lesson-chat-photo"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void processAttachment(file);
              }
              event.currentTarget.value = "";
            }}
          />
          <textarea
            rows={4}
            className="w-full pr-12"
            placeholder="Задайте вопрос AI по теме урока"
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              if (sendStatus) setSendStatus(null);
            }}
          />
          <label
            htmlFor="lesson-chat-photo"
            className="absolute right-2 bottom-2 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition-[transform,box-shadow,background-color,border-color,color,opacity] duration-200 ease-out hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700 hover:shadow-[0_4px_10px_rgba(15,23,42,0.08)] active:scale-[0.98]"
            title="Отправить фото"
            aria-label="Отправить фото"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h4l2-2h4l2 2h4v12H4z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </label>
        </div>
        <button type="button" className="w-full" onClick={send} disabled={loading || processingAttachment}>
          {loading ? "Отправка..." : "Отправить"}
        </button>
        {attachmentStatus ? <p className="text-xs text-slate-700">{attachmentStatus}</p> : null}
        {sendStatus ? <p className="text-sm text-rose-600">{sendStatus}</p> : null}
      </aside>
    </div>
  );
}
