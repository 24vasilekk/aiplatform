function mockReply(message: string, mode: string) {
  if (mode === "beginner") {
    return `Спокойно, разберем это простыми шагами: ${message}

Простое объяснение:
Идея в том, чтобы идти от данных к ответу маленькими проверяемыми шагами.

Шаги решения:
1) Выпиши, что дано и что нужно найти.
2) Выбери подходящую формулу или правило.
3) Подставь значения аккуратно, без пропусков.
4) Проверь итог: подходит ли он к условию задачи.

Мягкая подсказка:
Если сложно начать, просто опиши первый шаг словами, а затем запиши формулу.`;
  }

  if (mode === "similar_task") {
    return `Похожая задача:
Решите уравнение $x^2 - 7x + 12 = 0$.

Краткий разбор:
1) Разложим на множители: $(x-3)(x-4)=0$.
2) Отсюда корни: $x=3$ и $x=4$.
3) Быстрая проверка: подстановка дает ноль.

Ответ: $x=3$ и $x=4$.`;
  }

  return `Разберем: ${message}. Начни с записи известных данных и цели задачи.

Пример записи формулы: $$e^{i\\pi} = -1$$`;
}

function modeInstruction(mode: string) {
  if (mode === "beginner") {
    return [
      "Ты поддерживающий преподаватель для новичка.",
      "Пиши очень простым языком, без давления и без резкой критики.",
      "Всегда давай структуру ответа из 3 блоков:",
      "1) Простое объяснение идеи.",
      "2) Пошаговое решение (3-6 шагов, каждый шаг короткий).",
      "3) Мягкая подсказка, что проверить дальше.",
      "Если ученик ошибся, сначала отметь, что уже сделано правильно, и только потом мягко укажи, что исправить.",
      "Избегай перегруза терминами; если термин нужен, объясни его в одном предложении.",
    ].join(" ");
  }

  if (mode === "similar_task") {
    return [
      "Сгенерируй ровно одну похожую задачу того же уровня и темы.",
      "После условия дай короткий разбор (2-4 шага) и финальный ответ.",
      "Используй формат ответа строго из 3 блоков:",
      "1) Похожая задача",
      "2) Краткий разбор",
      "3) Ответ",
      "Задача должна быть новой, но максимально близкой по типу метода.",
    ].join(" ");
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
      ? [
          "Есть прикрепленный учебный материал урока.",
          "Правило ответа: 1) сначала ищи и используй факты из материала урока, 2) только если в материале нет ответа, аккуратно дополняй из общих знаний.",
          "Не противоречь материалу урока. При конфликте приоритет у материала урока.",
          "Если данных в материале недостаточно, явно напиши, чего не хватает.",
        ].join(" ")
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const userMessage = attachmentContext
    ? `${cleanMessage}\n\n=== Материал урока (приоритетный источник) ===\n${attachmentContext}\n=== Конец материала ===`
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
