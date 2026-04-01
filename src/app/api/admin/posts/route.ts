import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { createAdminAuditLog, createPost, findPostBySlug, listPosts } from "@/lib/db";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const schema = z.object({
  slug: z.string().trim().min(3).max(120).regex(slugPattern),
  title: z.string().trim().min(3).max(200),
  excerpt: z.string().trim().min(10).max(500),
  content: z.string().trim().min(20),
  coverImage: z.union([z.string().url(), z.literal("")]).optional(),
  publishedAt: z.union([z.string().datetime(), z.literal(""), z.null()]).optional(),
  isPublished: z.boolean().default(false),
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

export async function GET(request: NextRequest) {
  const auth = await authorize(request);
  if (auth.error) {
    return auth.error;
  }

  const posts = await listPosts();
  return NextResponse.json(posts);
}

export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if (auth.error) {
    return auth.error;
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Неверные данные поста" }, { status: 400 });
  }

  const existing = await findPostBySlug(parsed.data.slug);
  if (existing) {
    return NextResponse.json({ error: "Пост с таким slug уже существует" }, { status: 409 });
  }

  const post = await createPost({
    slug: parsed.data.slug,
    title: parsed.data.title,
    excerpt: parsed.data.excerpt,
    content: parsed.data.content,
    coverImage: parsed.data.coverImage ? parsed.data.coverImage : null,
    publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : null,
    isPublished: parsed.data.isPublished,
  });

  if (!post) {
    return NextResponse.json({ error: "Не удалось создать пост" }, { status: 500 });
  }
  await createAdminAuditLog({
    adminUserId: auth.user.id,
    action: "create_post",
    entityType: "post",
    entityId: post.id,
    metadata: {
      slug: post.slug,
      isPublished: post.isPublished,
    },
  });

  return NextResponse.json({ ok: true, post }, { status: 201 });
}
