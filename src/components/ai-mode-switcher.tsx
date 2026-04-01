"use client";

import { AI_MODE_OPTIONS, type AiMode } from "@/lib/ai-mode";

export function AiModeSwitcher({
  mode,
  onChange,
}: {
  mode: AiMode;
  onChange: (nextMode: AiMode) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {AI_MODE_OPTIONS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={mode === item.id ? "btn-primary px-3 py-1.5 text-xs" : "btn-ghost px-3 py-1.5 text-xs"}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
