import { ImageResponse } from "next/og";

export const alt = "an iOS dev — learn iOS development, one article at a time";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Rendered at build time by Satori, which supports flexbox only — every
// element with more than one child needs an explicit display: flex.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          backgroundColor: "#0a0a0a",
          padding: 80,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="88" height="88" viewBox="0 0 32 32">
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
          <div style={{ display: "flex", fontSize: 56, color: "#ededed" }}>
            <span>an&nbsp;</span>
            <span style={{ color: "#0a84ff" }}>iOS</span>
            <span>&nbsp;dev</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 48,
            fontSize: 68,
            lineHeight: 1.15,
            color: "#ffffff",
            maxWidth: 900,
          }}
        >
          Learn iOS development, one article at a time.
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 32,
            color: "#a1a1aa",
          }}
        >
          Articles · Roadmap · Quizzes
        </div>
      </div>
    ),
    size
  );
}
