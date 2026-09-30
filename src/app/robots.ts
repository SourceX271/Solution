import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The admin area is also served under a locale prefix (/en/admin/...).
        disallow: [
          "/api/",
          "/admin/",
          "/en/admin/",
          "/zh/admin/",
          "/_next/",
          "/login",
          "/register",
          "/en/login",
          "/en/register",
          "/profile",
          "/en/profile",
          "/settings",
          "/en/settings",
          "/notifications",
          "/en/notifications",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
