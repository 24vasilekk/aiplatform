import type { MetadataRoute } from "next";

function siteUrl() {
  return process.env.APP_URL?.trim() || "http://localhost:3000";
}

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api"],
    },
    sitemap: new URL("/sitemap.xml", base).toString(),
    host: base,
  };
}
