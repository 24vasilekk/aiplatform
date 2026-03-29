import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { buildAttachmentContext, extractTimecodes, extractUploadContent } from "@/lib/attachment-ai";

const MAX_BYTES = 8 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);

function normalizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "upload";
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "Пустой файл" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Файл слишком большой (до 8 MB)" }, { status: 400 });
  }

  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_TYPES.has(mimeType) && !mimeType.startsWith("text/")) {
    return NextResponse.json({ error: "Тип файла пока не поддерживается" }, { status: 400 });
  }

  const storageDir = path.join(os.tmpdir(), "ege-mvp", "attachments");
  await fs.mkdir(storageDir, { recursive: true });

  const safeName = normalizeFilename(file.name || "upload");
  const extension = path.extname(safeName);
  const baseName = path.basename(safeName, extension);
  const finalName = `${baseName}-${crypto.randomUUID()}${extension}`;
  const storagePath = path.join(storageDir, finalName);

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(storagePath, bytes);

    const extracted = await extractUploadContent({
      mimeType,
      originalName: file.name || safeName,
      storagePath,
    });

    const timecodes = extractTimecodes(extracted.extractedText);
    const context = buildAttachmentContext({
      originalName: file.name || safeName,
      mimeType,
      extractedText: extracted.extractedText,
      timecodes,
    });

    return NextResponse.json({
      ok: true,
      context,
      summary: extracted.summary,
      pageCount: extracted.pageCount,
      textChars: extracted.textChars,
    });
  } catch {
    return NextResponse.json({ error: "Не удалось обработать файл." }, { status: 500 });
  } finally {
    await fs.rm(storagePath, { force: true }).catch(() => undefined);
  }
}
