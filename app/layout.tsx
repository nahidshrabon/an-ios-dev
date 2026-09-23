import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Geist, Geist_Mono, JetBrains_Mono, Literata } from "next/font/google";
import { ConditionalNav } from "@/components/ConditionalNav";
import { getSiteUrl } from "@/lib/site";
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

const description =
  "Learn iOS development with short articles, track your reading progress, and test yourself with quizzes.";

export const metadata: Metadata = {
  // Without this, every relative canonical and og:image below stays relative,
  // which crawlers and social scrapers can't resolve.
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "an iOS dev",
    template: "%s | an iOS dev",
  },
  description,
  openGraph: {
    siteName: "an iOS dev",
    type: "website",
    locale: "en_US",
    title: "an iOS dev",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "an iOS dev",
    description,
  },
  // Proves domain ownership to Google Search Console, which the OAuth
  // consent screen's brand verification depends on.
  verification: {
    google: "mXsAF_9tBe5h2-Q63pvWZ4e9dzhi4XjjfDw5Pu0KJ44",
  },
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
        <footer className="border-t border-black/10 dark:border-white/10">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-6 text-sm text-zinc-500">
            <p>© {new Date().getFullYear()} an iOS dev</p>
            <nav className="flex gap-4">
              <Link href="/privacy" className="hover:underline">
                Privacy
              </Link>
              <Link href="/terms" className="hover:underline">
                Terms
              </Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
