import type { AiAnalysisInput, AiAnalysisResult, AiAnalysisVerdict } from "@/types/ai-solution-analysis";

function normalizeComparable(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildCriteria(input: AiAnalysisInput) {
  if (input.officialCriteria.length === 0) {
    return [];
  }

  return input.officialCriteria.map((criterion) => ({
    criterionId: criterion.id,
    label: criterion.label,
    status: "not_checked" as const,
    maxPoints: criterion.maxPoints,
    feedback: "Проверка по критерию в MVP пока базовая и будет уточнена в следующем этапе.",
  }));
}

function buildModeSteps(mode: AiAnalysisInput["mode"]) {
  if (mode === "beginner") {
    return [
      "Сначала простыми словами запишите, что нужно найти.",
      "Разделите решение на короткие пункты и проверяйте каждый пункт отдельно.",
      "Сверьте итоговый ответ с вопросом и единицами измерения (если они есть).",
    ];
  }

  return [
    "Перепроверьте ключевые преобразования в середине решения.",
    "Убедитесь, что итоговый ответ соответствует формату задания.",
    "Добавьте короткое объяснение, почему выбранный метод корректен.",
  ];
}

function buildSimilarTaskSuggestion(questionText: string) {
  const compact = questionText.replace(/\s+/g, " ").trim();
  return {
    taskText: `Похожая задача: ${compact.slice(0, 140)}${compact.length > 140 ? "..." : ""}`,
    shortAnswer: "Краткий ответ: выполните те же шаги, что в исходной задаче, и проверьте итог подстановкой.",
    firstHint: "Сначала выпишите данные и цель, затем повторите метод решения по шагам.",
  };
}

export async function analyzeExpandedSolutionMvp(input: AiAnalysisInput): Promise<{
  result: AiAnalysisResult;
  model: string;
}> {
  const normalizedSolution = normalizeComparable(input.studentSolutionText);
  const criteria = buildCriteria(input);
  const mistakes: AiAnalysisResult["mistakes"] = [];
  let scorePercent = 70;
  let verdict: AiAnalysisVerdict = "partially_correct";

  if (input.studentSolutionText.trim().length < 40) {
    mistakes.push({
      code: "solution_too_short",
      message: "Решение слишком короткое: недостаточно обоснований.",
      severity: "high",
      fixHint: "Добавьте промежуточные шаги и объясните, откуда взялся ответ.",
    });
    scorePercent -= 25;
  }

  if (input.expectedAnswer) {
    const expected = normalizeComparable(input.expectedAnswer);
    const hasExpectedInSolution = normalizedSolution.includes(expected);

    if (hasExpectedInSolution) {
      scorePercent += 20;
    } else {
      mistakes.push({
        code: "expected_answer_not_found",
        message: "Итоговый ответ не совпадает с ожидаемым.",
        severity: "high",
        evidence: `Ожидалось: ${input.expectedAnswer}`,
        fixHint: "Проверьте арифметику в последних шагах и финальную запись ответа.",
      });
      scorePercent -= 30;
    }
  } else {
    mistakes.push({
      code: "no_expected_answer",
      message: "Эталонный ответ не передан: оценка менее точная.",
      severity: "low",
      fixHint: "Передавайте expectedAnswer, чтобы повысить точность проверки.",
    });
    scorePercent -= 5;
  }

  scorePercent = Math.max(0, Math.min(100, scorePercent));

  if (scorePercent >= 85) verdict = "correct";
  else if (scorePercent >= 50) verdict = "partially_correct";
  else verdict = "incorrect";

  const conciseSummary =
    verdict === "correct"
      ? "Решение в целом корректное: структура есть, результат совпадает с ожиданиями."
      : verdict === "partially_correct"
        ? input.mode === "beginner"
          ? "Хорошее начало: часть шагов верная, осталось аккуратно поправить несколько моментов."
          : "Решение частично верное: есть полезные шаги, но найдены недочеты."
        : "Решение содержит существенные ошибки и требует доработки.";

  const result: AiAnalysisResult = {
    verdict,
    scorePercent,
    conciseSummary,
    criteria,
    mistakes,
    nextSteps: buildModeSteps(input.mode),
    rewrittenIdealSolution:
      input.mode === "beginner"
        ? "Простой шаблон: 1) что дано, 2) что найти, 3) формула, 4) вычисления по шагам, 5) проверка, 6) финальный ответ."
        : undefined,
    similarTask: input.mode === "similar_task" ? buildSimilarTaskSuggestion(input.questionText) : undefined,
  };

  return {
    result,
    model: "mvp-heuristic-v1",
  };
}
