import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { createAdminAuditLog, deletePost, findPostBySlug, updatePost } from "@/lib/db";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const schema = z.object({
  slug: z.string().trim().min(3).max(120).regex(slugPattern).optional(),
  title: z.string().trim().min(3).max(200).optional(),
  excerpt: z.string().trim().min(10).max(500).optional(),
  content: z.string().trim().min(20).optional(),
  coverImage: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  publishedAt: z.union([z.string().datetime(), z.literal(""), z.null()]).optional(),
  isPublished: z.boolean().optional(),
});

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const auth = await authorize(request);
  if (auth.error || !auth.user) return auth.error;

  const { postId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Неверные данные поста" }, { status: 400 });
  }

  if (parsed.data.slug) {
    const existing = await findPostBySlug(parsed.data.slug);
    if (existing && existing.id !== postId) {
      return NextResponse.json({ error: "Пост с таким slug уже существует" }, { status: 409 });
    }
  }

  const post = await updatePost(postId, {
    slug: parsed.data.slug,
    title: parsed.data.title,
    excerpt: parsed.data.excerpt,
    content: parsed.data.content,
    coverImage:
      parsed.data.coverImage === undefined
        ? undefined
        : parsed.data.coverImage === ""
          ? null
          : parsed.data.coverImage,
    publishedAt:
      parsed.data.publishedAt === undefined
        ? undefined
        : parsed.data.publishedAt
          ? new Date(parsed.data.publishedAt)
          : null,
    isPublished: parsed.data.isPublished,
  });

  if (!post) {
    return NextResponse.json({ error: "Пост не найден" }, { status: 404 });
  }
  await createAdminAuditLog({
    adminUserId: auth.user.id,
    action: "update_post",
    entityType: "post",
    entityId: post.id,
    metadata: parsed.data,
  });

  return NextResponse.json({ ok: true, post });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const auth = await authorize(request);
  if (auth.error || !auth.user) return auth.error;

  const { postId } = await params;
  const ok = await deletePost(postId);

  if (!ok) {
    return NextResponse.json({ error: "Пост не найден" }, { status: 404 });
  }
  await createAdminAuditLog({
    adminUserId: auth.user.id,
    action: "delete_post",
    entityType: "post",
    entityId: postId,
  });

  return NextResponse.json({ ok: true });
}
