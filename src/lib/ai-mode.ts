export type AiMode = "default" | "beginner" | "similar_task";

export type AiModeOption = {
  id: AiMode;
  label: string;
};

export const AI_MODE_OPTIONS: AiModeOption[] = [
  { id: "default", label: "Обычный режим" },
  { id: "beginner", label: "Для новичка" },
  { id: "similar_task", label: "Похожая задача" },
];

export function getAiModeDraftPrefix(mode: AiMode) {
  if (mode === "beginner") return "Объясни как для новичка: ";
  if (mode === "similar_task") return "Дай похожую задачу и краткий разбор: ";
  return "";
}
