"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  isRoadmapSectionCompleted,
  type RoadmapPart,
  type RoadmapSection,
} from "@/lib/content/roadmap";
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "@/components/Icons";
import { ProgressRing } from "@/components/ProgressRing";

const completedRoadmapEntryColor =
  "border-emerald-200/70 bg-emerald-50/80 hover:bg-emerald-100/80 dark:border-emerald-400/15 dark:bg-emerald-400/10 dark:hover:bg-emerald-400/15";
const incompleteRoadmapEntryColor =
  "border-black/10 bg-transparent hover:bg-black/[.03] dark:border-white/10 dark:hover:bg-white/5";

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

  const nextSection = useMemo(() => {
    for (const part of parts) {
      for (const sec of part.sections) {
        if (sec.articleSlug && !isCompleted(sec)) {
          return sec;
        }
      }
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, manualCompleted, readSlugs]);

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Roadmap
      </h1>

      <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        Sections with a{" "}
        <strong className="font-medium text-foreground">›</strong> link have
        a published article — those check themselves automatically as
        soon as you mark that article read on its page. Sections without a
        published article yet are dimmed and can&apos;t be checked off until
        their article is ready.
      </p>

      <div className="mt-6 flex flex-col overflow-hidden rounded-xl border border-black/10 sm:flex-row sm:items-stretch dark:border-white/10">
        <div className="flex items-center gap-3 p-4 sm:flex-1">
          <ProgressRing percent={percent} size={44} strokeWidth={4}>
            <span className="font-heading text-xs font-semibold">
              {percent}%
            </span>
          </ProgressRing>
          <div>
            <p className="font-heading text-sm text-zinc-600 dark:text-zinc-400">
              Roadmap progress
            </p>
            <p className="font-heading mt-0.5 text-xl font-semibold">
              {completedCount}
              <span className="text-sm text-zinc-500">/{totalSections}</span>
            </p>
          </div>
        </div>

        {nextSection && (
          <div className="flex items-center justify-between gap-4 border-t border-black/10 p-4 sm:flex-1 sm:border-t-0 sm:border-l dark:border-white/10">
            <div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Next up
              </p>
              <p className="font-heading mt-0.5 text-base font-semibold">
                {nextSection.number}. {nextSection.title}
              </p>
            </div>
            <Link
              href={`/articles/${nextSection.articleSlug}?from=roadmap`}
              className="font-heading inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-sm font-medium text-white"
            >
              Continue
              <ArrowRightIcon className="size-4" />
            </Link>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-4">
        {parts.map((part) => {
          const partCompleted = part.sections.filter(isCompleted).length;
          const hasAvailable = part.sections.some((s) => s.articleSlug);
          return (
            <details
              key={part.id}
              open={hasAvailable}
              className="group rounded-xl border border-black/10 p-4 dark:border-white/10"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <span className="font-heading font-medium">{part.title}</span>
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
                          className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors ${
                            done
                              ? completedRoadmapEntryColor
                              : incompleteRoadmapEntryColor
                          }`}
                        >
                          <span className="min-w-0 flex-1 text-sm">
                            <span className="font-heading block truncate">
                              {sec.number}. {sec.title}
                              {done && (
                                <CheckIcon className="ml-1 inline size-4 align-text-bottom text-emerald-700 opacity-70 dark:text-emerald-400" />
                              )}
                            </span>
                          </span>
                          <ChevronRightIcon className="size-4 shrink-0 text-zinc-500" />
                        </Link>
                      </li>
                    );
                  }

                  return (
                    <li
                      key={sec.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-transparent px-3 py-2 opacity-50 dark:border-white/10"
                    >
                      <span className="flex flex-1 items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={done}
                          disabled
                          title="Article not available yet"
                          className="pointer-events-none size-4 shrink-0 accent-foreground disabled:opacity-60"
                        />
                        <span className="font-heading">
                          {sec.number}. {sec.title}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-xs text-zinc-500 dark:bg-white/10 dark:text-zinc-400">
                        Coming soon
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
