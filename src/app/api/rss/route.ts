import { prisma } from "@/lib/db";
import { getApiT, getRequestLocale } from "@/lib/api-i18n";

// Without a dynamic marker this route was prerendered at build time, so the
// published feed never changed after deployment (and in Docker it baked the
// empty build-time database). Request-time generation + the Cache-Control
// header below keeps it fresh without hitting the DB on every request.
export const dynamic = "force-dynamic";

/**
 * Escape a value for use in XML text or an attribute.
 *
 * The feed used to interpolate titles, excerpts and author names verbatim, so a
 * user with `A & B` as their display name publishing one article produced a
 * non-well-formed document that broke every subscriber's parser.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Escape a value for a CDATA section.
 *
 * `]]>` inside the payload would otherwise terminate the section early and let
 * the content inject arbitrary XML (extra `<item>`s, links, …).
 */
function escapeCdata(value: string): string {
  return value.replace(/]]>/g, "]]]]><![CDATA[>");
}

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
      // The slug is a generated ASCII random string, but escape it anyway: this
      // is the only place the feed builds a URL from stored data.
      const link = siteUrl + "/solutions/" + encodeURIComponent(a.slug);
      const desc = a.excerpt || a.title;
      const author = a.author.name || "Solution";
      const pubDate = new Date(a.createdAt).toUTCString();
      return "<item>" +
        "<title><![CDATA[" + escapeCdata(title) + "]]></title>" +
        "<link>" + escapeXml(link) + "</link>" +
        "<description><![CDATA[" + escapeCdata(desc) + "]]></description>" +
        "<author>" + escapeXml(author) + "</author>" +
        "<pubDate>" + escapeXml(pubDate) + "</pubDate>" +
        "<guid>" + escapeXml(link) + "</guid>" +
        "</item>";
    })
    .join("\n");

  const xml = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">' +
    "<channel>" +
    "<title>Solution</title>" +
    "<link>" + escapeXml(siteUrl) + "</link>" +
    "<description>" + escapeXml(t("siteDescription")) + "</description>" +
    "<language>" + ((await getRequestLocale()) === "en" ? "en" : "zh-CN") + "</language>" +
    "<lastBuildDate>" + new Date().toUTCString() + "</lastBuildDate>" +
    '<atom:link href="' + escapeXml(siteUrl) + '/api/rss" rel="self" type="application/rss+xml"/>' +
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
