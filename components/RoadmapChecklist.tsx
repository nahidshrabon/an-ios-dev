"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  isRoadmapSectionCompleted,
  type RoadmapPart,
  type RoadmapSection,
} from "@/lib/content/roadmap";
import { ChevronDownIcon } from "@/components/Icons";

export function RoadmapChecklist({
  parts,
  manualCompleted,
  readArticleSlugs,
}: {
  parts: RoadmapPart[];
  manualCompleted: Record<string, boolean>;
  readArticleSlugs: string[];
  userId: string;
}) {
  const readSlugs = useMemo(
    () => new Set(readArticleSlugs),
    [readArticleSlugs]
  );

  function isCompleted(section: RoadmapSection): boolean {
    return isRoadmapSectionCompleted(section, manualCompleted, readSlugs);
  }

  const totalSections = useMemo(
    () => parts.reduce((sum, part) => sum + part.sections.length, 0),
    [parts]
  );
  const completedCount = useMemo(
    () =>
      parts.reduce(
        (sum, part) => sum + part.sections.filter(isCompleted).length,
        0
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parts, manualCompleted, readSlugs]
  );
  const percent =
    totalSections > 0 ? Math.round((completedCount / totalSections) * 100) : 0;

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Roadmap
      </h1>

      <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        Sections with a{" "}
        <strong className="font-medium text-foreground">Read →</strong> link
        have a published article — those check themselves automatically as
        soon as you mark that article read on its page. Sections without a
        published article yet are dimmed and can&apos;t be checked off until
        their article is ready.
      </p>

      <div className="mt-6 rounded-xl border border-black/10 p-5 dark:border-white/10">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {completedCount} / {totalSections} sections completed
          </p>
          <p className="font-heading text-2xl font-semibold">{percent}%</p>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-foreground transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-4">
        {parts.map((part) => {
          const partCompleted = part.sections.filter(isCompleted).length;
          return (
            <details
              key={part.id}
              open
              className="group rounded-xl border border-black/10 p-4 dark:border-white/10"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <span className="font-medium">{part.title}</span>
                <span className="flex items-center gap-2 text-sm text-zinc-500">
                  {partCompleted}/{part.sections.length}
                  <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" />
                </span>
              </summary>
              <ul className="mt-3 flex flex-col gap-1">
                {part.sections.map((sec) => {
                  const done = isCompleted(sec);
                  const isAuto = !!sec.articleSlug;

                  if (isAuto) {
                    return (
                      <li key={sec.id}>
                        <Link
                          href={`/articles/${sec.articleSlug}?from=roadmap`}
                          className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-black/[.03] dark:hover:bg-white/5"
                        >
                          <span className="flex flex-1 items-center gap-3 text-sm">
                            <input
                              type="checkbox"
                              checked={done}
                              disabled
                              title="Synced automatically from the article's reading status"
                              className="pointer-events-none size-4 shrink-0 accent-foreground disabled:opacity-60"
                            />
                            <span
                              className={
                                done
                                  ? "text-zinc-500 line-through dark:text-zinc-500"
                                  : ""
                              }
                            >
                              {sec.number}. {sec.title}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-zinc-500 underline">
                            Read →
                          </span>
                        </Link>
                      </li>
                    );
                  }

                  return (
                    <li
                      key={sec.id}
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 opacity-50"
                    >
                      <span className="flex flex-1 items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={done}
                          disabled
                          title="Article not available yet"
                          className="pointer-events-none size-4 shrink-0 accent-foreground disabled:opacity-60"
                        />
                        <span>
                          {sec.number}. {sec.title}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-600">
                        Not available yet
                      </span>
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </div>
    </div>
  );
}
