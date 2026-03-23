"use client";

import { useEffect, useMemo, useState } from "react";
import type { Task } from "@/lib/mvp-data";

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

  const quickModes = useMemo(
    () => [
      { id: "default", label: "Обычный" },
      { id: "beginner", label: "Объясни как для новичка" },
      { id: "similar_task", label: "Дай похожую задачу" },
    ] as const,
    [],
  );

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
    if (!trimmed || loading) return;

    setLoading(true);
    const response = await fetch(`/api/chat/lesson/${lessonId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: trimmed, mode }),
    });

    if (response.ok) {
      const data = (await response.json()) as { message: Message };
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "user",
          content: trimmed,
          mode,
          createdAt: new Date().toISOString(),
        },
        data.message,
      ]);
      setMessage("");
    }

    setLoading(false);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-2 rounded-xl border border-sky-200 bg-white p-4 lg:col-span-2">
        <h2 className="text-lg font-semibold">Задания (часть 1)</h2>
        {tasks.length === 0 ? <p className="text-sm text-slate-600">Для этого урока задания будут добавлены в админке.</p> : null}
        {tasks.map((task) => (
          <div key={task.id} className="rounded-lg border border-sky-100 bg-sky-50/40 p-3">
            <p className="mb-2 font-medium">{task.question}</p>
            {task.type === "numeric" ? (
              <input
                type="text"
                placeholder="Введите ответ"
                className="mb-2 w-full"
                value={answers[task.id] ?? ""}
                onChange={(event) => setAnswers((current) => ({ ...current, [task.id]: event.target.value }))}
              />
            ) : (
              <select
                className="mb-2 w-full"
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
              <div className="mt-3 rounded-md bg-slate-50 p-2 text-sm">
                <p className={results[task.id].ok ? "text-emerald-700" : "text-rose-700"}>
                  {results[task.id].ok ? "Верно" : "Неверно"}
                </p>
                <p>{results[task.id].solution}</p>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <aside className="space-y-3 rounded-xl border border-sky-200 bg-white p-4">
        <h2 className="text-lg font-semibold">AI-чат урока</h2>
        <div className="flex flex-wrap gap-2">
          {quickModes.map((item) => (
            <button
              key={item.id}
              type="button"
              className={
                mode === item.id
                  ? "rounded-md border border-sky-500 bg-sky-500 px-2 py-1 text-xs text-white"
                  : "rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:border-sky-400 hover:text-sky-700"
              }
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="max-h-[240px] space-y-2 overflow-y-auto rounded-lg border border-sky-200 p-2 text-sm sm:max-h-[280px]">
          {messages.length === 0 ? <p className="text-slate-500">Задайте первый вопрос.</p> : null}
          {messages.map((item) => (
            <div
              key={item.id}
              className={
                item.role === "user"
                  ? "rounded-lg bg-sky-50 p-2 text-slate-900"
                  : "rounded-lg bg-sky-100 p-2 text-sky-950"
              }
            >
              {item.content}
            </div>
          ))}
        </div>
        <textarea
          rows={4}
          className="w-full"
          placeholder="Задайте вопрос AI по теме урока"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <button type="button" className="w-full" onClick={send} disabled={loading}>
          {loading ? "Отправка..." : "Отправить"}
        </button>
      </aside>
    </div>
  );
}
