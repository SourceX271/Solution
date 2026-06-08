import { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

// Simple in-memory cache with TTL
let cachedSitemap: MetadataRoute.Sitemap | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = Date.now();
  if (cachedSitemap && now - cacheTimestamp < CACHE_TTL) {
    return cachedSitemap;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const [articles, questions, software] = await Promise.all([
    prisma.article.findMany({
      where: { status: "published" },
      select: { slug: true, updatedAt: true },
      take: 500,
    }),
    prisma.question.findMany({
      select: { slug: true, updatedAt: true },
      take: 500,
    }),
    prisma.software.findMany({
      where: { status: "published" },
      select: { slug: true, updatedAt: true },
      take: 500,
    }),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: siteUrl + "/docs", lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: siteUrl + "/questions", lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: siteUrl + "/software", lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: siteUrl + "/search", lastModified: new Date(), changeFrequency: "weekly", priority: 0.5 },
  ];

  const articlePages: MetadataRoute.Sitemap = articles.map((a) => ({
    url: siteUrl + "/docs/" + a.slug,
    lastModified: a.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const questionPages: MetadataRoute.Sitemap = questions.map((q) => ({
    url: siteUrl + "/questions/" + q.slug,
    lastModified: q.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const softwarePages: MetadataRoute.Sitemap = software.map((s) => ({
    url: siteUrl + "/software/" + s.slug,
    lastModified: s.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  cachedSitemap = [...staticPages, ...articlePages, ...questionPages, ...softwarePages];
  cacheTimestamp = now;

  return cachedSitemap;
}
