"use client";

import { useEffect, useState } from "react";

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  mode: string;
  createdAt: string;
};

export function GlobalChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"default" | "beginner" | "similar_task">("default");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/chat/global/messages", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as Message[];
      setMessages(data);
    }

    void load();
  }, []);

  async function send() {
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    const response = await fetch("/api/chat/global/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: trimmed, mode }),
    });

    if (response.ok) {
      const data = (await response.json()) as { message: Message };
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: trimmed, mode, createdAt: new Date().toISOString() }, data.message]);
      setMessage("");
    }

    setLoading(false);
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Общий AI-чат по ЕГЭ</h1>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={mode === "default" ? "btn-primary" : "btn-ghost"}
          onClick={() => setMode("default")}
        >
          Обычный
        </button>
        <button
          type="button"
          className={mode === "beginner" ? "btn-primary" : "btn-ghost"}
          onClick={() => setMode("beginner")}
        >
          Для новичка
        </button>
        <button
          type="button"
          className={mode === "similar_task" ? "btn-primary" : "btn-ghost"}
          onClick={() => setMode("similar_task")}
        >
          Похожая задача
        </button>
      </div>
      <div className="max-h-[420px] space-y-2 overflow-y-auto rounded-xl border border-sky-200 bg-white p-4">
        {messages.length === 0 ? <p className="text-sm text-slate-500">Напишите первый вопрос.</p> : null}
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
      <textarea rows={5} className="w-full" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Спросите что угодно по ЕГЭ" />
      <button type="button" onClick={send} disabled={loading}>
        {loading ? "Отправка..." : "Отправить"}
      </button>
    </section>
  );
}
