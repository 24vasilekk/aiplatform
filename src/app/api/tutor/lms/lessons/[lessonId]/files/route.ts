import path from "node:path";
import { promises as fs } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/api-auth";
import { extractUploadContent } from "@/lib/attachment-ai";
import { applyPrivateCache } from "@/lib/http-cache";
import {
  canTutorManageLesson,
  createAdminAuditLog,
  deleteTutorLessonKnowledge,
  getTutorLessonKnowledge,
  upsertTutorLessonKnowledge,
} from "@/lib/db";
import { applyRateLimitHeaders, createRateLimitResponse, rateLimitByRequest } from "@/lib/security";

const MAX_BYTES_PDF = 12 * 1024 * 1024;
const MAX_BYTES_DOCX = 12 * 1024 * 1024;
const MAX_BYTES_TXT = 2 * 1024 * 1024;

const SAFE_TYPES = {
  pdf: {
    mime: "application/pdf",
    extensions: [".pdf"] as readonly string[],
    maxBytes: MAX_BYTES_PDF,
  },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extensions: [".docx"] as readonly string[],
    maxBytes: MAX_BYTES_DOCX,
  },
  txt: {
    mime: "text/plain",
    extensions: [".txt"] as readonly string[],
    maxBytes: MAX_BYTES_TXT,
  },
} as const;

function normalizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "lesson-file";
}

function resolveTypeByMimeOrExtension(mimeType: string, extension: string) {
  if (mimeType === SAFE_TYPES.pdf.mime || SAFE_TYPES.pdf.extensions.includes(extension)) return SAFE_TYPES.pdf;
  if (mimeType === SAFE_TYPES.docx.mime || SAFE_TYPES.docx.extensions.includes(extension)) return SAFE_TYPES.docx;
  if (mimeType.startsWith("text/") || mimeType === SAFE_TYPES.txt.mime || SAFE_TYPES.txt.extensions.includes(extension)) {
    return SAFE_TYPES.txt;
  }
  return null;
}

function validateFileSignature(
  type: (typeof SAFE_TYPES)[keyof typeof SAFE_TYPES],
  bytes: Buffer,
) {
  if (type.mime === SAFE_TYPES.pdf.mime) {
    return bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  }

  if (type.mime === SAFE_TYPES.docx.mime) {
    return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  }

  if (type.mime === SAFE_TYPES.txt.mime) {
    for (const byte of bytes) {
      if (byte === 0) return false;
    }
    return true;
  }

  return false;
}

function isPathInside(parent: string, candidate: string) {
  const rel = path.relative(parent, candidate);
  return rel.length > 0 && !rel.startsWith("..") && !path.isAbsolute(rel);
}

async function deleteFileIfInsideRoot(storageRoot: string, candidatePath: string | null) {
  if (!candidatePath) return;
  const root = path.resolve(storageRoot);
  const target = path.resolve(candidatePath);
  if (!isPathInside(root, target)) return;
  await fs.rm(target, { force: true }).catch(() => undefined);
}

async function authorize(request: NextRequest) {
  return requireRoles(request, ["tutor"]);
}

