function mockReply(message: string, mode: string) {
  if (mode === "beginner") {
    return `Объясняю просто: ${message}. 1) Определи данные. 2) Выбери формулу. 3) Подставь и проверь ответ.`;
  }

  if (mode === "similar_task") {
    return "Похожая задача: Решите x^2 - 7x + 12 = 0. Ответ: 3 и 4.";
  }

  return `Разберем: ${message}. Начни с записи известных данных и цели задачи.`;
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

export async function generateAiReply(input: { message: string; mode?: string; context?: string }) {
  const mode = input.mode ?? "default";
  const key = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

  if (!key) {
    return mockReply(input.message, mode);
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
            content: `${modeInstruction(mode)} Контекст: ${input.context ?? "general"}.`,
          },
          {
            role: "user",
            content: input.message,
          },
        ],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      return mockReply(input.message, mode);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content?.trim();
    return content && content.length > 0 ? content : mockReply(input.message, mode);
  } catch {
    return mockReply(input.message, mode);
  }
}
