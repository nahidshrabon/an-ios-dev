"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Article } from "@/lib/content/types";
import {
  READING_STATUSES,
  READING_STATUS_LABELS,
  type ReadingStatus,
} from "@/lib/types";

export function ProgressList({
  articles,
  initialProgress,
  userId,
}: {
  articles: Article[];
  initialProgress: Record<string, ReadingStatus>;
  userId: string;
}) {
  const [progress, setProgress] =
    useState<Record<string, ReadingStatus>>(initialProgress);
  const [supabase] = useState(() => createClient());

  async function setStatus(slug: string, status: ReadingStatus) {
    setProgress((prev) => ({ ...prev, [slug]: status }));
    await supabase.from("reading_progress").upsert({
      user_id: userId,
      article_slug: slug,
      status,
      updated_at: new Date().toISOString(),
    });
  }

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">All articles</h1>
      <ul className="mt-6 flex flex-col gap-3">
        {articles.map((article) => {
          const status = progress[article.slug] ?? "unread";
          return (
            <li
              key={article.slug}
              className="flex flex-col gap-3 rounded-xl border border-black/10 p-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between"
            >
              <Link
                href={`/articles/${article.slug}`}
                className="font-medium hover:underline"
              >
                {article.title}
              </Link>
              <div className="flex gap-1">
                {READING_STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(article.slug, s)}
                    className={`rounded-full px-3 py-1 text-xs transition-colors ${
                      status === s
                        ? "bg-foreground text-background"
                        : "bg-black/5 text-zinc-600 hover:bg-black/10 dark:bg-white/10 dark:text-zinc-400 dark:hover:bg-white/15"
                    }`}
                  >
                    {READING_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