function toClientKnowledgeView(knowledge: {
  id: string;
  lessonId: string;
  originalName: string;
  mimeType: string;
  summary: string | null;
  pageCount: number | null;
  textChars: number;
  updatedAt: string;
}) {
  return {
    id: knowledge.id,
    lessonId: knowledge.lessonId,
    originalName: knowledge.originalName,
    mimeType: knowledge.mimeType,
    summary: knowledge.summary,
    pageCount: knowledge.pageCount,
    textChars: knowledge.textChars,
    updatedAt: knowledge.updatedAt,
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ lessonId: string }> }) {
  const auth = await authorize(request);
  if (auth.error || !auth.user) return auth.error;
  const rateLimit = rateLimitByRequest({
    request,
    namespace: "tutor_lms_lesson_files_get",
    keySuffix: auth.user.id,
    limit: 220,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много запросов файла урока. Попробуйте позже.");
  }

  const { lessonId } = await params;
  const knowledge = await getTutorLessonKnowledge(auth.user.id, lessonId);
  if (!knowledge) {
    const response = NextResponse.json({ knowledge: null });
    applyPrivateCache(response, { maxAgeSec: 10, staleWhileRevalidateSec: 30 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const response = NextResponse.json({ knowledge: toClientKnowledgeView(knowledge) });
  applyPrivateCache(response, { maxAgeSec: 10, staleWhileRevalidateSec: 30 });
  applyRateLimitHeaders(response, rateLimit);
  return response;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ lessonId: string }> }) {
  const auth = await authorize(request);
  if (auth.error || !auth.user) return auth.error;
  const rateLimit = rateLimitByRequest({
    request,
    namespace: "tutor_lms_lesson_files_post",
    keySuffix: auth.user.id,
    limit: 40,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много загрузок файлов. Попробуйте позже.");
  }

  const { lessonId } = await params;
  const lessonOwnedByTutor = await canTutorManageLesson(auth.user.id, lessonId);
  if (!lessonOwnedByTutor) {
    const response = NextResponse.json({ error: "Урок не найден или недоступен" }, { status: 404 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    const response = NextResponse.json({ error: "Файл не передан" }, { status: 400 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }
  if (file.size <= 0) {
    const response = NextResponse.json({ error: "Пустой файл" }, { status: 400 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }
  const safeName = normalizeFilename(file.name || "lesson-file");
  const extension = path.extname(safeName).toLowerCase();
  const mimeType = (file.type || "").trim().toLowerCase() || "application/octet-stream";
  const safeType = resolveTypeByMimeOrExtension(mimeType, extension);
  if (!safeType) {
    const response = NextResponse.json({ error: "Разрешены только PDF, DOCX и TXT файлы" }, { status: 400 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }
  if (file.size > safeType.maxBytes) {
    const maxMb = (safeType.maxBytes / (1024 * 1024)).toFixed(0);
    const response = NextResponse.json({ error: `Файл слишком большой (до ${maxMb} MB)` }, { status: 400 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!validateFileSignature(safeType, bytes)) {
    const response = NextResponse.json({ error: "Сигнатура файла не соответствует заявленному типу" }, { status: 400 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const storageRoot = path.join(process.cwd(), "data", "lesson-knowledge", "tutors");
  const storageDir = path.join(storageRoot, auth.user.id);
  await fs.mkdir(storageDir, { recursive: true });

  const baseName = path.basename(safeName, extension);
  const finalName = `${lessonId}-${baseName}-${crypto.randomUUID()}${extension}`;
  const storagePath = path.join(storageDir, finalName);

  const previousKnowledge = await getTutorLessonKnowledge(auth.user.id, lessonId);
  let knowledge: Awaited<ReturnType<typeof upsertTutorLessonKnowledge>> = null;
  try {
    await fs.writeFile(storagePath, bytes);

    const extracted = await extractUploadContent({
      mimeType: safeType.mime,
      originalName: file.name || safeName,
      storagePath,
    });

    knowledge = await upsertTutorLessonKnowledge(auth.user.id, {
      lessonId,
      originalName: file.name || safeName,
      mimeType: safeType.mime,
      storagePath,
      extractedText: extracted.extractedText,
      summary: extracted.summary,
      pageCount: extracted.pageCount,
      textChars: extracted.textChars,
    });
    if (!knowledge) {
      await deleteFileIfInsideRoot(storageRoot, storagePath);
      const response = NextResponse.json({ error: "Урок не найден или недоступен" }, { status: 404 });
      applyRateLimitHeaders(response, rateLimit);
      return response;
    }
  } catch {
    await deleteFileIfInsideRoot(storageRoot, storagePath);
    const response = NextResponse.json({ error: "Не удалось обработать файл урока" }, { status: 500 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  if (previousKnowledge?.storagePath && previousKnowledge.storagePath !== storagePath) {
    await deleteFileIfInsideRoot(storageRoot, previousKnowledge.storagePath);
  }

  await createAdminAuditLog({
    adminUserId: auth.user.id,
    action: "tutor_lms_upsert_lesson_file",
    entityType: "tutor_lesson_file",
    entityId: knowledge.id,
    metadata: {
      ownerId: auth.user.id,
      lessonId,
      mimeType: safeType.mime,
      originalName: file.name || safeName,
      textChars: knowledge.textChars,
      maxBytes: safeType.maxBytes,
      wasUpdate: Boolean(previousKnowledge),
      replacedKnowledgeId: previousKnowledge?.id ?? null,
    },
  });

  const response = NextResponse.json({ ok: true, knowledge: toClientKnowledgeView(knowledge) }, { status: 201 });
  applyRateLimitHeaders(response, rateLimit);
  return response;
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ lessonId: string }> }) {
  const auth = await authorize(request);
  if (auth.error || !auth.user) return auth.error;
  const rateLimit = rateLimitByRequest({
    request,
    namespace: "tutor_lms_lesson_files_delete",
    keySuffix: auth.user.id,
    limit: 60,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много удалений файлов уроков. Попробуйте позже.");
  }

  const { lessonId } = await params;
  const previousKnowledge = await getTutorLessonKnowledge(auth.user.id, lessonId);
  if (!previousKnowledge) {
    const response = NextResponse.json({ error: "Файл урока не найден" }, { status: 404 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const ok = await deleteTutorLessonKnowledge(auth.user.id, lessonId);
  if (!ok) {
    const response = NextResponse.json({ error: "Файл урока не найден" }, { status: 404 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }
  const storageRoot = path.join(process.cwd(), "data", "lesson-knowledge", "tutors");
  await deleteFileIfInsideRoot(storageRoot, previousKnowledge.storagePath);

  await createAdminAuditLog({
    adminUserId: auth.user.id,
    action: "tutor_lms_delete_lesson_file",
    entityType: "tutor_lesson_file",
    entityId: previousKnowledge.id,
    metadata: {
      ownerId: auth.user.id,
      lessonId,
      removedStoragePath: previousKnowledge.storagePath,
      removedOriginalName: previousKnowledge.originalName,
    },
  });

  const response = NextResponse.json({ ok: true });
  applyRateLimitHeaders(response, rateLimit);
  return response;
}
