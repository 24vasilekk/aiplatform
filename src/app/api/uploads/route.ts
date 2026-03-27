import path from "node:path";
import { promises as fs } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createUserUpload, listUserUploads } from "@/lib/db";

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

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }

  const uploads = await listUserUploads(auth.user.id);
  return NextResponse.json({ uploads });
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

  const storageDir = path.join(process.cwd(), "data", "uploads");
  await fs.mkdir(storageDir, { recursive: true });

  const safeName = normalizeFilename(file.name || "upload");
  const extension = path.extname(safeName);
  const baseName = path.basename(safeName, extension);
  const finalName = `${baseName}-${crypto.randomUUID()}${extension}`;
  const storagePath = path.join(storageDir, finalName);

  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(storagePath, bytes);

  const upload = await createUserUpload({
    userId: auth.user.id,
    originalName: file.name || safeName,
    mimeType,
    sizeBytes: file.size,
    storagePath,
  });

  return NextResponse.json({ ok: true, upload }, { status: 201 });
}
