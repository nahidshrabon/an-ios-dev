import { ImageResponse } from "next/og";
import { getArticle } from "@/lib/content/articles";

export const alt = "an iOS dev article";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ArticleOpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticle(slug);
  const title = article?.title ?? "an iOS dev";
  const tags = article?.tags.slice(0, 3).join("  ·  ") ?? "";

  // Long titles would otherwise overflow the card; step down instead of wrap
  // into a fourth line.
  const titleSize = title.length > 46 ? 64 : title.length > 28 ? 78 : 92;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0a0a0a",
          padding: 80,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="52" height="52" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="8" fill="#007AFF" />
            <path
              d="M12 10l-5 6 5 6M20 10l5 6-5 6"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <div style={{ display: "flex", fontSize: 34, color: "#a1a1aa" }}>
            <span>an&nbsp;</span>
            <span style={{ color: "#0a84ff" }}>iOS</span>
            <span>&nbsp;dev</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: titleSize,
            lineHeight: 1.12,
            color: "#ffffff",
            maxWidth: 1040,
          }}
        >
          {title}
        </div>

        <div style={{ display: "flex", fontSize: 30, color: "#0a84ff" }}>
          {tags}
        </div>
      </div>
    ),
    size
  );
}
