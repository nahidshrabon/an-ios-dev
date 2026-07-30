import type { MetadataRoute } from "next";
import { getAllArticles } from "@/lib/content/articles";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const articleEntries: MetadataRoute.Sitemap = getAllArticles().map(
    (article) => ({
      url: `${siteUrl}/articles/${article.slug}`,
      lastModified: article.publishedAt,
    })
  );

  return [
    { url: siteUrl, lastModified: new Date() },
    { url: `${siteUrl}/articles`, lastModified: new Date() },
    ...articleEntries,
  ];
}
