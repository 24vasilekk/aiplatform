import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PDFParse } from "pdf-parse";

const TEXT_MIME_PREFIXES = ["text/"];
const TEXT_MIME_EXACT = new Set([
  "application/json",
  "application/xml",
  "application/javascript",
  "application/typescript",
]);
const execFileAsync = promisify(execFile);

export type TimecodeCheck = {
  raw: string;
  seconds: number;
  inRange: boolean;
};

export type UploadExtractionResult = {
  extractedText: string;
  summary: string;
  pageCount: number | null;
  textChars: number;
};

function isTextMime(mimeType: string) {
  return TEXT_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix)) || TEXT_MIME_EXACT.has(mimeType);
}

function parseTimecodeToSeconds(value: string): number | null {
  const parts = value.split(":").map((part) => Number(part));
  if (parts.some((item) => Number.isNaN(item))) return null;

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  return null;
}

export function extractTimecodes(text: string, videoDurationSec?: number): TimecodeCheck[] {
  const matches = text.match(/\b(?:\d{1,2}:)?\d{1,2}:\d{2}\b/g) ?? [];
  const unique = Array.from(new Set(matches)).slice(0, 30);

  return unique
    .map((raw) => {
      const seconds = parseTimecodeToSeconds(raw);
      if (seconds === null) return null;

      const inRange =
        typeof videoDurationSec === "number"
          ? seconds >= 0 && seconds <= Math.max(0, Math.floor(videoDurationSec))
          : true;

      return { raw, seconds, inRange } satisfies TimecodeCheck;
    })
    .filter((item): item is TimecodeCheck => item !== null);
}

async function extractTextFromImageByAi(input: {
  mimeType: string;
  bytes: Uint8Array;
}) {
  const key =
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENROUTERAPIKEY ||
    process.env.openrouterapikey;
  const model = process.env.OPENROUTER_VISION_MODEL ?? process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

  if (!key) {
    return "OCR недоступен: не задан OPENROUTER_API_KEY.";
  }

  const imageBase64 = Buffer.from(input.bytes).toString("base64");
  const imageDataUrl = `data:${input.mimeType};base64,${imageBase64}`;

  let response: Response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
            content:
              "Извлеки текст с изображения максимально точно. Если текста нет, ответь: Текст не обнаружен.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Считай текст с изображения и верни только распознанный текст." },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        temperature: 0,
      }),
    });
  } catch {
    return "OCR временно недоступен: ошибка сети при обращении к AI.";
  }

  if (!response.ok) {
    return `OCR временно недоступен (status ${response.status}).`;
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return data.choices?.[0]?.message?.content?.trim() || "Текст не обнаружен.";
}

function normalizeExtractedText(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildSummaryFromText(text: string, maxLength = 360) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Краткая выжимка не сформирована: в файле не найден текст.";
  }

  const parts = normalized
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  let summary = "";
  for (const part of parts) {
    const candidate = summary ? `${summary} ${part}` : part;
    if (candidate.length > maxLength) break;
    summary = candidate;
    if (summary.length > 220 && /[.!?]$/.test(summary)) break;
  }

  if (!summary) {
    summary = normalized.slice(0, maxLength);
  }

  return summary;
}

async function tryGetPdfPageCount(storagePath: string) {
  try {
    const { stdout } = await execFileAsync("pdfinfo", [storagePath], {
      maxBuffer: 2 * 1024 * 1024,
    });
    const match = stdout.match(/Pages:\s+(\d+)/i);
    if (!match) return null;
    const count = Number(match[1]);
    return Number.isFinite(count) && count > 0 ? count : null;
  } catch {
    return null;
  }
}

