import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

const siteUrl = getSiteUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/roadmap", "/roadmap/*", "/quizzes", "/quizzes/*", "/auth/*"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
