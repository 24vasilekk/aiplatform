import path from "node:path";
import { promises as fs } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { extractUploadContent } from "@/lib/attachment-ai";
import { getLessonKnowledge, upsertLessonKnowledge } from "@/lib/db";

const MAX_BYTES = 12 * 1024 * 1024;

function normalizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "lesson-knowledge";
}

async function authorize(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) {
    return { error: auth.error, user: null };
  }

  if (auth.user.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), user: null };
  }

  return { error: null, user: auth.user };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const auth = await authorize(request);
  if (auth.error) {
    return auth.error;
  }

  const { lessonId } = await params;
  const knowledge = await getLessonKnowledge(lessonId);
  return NextResponse.json({ knowledge });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const auth = await authorize(request);
  if (auth.error) {
    return auth.error;
  }

  const { lessonId } = await params;
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "Пустой файл" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Файл слишком большой (до 12 MB)" }, { status: 400 });
  }

  const mimeType = file.type || "application/octet-stream";
  const storageDir = path.join(process.cwd(), "data", "lesson-knowledge");
  await fs.mkdir(storageDir, { recursive: true });

  const safeName = normalizeFilename(file.name || "lesson-knowledge");
  const extension = path.extname(safeName);
  const baseName = path.basename(safeName, extension);
  const finalName = `${lessonId}-${baseName}-${crypto.randomUUID()}${extension}`;
  const storagePath = path.join(storageDir, finalName);

  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(storagePath, bytes);

  const extracted = await extractUploadContent({
    mimeType,
    originalName: file.name || safeName,
    storagePath,
  });

  const knowledge = await upsertLessonKnowledge({
    lessonId,
    originalName: file.name || safeName,
    mimeType,
    storagePath,
    extractedText: extracted.extractedText,
    summary: extracted.summary,
    pageCount: extracted.pageCount,
    textChars: extracted.textChars,
  });

  return NextResponse.json({ ok: true, knowledge }, { status: 201 });
}
