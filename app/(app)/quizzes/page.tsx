import Link from "next/link";
import { createClient, getClaims } from "@/lib/supabase/server";
import { getAllQuizzes } from "@/lib/content/quizzes";
import type { GradedAnswer } from "@/lib/content/types";
import { roadmap } from "@/lib/content/roadmap";
import { CheckIcon, ChevronDownIcon } from "@/components/Icons";
import { ProgressRing } from "@/components/ProgressRing";

const takenQuizEntryColor =
  "border-emerald-200/70 bg-emerald-50/80 hover:bg-emerald-100/80 dark:border-emerald-400/15 dark:bg-emerald-400/10 dark:hover:bg-emerald-400/15";
const notTakenQuizEntryColor =
  "border-black/10 bg-transparent hover:bg-black/[.03] dark:border-white/10 dark:hover:bg-white/5";

export default async function QuizzesPage() {
  const { data: claims } = await getClaims();
  const userId = claims?.claims.sub as string;

  const supabase = await createClient();
  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("quiz_id, score, total_questions, answers, completed_at")
    .eq("user_id", userId);

  const bestByQuiz: Record<string, { score: number; total: number }> = {};
  const needsReviewByQuiz: Record<string, number> = {};
  const lastAttemptTimeByQuiz: Record<string, string> = {};
  attempts?.forEach((a) => {
    const current = bestByQuiz[a.quiz_id];
    if (!current || a.score > current.score) {
      bestByQuiz[a.quiz_id] = { score: a.score, total: a.total_questions };
    }

    const lastTime = lastAttemptTimeByQuiz[a.quiz_id];
    if (!lastTime || a.completed_at > lastTime) {
      lastAttemptTimeByQuiz[a.quiz_id] = a.completed_at;
      const missedCount = (a.answers as GradedAnswer[]).filter(
        (g) => !g.correct
      ).length;
      needsReviewByQuiz[a.quiz_id] = missedCount;
    }
  });

  const quizzesBySlug = new Map(
    getAllQuizzes()
      .filter((quiz) => quiz.relatedArticleSlug)
      .map((quiz) => [quiz.relatedArticleSlug, quiz])
  );
  const quizParts = roadmap
    .map((part) => ({
      ...part,
      sections: part.sections
        .map((section) => ({
          ...section,
          quiz: section.articleSlug
            ? quizzesBySlug.get(section.articleSlug)
            : undefined,
        }))
        .filter((section) => section.quiz),
    }))
    .filter((part) => part.sections.length > 0);

  const allQuizSections = quizParts.flatMap((part) => part.sections);
  const totalQuizzes = allQuizSections.length;
  const takenCount = allQuizSections.filter(
    (section) => bestByQuiz[section.quiz!.id]
  ).length;
  const percent =
    totalQuizzes > 0 ? Math.round((takenCount / totalQuizzes) * 100) : 0;

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Quizzes
      </h1>

      <div className="mt-6 flex flex-col overflow-hidden rounded-xl border border-black/10 sm:flex-row sm:items-stretch dark:border-white/10">
        <div className="flex items-center gap-3 p-4 sm:flex-1">
          <ProgressRing percent={percent} size={44} strokeWidth={4}>
            <span className="font-heading text-xs font-semibold">
              {percent}%
            </span>
          </ProgressRing>
          <div>
            <p className="font-heading text-sm text-zinc-600 dark:text-zinc-400">
              Quiz progress
            </p>
            <p className="font-heading mt-0.5 text-xl font-semibold">
              {takenCount}
              <span className="text-sm text-zinc-500">/{totalQuizzes}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-1.5 border-t border-black/10 p-4 text-sm text-zinc-600 sm:flex-1 sm:border-t-0 sm:border-l dark:border-white/10 dark:text-zinc-400">
          <p>
            <span className="font-heading font-medium text-foreground">
              Full quiz
            </span>{" "}
            — click a quiz to take or retake every question.
          </p>
          <p>
            <span className="font-heading font-medium text-foreground">
              Review quiz
            </span>{" "}
            — click{" "}
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-400">
              Review
            </span>{" "}
            to practice just what you missed last time.
          </p>
          <p>
            <span className="font-heading font-medium text-foreground">
              Best
            </span>{" "}
            — your highest score on any attempt, full or review. Review
            runs have fewer questions, so acing one won&apos;t always beat a
            strong full-quiz score.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {quizParts.map((part) => {
          return (
            <details
              key={part.id}
              open
              className="group rounded-xl border border-black/10 p-4 dark:border-white/10"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <span className="font-heading font-medium">{part.title}</span>
                <span className="flex items-center gap-2 text-sm text-zinc-500">
                  {part.sections.length}
                  <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" />
                </span>
              </summary>
              <ul className="mt-3 flex flex-col gap-1">
                {part.sections.map((section) => {
                  const quiz = section.quiz!;
                  const best = bestByQuiz[quiz.id];
                  const needsReview = needsReviewByQuiz[quiz.id];
                  return (
                    <li key={quiz.id}>
                      <div
                        className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors ${
                          best ? takenQuizEntryColor : notTakenQuizEntryColor
                        }`}
                      >
                        <Link
                          href={`/quizzes/${quiz.id}`}
                          className="flex min-w-0 flex-1 items-center gap-3"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="font-heading block truncate text-sm">
                              {section.number}. {section.title}
                              {best && (
                                <CheckIcon className="ml-1 inline size-4 align-text-bottom text-emerald-700 opacity-70 dark:text-emerald-400" />
                              )}
                            </span>
                            <span className="font-article mt-0.5 block text-sm text-zinc-600 dark:text-zinc-400">
                              {quiz.description}
                            </span>
                          </span>
                          {best && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                              Best {best.score}/{best.total}
                            </span>
                          )}
                        </Link>
                        {!!needsReview && (
                          <Link
                            href={`/quizzes/${quiz.id}?practice=1`}
                            className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/20 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-400"
                          >
                            Review {needsReview}
                          </Link>
                        )}
                      </div>
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
