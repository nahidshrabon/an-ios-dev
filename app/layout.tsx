import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono, JetBrains_Mono, Literata } from "next/font/google";
import { ConditionalNav } from "@/components/ConditionalNav";
import "highlight.js/styles/github-dark.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "an iOS dev",
    template: "%s | an iOS dev",
  },
  description:
    "Learn iOS development with short articles, track your reading progress, and test yourself with quizzes.",
};

/**
 * Runs synchronously before first paint so the page never flashes the wrong
 * theme. Kept in sync with ThemeToggle: a missing/unrecognised value means
 * "follow the OS".
 */
const themeScript = `
try {
  var stored = localStorage.getItem("theme");
  var isDark =
    stored === "dark" ||
    (stored !== "light" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // The script below sets `class="dark"` before React hydrates.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${jetbrainsMono.variable} ${literata.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Suspense fallback={null}>
          <ConditionalNav />
        </Suspense>
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
