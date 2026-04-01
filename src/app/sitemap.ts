import type { MetadataRoute } from "next";
import { listPublishedPosts } from "@/lib/db";

function siteUrl() {
  return process.env.APP_URL?.trim() || "http://localhost:3000";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();
  let posts = [] as Awaited<ReturnType<typeof listPublishedPosts>>;
  try {
    posts = await listPublishedPosts();
  } catch {
    posts = [];
  }

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: new URL("/", base).toString(),
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: new URL("/blog", base).toString(),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: new URL("/pricing", base).toString(),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.5,
    },
  ];

  const blogRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: new URL(`/blog/${post.slug}`, base).toString(),
    lastModified: new Date(post.updatedAt),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...blogRoutes];
}
