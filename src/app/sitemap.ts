import { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const locales = ["zh", "en"];

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

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    const prefix = locale === "zh" ? "" : `/${locale}`;

    entries.push(
      { url: `${siteUrl}${prefix}`, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
      { url: `${siteUrl}${prefix}/docs`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
      { url: `${siteUrl}${prefix}/questions`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
      { url: `${siteUrl}${prefix}/software`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
      { url: `${siteUrl}${prefix}/search`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.5 },
    );

    for (const a of articles) {
      entries.push({
        url: `${siteUrl}${prefix}/docs/${a.slug}`,
        lastModified: a.updatedAt,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }

    for (const q of questions) {
      entries.push({
        url: `${siteUrl}${prefix}/questions/${q.slug}`,
        lastModified: q.updatedAt,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }

    for (const s of software) {
      entries.push({
        url: `${siteUrl}${prefix}/software/${s.slug}`,
        lastModified: s.updatedAt,
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  }

  return entries;
}
