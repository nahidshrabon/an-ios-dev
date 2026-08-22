import Link from "next/link";
import { createClient, getClaims } from "@/lib/supabase/server";
import { getAllQuizzes } from "@/lib/content/quizzes";
import type { GradedAnswer } from "@/lib/content/types";
import { roadmap } from "@/lib/content/roadmap";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  InfoIcon,
} from "@/components/Icons";
import { TestIcon } from "@/components/HowItWorksIcons";
import { PageHeader } from "@/components/PageHeader";
import { ProgressRing } from "@/components/ProgressRing";

const takenQuizEntryColor =
  "border-emerald-200/70 bg-emerald-50/80 hover:bg-emerald-100/80 dark:border-emerald-400/15 dark:bg-emerald-400/10 dark:hover:bg-emerald-400/15";
const notTakenQuizEntryColor =
  "border-black/10 bg-transparent hover:bg-black/[.03] dark:border-white/10 dark:hover:bg-white/5";

export default async function QuizzesPage() {
  const { data: claims } = await getClaims();
  const userId = claims?.claims.sub as string;

  const allQuizzes = getAllQuizzes();
  const totalQuestionsByQuizId = new Map(
    allQuizzes.map((quiz) => [quiz.id, quiz.questions.length])
  );

  const supabase = await createClient();
  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("quiz_id, score, total_questions, answers, completed_at")
    .eq("user_id", userId);

  const bestByQuiz: Record<string, { score: number; total: number }> = {};
  const needsReviewByQuiz: Record<string, number> = {};
  const lastAttemptTimeByQuiz: Record<string, string> = {};
  attempts?.forEach((a) => {
    // Only full attempts count toward Best — review runs cover fewer
    // questions, so their raw score isn't comparable.
    const isFullAttempt =
      a.total_questions === totalQuestionsByQuizId.get(a.quiz_id);
    if (isFullAttempt) {
      const current = bestByQuiz[a.quiz_id];
      if (!current || a.score > current.score) {
        bestByQuiz[a.quiz_id] = { score: a.score, total: a.total_questions };
      }
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
    allQuizzes
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
  const takenSections = allQuizSections.filter(
    (section) => bestByQuiz[section.quiz!.id]
  );
  const takenCount = takenSections.length;
  const percent =
    totalQuizzes > 0 ? Math.round((takenCount / totalQuizzes) * 100) : 0;

  const successRatePercent =
    takenCount > 0
      ? Math.round(
          (takenSections.reduce((sum, section) => {
            const b = bestByQuiz[section.quiz!.id];
            return sum + b.score / b.total;
          }, 0) /
            takenCount) *
            100
        )
      : 0;

  const reviewPercent =
    takenCount > 0
      ? Math.round(
          (takenSections.reduce((sum, section) => {
            const quizId = section.quiz!.id;
            const missed = needsReviewByQuiz[quizId] ?? 0;
            const total = totalQuestionsByQuizId.get(quizId) ?? 1;
            return sum + missed / total;
          }, 0) /
            takenCount) *
            100
        )
      : 0;

  return (
    <div>
      <PageHeader icon={TestIcon} title="Quizzes" />

      <div className="mt-2 flex flex-col gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
        <p>
          <InfoIcon className="mr-1 inline size-4 align-text-bottom text-zinc-500 dark:text-zinc-400" />
          <span className="font-heading font-medium text-foreground">
            Full quiz
          </span>{" "}
          — click a quiz row to take or retake every question.{" "}
          <span className="text-emerald-700 dark:text-emerald-400">
            Updates your{" "}
            <span className="font-heading font-medium text-accent">Best</span>{" "}
            score.
          </span>
        </p>
        <p>
          <InfoIcon className="mr-1 inline size-4 align-text-bottom text-red-700 dark:text-red-400" />
          <span className="font-heading font-medium text-red-700 dark:text-red-400">
            Review
          </span>{" "}
          <span className="text-zinc-600 dark:text-zinc-400">— click </span>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-400">
            Review
          </span>{" "}
          <span className="text-zinc-600 dark:text-zinc-400">
            to retake just the questions you missed last time.
          </span>{" "}
          <span className="text-red-700 dark:text-red-400">
            Doesn&apos;t update your{" "}
            <span className="font-heading font-medium">Best</span> score.
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
              Quiz progress
            </p>
            <p className="font-heading mt-0.5 text-xl font-semibold text-blue-700 dark:text-blue-400">
              {takenCount}
              <span className="text-sm text-blue-500/80">/{totalQuizzes}</span>
            </p>
          </div>
        </div>

        <div className="flex items-stretch overflow-hidden rounded-xl border border-black/10 sm:flex-1 dark:border-white/10">
          <div className="flex flex-1 flex-col justify-center bg-emerald-50/80 p-4 dark:bg-emerald-400/10">
            <p className="font-heading text-sm text-emerald-700 dark:text-emerald-400">
              Success rate
            </p>
            <p className="font-heading mt-0.5 text-xl font-semibold text-emerald-700 dark:text-emerald-400">
              {successRatePercent}%
            </p>
          </div>
          <div className="flex flex-1 flex-col justify-center bg-red-50/80 p-4 dark:bg-red-400/10">
            <p className="font-heading text-sm text-red-700 dark:text-red-400">
              Needs review
            </p>
            <p className="font-heading mt-0.5 text-xl font-semibold text-red-700 dark:text-red-400">
              {reviewPercent}%
            </p>
          </div>
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
                          </span>
                          {best && (
                            <span className="font-heading shrink-0 text-xs font-medium text-accent">
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
                        <ChevronRightIcon className="size-4 shrink-0 text-zinc-500" />
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
