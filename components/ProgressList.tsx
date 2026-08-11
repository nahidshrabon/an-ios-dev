"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Article } from "@/lib/content/types";
import { ProgressRing } from "@/components/ProgressRing";
import {
  READING_STATUSES,
  READING_STATUS_LABELS,
  type ReadingStatus,
} from "@/lib/types";

const STATUS_ACTIVE_CLASSES: Record<ReadingStatus, string> = {
  unread: "bg-black/5 text-zinc-600 dark:bg-white/10 dark:text-zinc-400",
  in_progress: "bg-accent/10 text-accent",
  read: "bg-green-700/10 text-green-700 dark:text-green-400",
};

const STATUS_CELL_CLASSES: Record<ReadingStatus, string> = {
  unread: "border-black/10 dark:border-white/10",
  in_progress: "border-accent/20 bg-accent/5",
  read: "border-green-700/20 bg-green-700/5",
};

export function ProgressList({
  groups,
  initialProgress,
  userId,
}: {
  groups: { id: string; title: string; articles: Article[] }[];
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

  const totalArticles = groups.reduce((sum, g) => sum + g.articles.length, 0);
  const readCount = groups.reduce(
    (sum, g) =>
      sum + g.articles.filter((a) => progress[a.slug] === "read").length,
    0
  );
  const percent =
    totalArticles > 0 ? Math.round((readCount / totalArticles) * 100) : 0;

  return (
    <div>
      <div className="flex items-center gap-4 rounded-xl border border-black/10 p-5 dark:border-white/10">
        <ProgressRing percent={percent}>
          <span className="font-heading text-sm font-semibold">
            {percent}%
          </span>
        </ProgressRing>
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            All articles
          </h1>
          <p className="font-article mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {readCount}/{totalArticles} read
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-8">
        {groups.map((group) => {
          const groupRead = group.articles.filter(
            (a) => progress[a.slug] === "read"
          ).length;
          return (
            <div key={group.id}>
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-sm font-semibold tracking-wide text-zinc-500 uppercase">
                  {group.title}
                </h2>
                <span className="text-sm text-zinc-500">
                  {groupRead}/{group.articles.length} read
                </span>
              </div>
              <ul className="mt-3 flex flex-col gap-3">
                {group.articles.map((article) => {
                  const status = progress[article.slug] ?? "unread";
                  return (
                    <li
                      key={article.slug}
                      className={`flex flex-col gap-3 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${STATUS_CELL_CLASSES[status]}`}
                    >
                      <Link
                        href={`/articles/${article.slug}`}
                        className="font-heading font-medium hover:underline"
                      >
                        {article.title}
                      </Link>
                      <div className="flex gap-1">
                        {READING_STATUSES.map((s) => (
                          <button
                            key={s}
                            onClick={() =>
                              setStatus(
                                article.slug,
                                status === s ? "unread" : s
                              )
                            }
                            className={`font-heading rounded-full px-3 py-1 text-xs transition-colors ${
                              status === s
                                ? STATUS_ACTIVE_CLASSES[s]
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
        })}
      </div>
    </div>
  );
}
