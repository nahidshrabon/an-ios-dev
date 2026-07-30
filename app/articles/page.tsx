import type { Metadata } from "next";
import Link from "next/link";
import { getAllArticles } from "@/lib/content/articles";

export const metadata: Metadata = {
  title: "Articles",
  description: "Short articles on Swift, SwiftUI, and iOS app architecture.",
};

export default function ArticlesPage() {
  const articles = getAllArticles();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Articles</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Read at your own pace — sign in to track which ones you've finished.
      </p>
      <ul className="mt-8 flex flex-col gap-4">
        {articles.map((article) => (
          <li key={article.slug}>
            <Link
              href={`/articles/${article.slug}`}
              className="block rounded-xl border border-black/10 p-5 transition-colors hover:bg-black/[.03] dark:border-white/10 dark:hover:bg-[#161616]"
            >
              <p className="font-medium">{article.title}</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {article.description}
              </p>
              <div className="mt-3 flex gap-2">
                {article.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-black/5 px-2.5 py-0.5 text-xs text-zinc-600 dark:bg-white/10 dark:text-zinc-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
