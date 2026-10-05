import { prisma } from "@/lib/db";
import { getApiT, getRequestLocale } from "@/lib/api-i18n";

// Without a dynamic marker this route was prerendered at build time, so the
// published feed never changed after deployment (and in Docker it baked the
// empty build-time database). Request-time generation + the Cache-Control
// header below keeps it fresh without hitting the DB on every request.
export const dynamic = "force-dynamic";

export async function GET() {
  const t = await getApiT("common");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const articles = await prisma.article.findMany({
    where: { status: "published" },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      title: true,
      slug: true,
      excerpt: true,
      createdAt: true,
      author: { select: { name: true } },
    },
  });

  const items = articles
    .map((a) => {
      const title = a.title;
      const link = siteUrl + "/solutions/" + a.slug;
      const desc = a.excerpt || a.title;
      const author = a.author.name || "Solution";
      const pubDate = new Date(a.createdAt).toUTCString();
      return "<item>" +
        "<title><![CDATA[" + title + "]]></title>" +
        "<link>" + link + "</link>" +
        "<description><![CDATA[" + desc + "]]></description>" +
        "<author>" + author + "</author>" +
        "<pubDate>" + pubDate + "</pubDate>" +
        "<guid>" + link + "</guid>" +
        "</item>";
    })
    .join("\n");

  const xml = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">' +
    "<channel>" +
    "<title>Solution</title>" +
    "<link>" + siteUrl + "</link>" +
    "<description>" + t("siteDescription") + "</description>" +
    "<language>" + (getRequestLocale() === "en" ? "en" : "zh-CN") + "</language>" +
    "<lastBuildDate>" + new Date().toUTCString() + "</lastBuildDate>" +
    '<atom:link href="' + siteUrl + '/api/rss" rel="self" type="application/rss+xml"/>' +
    items +
    "</channel>" +
    "</rss>";

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
