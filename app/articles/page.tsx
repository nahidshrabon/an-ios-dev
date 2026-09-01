import type { Metadata } from "next";
import { getAllArticles, getFilterTags } from "@/lib/content/articles";
import { ArticleBrowser } from "@/components/ArticleBrowser";

export const metadata: Metadata = {
  title: "Articles",
  description: "Short articles on Swift, SwiftUI, and iOS app architecture.",
};

export default function ArticlesPage() {
  // Strip `content` — the browser only lists articles, and the full markdown
  // bodies would balloon the client payload.
  const articles = getAllArticles().map(
    ({ slug, title, description, tags }) => ({
      slug,
      title,
      description,
      tags,
    })
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Articles
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Read at your own pace — sign in to track which ones you&apos;ve
        finished.
      </p>

      <ArticleBrowser articles={articles} filterTags={getFilterTags()} />
    </main>
  );
}
