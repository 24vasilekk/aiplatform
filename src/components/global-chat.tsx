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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attachmentContext, setAttachmentContext] = useState<string | null>(null);
  const [attachmentStatus, setAttachmentStatus] = useState<string | null>(null);
  const [processingAttachment, setProcessingAttachment] = useState(false);

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
      body: JSON.stringify({ message: trimmed, mode, attachmentContext }),
    });

    if (response.ok) {
      const data = (await response.json()) as { message: Message };
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: trimmed, mode, createdAt: new Date().toISOString() }, data.message]);
      setMessage("");
      setAttachmentContext(null);
      setAttachmentStatus(null);
      setSelectedFile(null);
    }

    setLoading(false);
  }

  async function uploadAttachment() {
    if (!selectedFile || processingAttachment) return;

    setProcessingAttachment(true);
    setAttachmentStatus("Загружаем файл...");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const uploadResponse = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });
      const uploadData = (await uploadResponse.json().catch(() => ({}))) as {
        upload?: { id: string; originalName: string };
        error?: string;
      };

      if (!uploadResponse.ok || !uploadData.upload) {
        setAttachmentStatus(uploadData.error ?? "Не удалось загрузить файл");
        return;
      }

      setAttachmentStatus("Извлекаем текст и проверяем таймкоды...");
      const analyzeResponse = await fetch("/api/ai/attachments/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uploadId: uploadData.upload.id }),
      });
      const analyzeData = (await analyzeResponse.json().catch(() => ({}))) as {
        context?: string;
        hasOutOfRangeTimecodes?: boolean;
        outOfRangeTimecodes?: string[];
        error?: string;
      };

      if (!analyzeResponse.ok || !analyzeData.context) {
        setAttachmentStatus(analyzeData.error ?? "Не удалось обработать файл");
        return;
      }

      setAttachmentContext(analyzeData.context);
      setAttachmentStatus(
        analyzeData.hasOutOfRangeTimecodes
          ? `Файл обработан. Вне диапазона: ${analyzeData.outOfRangeTimecodes?.join(", ") ?? "есть"}.`
          : "Файл обработан. Контекст добавится к следующему сообщению.",
      );
    } catch {
      setAttachmentStatus("Сетевая ошибка при обработке файла");
    } finally {
      setProcessingAttachment(false);
    }
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
      <div className="max-h-[320px] space-y-2 overflow-y-auto rounded-xl border border-sky-200 bg-white p-3 sm:max-h-[420px] sm:p-4">
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
            <ChatMessageContent content={item.content} />
          </div>
        ))}
      </div>
      <textarea rows={4} className="w-full" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Спросите что угодно по ЕГЭ" />
      <div className="space-y-2 rounded-lg border border-slate-200 p-3">
        <label className="text-sm font-medium text-slate-700" htmlFor="global-chat-file">
          Фото/файл для OCR и анализа
        </label>
        <input
          id="global-chat-file"
          type="file"
          className="w-full text-sm"
          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
        />
        <button type="button" className="btn-ghost" onClick={uploadAttachment} disabled={!selectedFile || processingAttachment}>
          {processingAttachment ? "Обработка..." : "Загрузить и обработать"}
        </button>
        {attachmentStatus ? <p className="text-xs text-slate-600">{attachmentStatus}</p> : null}
      </div>
      <button type="button" onClick={send} disabled={loading}>
        {loading ? "Отправка..." : "Отправить"}
      </button>
    </section>
  );
}