async function tryExtractPdfTextLayer(storagePath: string) {
  try {
    const { stdout } = await execFileAsync(
      "pdftotext",
      ["-enc", "UTF-8", "-layout", "-nopgbrk", storagePath, "-"],
      { maxBuffer: 24 * 1024 * 1024 },
    );

    const text = normalizeExtractedText(stdout);
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

async function tryExtractPdfTextLayerJs(pdfBytes: Buffer) {
  const parser = new PDFParse({ data: pdfBytes });

  try {
    const parsed = await parser.getText();
    const text = normalizeExtractedText(parsed.text || "");
    if (!text) {
      return null;
    }

    return {
      text,
      pageCount: Number.isFinite(parsed.total) ? parsed.total : null,
    };
  } catch {
    return null;
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function tryExtractPdfByAiOcr(storagePath: string) {
  const key =
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENROUTERAPIKEY ||
    process.env.openrouterapikey;
  if (!key) {
    return null;
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ege-pdf-ocr-"));
  const imagePrefix = path.join(tempDir, "page");
  const maxPagesRaw = process.env.PDF_OCR_MAX_PAGES?.trim();
  const maxPages =
    maxPagesRaw && Number.isFinite(Number(maxPagesRaw)) && Number(maxPagesRaw) > 0
      ? Math.floor(Number(maxPagesRaw))
      : null;

  try {
    // Convert all pages by default; optional env limit can cap pages for cost/speed control.
    const pdftoppmArgs = ["-png", "-f", "1"];
    if (maxPages) {
      pdftoppmArgs.push("-l", String(maxPages));
    }
    pdftoppmArgs.push(storagePath, imagePrefix);

    await execFileAsync("pdftoppm", pdftoppmArgs, { maxBuffer: 8 * 1024 * 1024 });

    const files = (await fs.readdir(tempDir))
      .filter((name) => /^page-\d+\.png$/i.test(name))
      .sort((a, b) => {
        const aN = Number(a.match(/\d+/)?.[0] ?? 0);
        const bN = Number(b.match(/\d+/)?.[0] ?? 0);
        return aN - bN;
      });

    if (files.length === 0) return null;

    const chunks: string[] = [];
    for (const fileName of files) {
      const bytes = await fs.readFile(path.join(tempDir, fileName));
      const pageText = await extractTextFromImageByAi({
        mimeType: "image/png",
        bytes,
      });

      chunks.push(`=== ${fileName} ===\n${pageText}`);
    }

    const merged = normalizeExtractedText(chunks.join("\n\n"));
    if (!merged) return null;

    return {
      text: merged,
      pageCount: files.length,
    };
  } catch {
    return null;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

export async function extractTextFromUpload(input: {
  mimeType: string;
  originalName: string;
  storagePath: string;
}) {
  const extracted = await extractUploadContent(input);
  return extracted.extractedText;
}

export async function extractUploadContent(input: {
  mimeType: string;
  originalName: string;
  storagePath: string;
}): Promise<UploadExtractionResult> {
  const bytes = await fs.readFile(input.storagePath);
  const lowerName = input.originalName.toLowerCase();
  const isImage = input.mimeType.startsWith("image/");

  if (isImage) {
    const extractedText = await extractTextFromImageByAi({ mimeType: input.mimeType, bytes });
    return {
      extractedText,
      summary: buildSummaryFromText(extractedText),
      pageCount: null,
      textChars: extractedText.length,
    };
  }

  if (
    isTextMime(input.mimeType) ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".csv") ||
    lowerName.endsWith(".json") ||
    lowerName.endsWith(".ts") ||
    lowerName.endsWith(".js")
  ) {
    const extractedText = bytes.toString("utf8").trim() || "Файл пустой.";
    return {
      extractedText,
      summary: buildSummaryFromText(extractedText),
      pageCount: null,
      textChars: extractedText.length,
    };
  }

  if (lowerName.endsWith(".pdf")) {
    const pageCountByMeta = await tryGetPdfPageCount(input.storagePath);
    const jsLayer = await tryExtractPdfTextLayerJs(bytes);
    if (jsLayer) {
      return {
        extractedText: jsLayer.text,
        summary: buildSummaryFromText(jsLayer.text),
        pageCount: pageCountByMeta ?? jsLayer.pageCount,
        textChars: jsLayer.text.length,
      };
    }

    const textLayer = await tryExtractPdfTextLayer(input.storagePath);
    if (textLayer) {
      return {
        extractedText: textLayer,
        summary: buildSummaryFromText(textLayer),
        pageCount: pageCountByMeta,
        textChars: textLayer.length,
      };
    }

    const ocr = await tryExtractPdfByAiOcr(input.storagePath);
    if (ocr) {
      return {
        extractedText: ocr.text,
        summary: buildSummaryFromText(ocr.text),
        pageCount: pageCountByMeta ?? ocr.pageCount,
        textChars: ocr.text.length,
      };
    }

    const extractedText =
      "Не удалось извлечь текст из PDF. Для OCR проверьте, что установлены pdftotext/pdftoppm и задан OPENROUTER_API_KEY.";
    return {
      extractedText,
      summary: buildSummaryFromText(extractedText),
      pageCount: pageCountByMeta,
      textChars: extractedText.length,
    };
  }

  const extractedText = "Этот формат пока не поддерживается для извлечения текста.";
  return {
    extractedText,
    summary: buildSummaryFromText(extractedText),
    pageCount: null,
    textChars: extractedText.length,
  };
}

export function buildAttachmentContext(input: {
  originalName: string;
  mimeType: string;
  extractedText: string;
  timecodes: TimecodeCheck[];
}) {
  const safeText = input.extractedText.slice(0, 4000);
  const timecodesSummary =
    input.timecodes.length > 0
      ? input.timecodes
          .map((item) => `${item.raw} (${item.inRange ? "ok" : "out_of_range"})`)
          .join(", ")
      : "не найдены";

  return [
    `[Вложение: ${input.originalName}]`,
    `MIME: ${input.mimeType}`,
    `Таймкоды: ${timecodesSummary}`,
    "Извлеченный текст:",
    safeText,
  ].join("\n");
}
