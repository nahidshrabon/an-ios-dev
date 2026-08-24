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
  BookmarkIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FlagIcon,
  InfoIcon,
} from "@/components/Icons";
import { TestIcon } from "@/components/HowItWorksIcons";
import { PageHeader } from "@/components/PageHeader";
import { ProgressRing } from "@/components/ProgressRing";

const completedRoadmapEntryColor =
  "border-emerald-200/70 bg-emerald-50/80 hover:bg-emerald-100/80 dark:border-emerald-400/15 dark:bg-emerald-400/10 dark:hover:bg-emerald-400/15";
const incompleteRoadmapEntryColor =
  "border-black/10 bg-transparent hover:bg-black/[.03] dark:border-white/10 dark:hover:bg-white/5";

export function RoadmapChecklist({
  parts,
  manualCompleted,
  readArticleSlugs,
  bookmarkCountByArticleSlug,
  bestScoreByArticleSlug,
}: {
  parts: RoadmapPart[];
  manualCompleted: Record<string, boolean>;
  readArticleSlugs: string[];
  bookmarkCountByArticleSlug: Record<string, number>;
  bestScoreByArticleSlug: Record<string, { score: number; total: number }>;
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

  const bestScores = Object.values(bestScoreByArticleSlug);
  const quizzesTaken = bestScores.length;
  const successRatePercent =
    quizzesTaken > 0
      ? Math.round(
          (bestScores.reduce((sum, b) => sum + b.score / b.total, 0) /
            quizzesTaken) *
            100
        )
      : 0;

  return (
    <div>
      <PageHeader icon={FlagIcon} title="Roadmap" />

      <div className="mt-2 flex max-w-2xl flex-col gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
        <p className="flex items-start gap-1.5">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            A section auto-checks{" "}
            <CheckIcon className="inline size-4 align-text-bottom text-emerald-700 dark:text-emerald-400" />{" "}
            once you mark its article as{" "}
            <span className="font-heading font-medium text-emerald-700 dark:text-emerald-400">
              Read
            </span>
            .
          </span>
        </p>
        <p className="flex items-start gap-1.5">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          Quiz success rate is your average score across every quiz
          you&apos;ve taken.
        </p>
        <p className="flex items-start gap-1.5">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            The score badge{" "}
            <TestIcon className="inline size-4 align-text-bottom text-accent" />{" "}
            next to a section shows your best result on that article&apos;s
            quiz.
          </span>
        </p>
        <p className="flex items-start gap-1.5">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            The bookmark badge{" "}
            <BookmarkIcon
              className="inline size-4 align-text-bottom text-accent"
              filled
            />{" "}
            shows how many headings you&apos;ve saved in that article.
          </span>
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <div className="flex items-center gap-3 rounded-xl border border-blue-200/70 bg-blue-50/80 p-4 sm:flex-1 dark:border-blue-400/15 dark:bg-blue-400/10">
          <ProgressRing percent={percent} size={44} strokeWidth={4}>
            <span className="font-heading text-xs font-semibold">
              {percent}%
            </span>
          </ProgressRing>
          <div>
            <p className="font-heading text-sm text-blue-700 dark:text-blue-400">
              Roadmap progress
            </p>
            <p className="font-heading mt-0.5 text-xl font-semibold text-blue-700 dark:text-blue-400">
              {completedCount}
              <span className="text-sm text-blue-600/80 dark:text-blue-400/80">
                /{totalSections}
              </span>
            </p>
          </div>
        </div>

        {quizzesTaken > 0 && (
          <div className="flex flex-col justify-center rounded-xl border border-emerald-200/70 bg-emerald-50/80 p-4 sm:flex-1 dark:border-emerald-400/15 dark:bg-emerald-400/10">
            <p className="font-heading text-sm text-emerald-700 dark:text-emerald-400">
              Quiz success rate
            </p>
            <p className="font-heading mt-0.5 text-xl font-semibold text-emerald-700 dark:text-emerald-400">
              {successRatePercent}%
            </p>
          </div>
        )}

        {nextSection && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-blue-200/70 bg-blue-50/80 p-4 sm:flex-1 dark:border-blue-400/15 dark:bg-blue-400/10">
            <div className="min-w-0">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                Next up
              </p>
              <p className="font-heading mt-0.5 truncate text-base font-semibold text-blue-700 dark:text-blue-400">
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
                    const bookmarkCount =
                      bookmarkCountByArticleSlug[sec.articleSlug!] ?? 0;
                    const best = bestScoreByArticleSlug[sec.articleSlug!];
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
                          <span className="inline-flex shrink-0 items-center gap-3 text-xs text-zinc-500">
                            {best && (
                              <span className="inline-flex items-center gap-1 font-medium text-accent">
                                <TestIcon className="size-3.5" />
                                {best.score}/{best.total}
                              </span>
                            )}
                            {bookmarkCount > 0 && (
                              <span className="inline-flex items-center gap-1 font-medium text-accent">
                                <BookmarkIcon className="size-3.5" filled />
                                {bookmarkCount}
                              </span>
                            )}
                            <ChevronRightIcon className="size-4 shrink-0 text-zinc-500" />
                          </span>
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
