"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { XIcon } from "@/components/Icons";

/**
 * Article fields the browser needs. Deliberately excludes `content` — the
 * full markdown bodies are far too large to ship to the client just to
 * render a list.
 */
export type ArticleListItem = {
  slug: string;
  title: string;
  description: string;
  tags: string[];
};

const activeChip = "bg-accent text-white";
const inactiveChip =
  "border border-black/10 text-zinc-600 hover:bg-black/[.03] dark:border-white/10 dark:text-zinc-400 dark:hover:bg-white/5";

export function ArticleBrowser({
  articles,
  filterTags,
}: {
  articles: ArticleListItem[];
  filterTags: string[];
}) {
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Text search lives in the site-wide search panel, which also covers
  // article sections; this list only narrows by tag.
  const results = useMemo(
    () =>
      activeTag
        ? articles.filter((article) => article.tags.includes(activeTag))
        : articles,
    [articles, activeTag]
  );

  const isFiltered = activeTag !== null;

  function clearFilters() {
    setActiveTag(null);
  }

  return (
    <div>
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTag(null)}
          className={`font-heading rounded-full px-3 py-1 text-sm transition-colors ${
            activeTag === null ? activeChip : inactiveChip
          }`}
        >
          All
        </button>
        {filterTags.map((tag) => (
          <button
            key={tag}
            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            className={`font-heading rounded-full px-3 py-1 text-sm transition-colors ${
              activeTag === tag ? activeChip : inactiveChip
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      <p
        aria-live="polite"
        className="mt-4 text-sm text-zinc-600 dark:text-zinc-400"
      >
        {results.length} {results.length === 1 ? "article" : "articles"}
        {isFiltered && (
          <>
            {" · "}
            <button onClick={clearFilters} className="underline">
              Clear filters
            </button>
          </>
        )}
      </p>

      {results.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          No articles with that tag.{" "}
          <button onClick={clearFilters} className="underline">
            Clear the filter
          </button>
          .
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {results.map((article) => (
            <li
              key={article.slug}
              className="rounded-xl border border-black/10 p-5 transition-colors hover:bg-black/[.03] dark:border-white/10 dark:hover:bg-[#161616]"
            >
              <Link href={`/articles/${article.slug}`} className="block">
                <p className="font-heading font-medium">{article.title}</p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {article.description}
                </p>
              </Link>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {article.tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                    aria-label={`Filter by ${tag}`}
                    className={`font-heading rounded-full px-2 py-0.5 text-xs transition-colors ${
                      activeTag === tag
                        ? activeChip
                        : "bg-black/5 text-zinc-600 hover:bg-accent/10 hover:text-accent dark:bg-white/10 dark:text-zinc-400"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {isFiltered && results.length > 0 && (
        <button
          onClick={clearFilters}
          className="font-heading mt-6 inline-flex items-center gap-1.5 text-sm text-zinc-600 hover:text-foreground dark:text-zinc-400"
        >
          <XIcon className="size-4" />
          Clear filters
        </button>
      )}
    </div>
  );
}
