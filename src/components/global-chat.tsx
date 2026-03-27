"use client";

import { useEffect, useState } from "react";
import { ChatMessageContent } from "@/components/chat-message-content";

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
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [attachmentContext, setAttachmentContext] = useState<string | null>(null);
  const [attachmentStatus, setAttachmentStatus] = useState<string | null>(null);
  const [processingAttachment, setProcessingAttachment] = useState(false);

  function applyMode(nextMode: "default" | "beginner" | "similar_task") {
    setMode(nextMode);
  }

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
    if (loading) return;
    if (!trimmed) {
      setSendStatus("Введите сообщение перед отправкой.");
      return;
    }

    setLoading(true);
    setSendStatus(null);

    try {
      const response = await fetch("/api/chat/global/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: trimmed, mode, attachmentContext }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setSendStatus(data.error ?? `Ошибка отправки (HTTP ${response.status})`);
        return;
      }

      const data = (await response.json()) as { message: Message };
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "user", content: trimmed, mode, createdAt: new Date().toISOString() },
        data.message,
      ]);
      setMessage("");
      setAttachmentContext(null);
      setAttachmentStatus(null);
    } catch {
      setSendStatus("Сетевая ошибка: не удалось отправить сообщение.");
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
    <section className="mx-auto max-w-3xl space-y-4">
      <h1>Общий AI-чат по ЕГЭ</h1>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={mode === "beginner" ? "btn-primary px-3 py-1.5 text-xs" : "btn-ghost px-3 py-1.5 text-xs"}
          onClick={() => applyMode("beginner")}
        >
          Объясни как для новичка
        </button>
      </div>
      <div className="max-h-[320px] space-y-2 overflow-y-auto rounded-xl border border-sky-200 bg-white p-3 sm:max-h-[420px] sm:p-4">
        {messages.length === 0 ? <p className="text-sm text-slate-600">Напишите первый вопрос.</p> : null}
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
          id="global-chat-photo"
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
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Спросите что угодно по ЕГЭ"
        />
        <label
          htmlFor="global-chat-photo"
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
      <button type="button" onClick={send} disabled={loading || processingAttachment}>
        {loading ? "Отправка..." : "Отправить"}
      </button>
      {attachmentStatus ? <p className="text-xs text-slate-700">{attachmentStatus}</p> : null}
      {sendStatus ? <p className="text-sm text-rose-600">{sendStatus}</p> : null}
    </section>
  );
}
