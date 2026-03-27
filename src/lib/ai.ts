function mockReply(message: string, mode: string) {
  if (mode === "beginner") {
    return `Объясняю просто: ${message}.

1) Определи данные.
2) Выбери формулу (например, $a^2 + b^2 = c^2$).
3) Подставь значения и проверь ответ.`;
  }

  if (mode === "similar_task") {
    return "Похожая задача: решите уравнение $x^2 - 7x + 12 = 0$. Ответ: $x=3$ и $x=4$.";
  }

  return `Разберем: ${message}. Начни с записи известных данных и цели задачи.

Пример записи формулы: $$e^{i\\pi} = -1$$`;
}

function modeInstruction(mode: string) {
  if (mode === "beginner") {
    return "Объясняй максимально простым языком, короткими шагами, как для новичка.";
  }

  if (mode === "similar_task") {
    return "Сгенерируй похожую задачу того же уровня и дай краткий ответ.";
  }

  return "Отвечай как преподаватель ЕГЭ по математике и физике, структурно и понятно.";
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function generateAiReply(input: {
  message: string;
  mode?: string;
  context?: string;
  attachmentContext?: string;
}) {
  const mode = input.mode ?? "default";
  const key = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

  const cleanMessage = input.message.trim().slice(0, 5000);
  const attachmentContext = input.attachmentContext?.trim().slice(0, 5000);

  if (!key) {
    return mockReply(cleanMessage, mode);
  }

  const systemPrompt = [
    modeInstruction(mode),
    "Используй LaTeX для формул: inline $...$, отдельные формулы в $$...$$.",
    `Контекст урока/чата: ${input.context ?? "general"}.`,
    attachmentContext
      ? "Если есть текст из вложения, используй его как приоритетный контекст и явно отмечай, если данные неполные."
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const userMessage = attachmentContext
    ? `${cleanMessage}\n\nКонтекст из вложения:\n${attachmentContext}`
    : cleanMessage;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
              {
                role: "user",
                content: userMessage,
              },
            ],
            temperature: 0.3,
          }),
        },
        12000,
      );

      if (!response.ok) {
        continue;
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = data.choices?.[0]?.message?.content?.trim();
      if (content && content.length > 0) {
        return content;
      }
    } catch {
      // Retry once for flaky provider/network errors.
    }
  }

  return mockReply(cleanMessage, mode);
}
