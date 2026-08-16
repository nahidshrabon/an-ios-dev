"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Quiz } from "@/lib/content/types";
import {
  ChevronLeftIcon,
  CheckIcon,
  FlagIcon,
  InfoIcon,
  RotateCcwIcon,
  TrophyIcon,
  XIcon,
} from "@/components/Icons";
import { InlineMarkdown } from "@/components/InlineMarkdown";

interface GradedAnswer {
  questionId: string;
  selectedOptionId: string | undefined;
  correct: boolean;
}

function ResetQuizButton({ onReset }: { onReset: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <button
          onClick={() => {
            onReset();
            setConfirming(false);
          }}
          className="font-heading inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-sm font-medium text-white transition-colors hover:bg-red-700"
        >
          Confirm reset
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="font-heading text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="font-heading inline-flex items-center gap-1 rounded-full border border-red-300 px-2.5 py-1 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-400/30 dark:text-red-400 dark:hover:bg-red-400/10"
    >
      <RotateCcwIcon className="size-3.5" />
      Reset
    </button>
  );
}

export function QuizRunner({
  quiz,
  bestScore,
}: {
  quiz: Quiz;
  bestScore?: { score: number; total: number } | null;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    total: number;
    graded: GradedAnswer[];
  } | null>(null);
  const [supabase] = useState(() => createClient());

  function handleReset() {
    setAnswers({});
    setResult(null);
  }

  async function handleSubmit() {
    setSubmitting(true);

    const graded: GradedAnswer[] = quiz.questions.map((q) => {
      const selectedOptionId = answers[q.id];
      return {
        questionId: q.id,
        selectedOptionId,
        correct: selectedOptionId === q.correctOptionId,
      };
    });
    const score = graded.filter((a) => a.correct).length;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase.from("quiz_attempts").insert({
        user_id: user.id,
        quiz_id: quiz.id,
        score,
        total_questions: quiz.questions.length,
        answers: graded,
      });
    }

    setResult({ score, total: quiz.questions.length, graded });
    setSubmitting(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (result) {
    return (
      <div>
        <Link
          href="/quizzes"
          className="inline-flex items-center gap-1.5 text-base font-medium text-zinc-600 hover:text-foreground dark:text-zinc-400"
        >
          <ChevronLeftIcon className="size-4" />
          Back to quizzes
        </Link>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {quiz.title}{" "}
            <span className="font-heading inline-block rounded-full bg-accent/10 px-2.5 py-1 align-middle text-sm font-medium text-accent">
              {result.score}/{result.total}
            </span>
          </h1>

          <div className="flex flex-wrap items-center gap-2">
            {bestScore && (
              <span className="font-heading inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-sm font-medium text-accent">
                <TrophyIcon className="size-3.5" />
                Best {bestScore.score}/{bestScore.total}
              </span>
            )}
            {!quiz.reviewed && (
              <span className="font-heading inline-flex items-center gap-1 rounded-full border border-amber-300/60 bg-amber-50/80 px-2.5 py-1 text-sm font-medium text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-400">
                <FlagIcon className="size-3.5" />
                Needs review
              </span>
            )}
            <ResetQuizButton onReset={handleReset} />
          </div>
        </div>

        <p className="font-article mt-2 text-zinc-600 dark:text-zinc-400">
          {quiz.description}
        </p>

        <div className="mt-8 flex flex-col gap-6">
          {quiz.questions.map((question, i) => {
            const graded = result.graded.find(
              (g) => g.questionId === question.id
            )!;
            const wasAnswered = graded.selectedOptionId != null;
            return (
              <div
                key={question.id}
                className="rounded-xl border border-black/10 p-4 dark:border-white/10"
              >
                <p className="font-article font-medium">
                  {i + 1}. <InlineMarkdown>{question.prompt}</InlineMarkdown>{" "}
                  <span
                    className={`font-heading inline-block rounded-full px-2.5 py-1 align-middle text-sm ${
                      !wasAnswered
                        ? "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"
                        : graded.correct
                          ? "bg-green-700/10 text-green-700 dark:text-green-400"
                          : "bg-red-700/10 text-red-700 dark:text-red-400"
                    }`}
                  >
                    {!wasAnswered
                      ? "Not answered"
                      : graded.correct
                        ? "Correct"
                        : "Incorrect"}
                  </span>
                </p>
                <ul className="mt-3 flex flex-col gap-1.5 text-base">
                  {question.options.map((option) => {
                    const isCorrectOption =
                      option.id === question.correctOptionId;
                    const isSelected = option.id === graded.selectedOptionId;
                    return (
                      <li
                        key={option.id}
                        className="font-article flex items-baseline gap-2"
                      >
                        <span
                          className="size-1.5 shrink-0 self-center rounded-full bg-current opacity-60"
                          aria-hidden="true"
                        />
                        <span
                          className={
                            isCorrectOption
                              ? "rounded bg-green-700/10 px-2 py-0.5 font-medium text-green-700 dark:text-green-400"
                              : isSelected
                                ? "text-red-700 dark:text-red-400"
                                : "text-zinc-600 dark:text-zinc-400"
                          }
                        >
                          <InlineMarkdown>{option.text}</InlineMarkdown>
                          {isCorrectOption && (
                            <CheckIcon className="ml-1 inline size-4 align-text-bottom" />
                          )}
                          {isSelected && !isCorrectOption && (
                            <XIcon className="ml-1 inline size-4 align-text-bottom" />
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-3 flex gap-2 rounded-lg border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]">
                  <InfoIcon className="mt-0.5 size-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
                  <div>
                    <p className="font-article text-base text-zinc-600 dark:text-zinc-400">
                      <InlineMarkdown>{question.explanation}</InlineMarkdown>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/quizzes"
        className="inline-flex items-center gap-1.5 text-base font-medium text-zinc-600 hover:text-foreground dark:text-zinc-400"
      >
        <ChevronLeftIcon className="size-4" />
        Back to quizzes
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{quiz.title}</h1>

        <div className="flex flex-wrap items-center gap-2">
          {bestScore && (
            <span className="font-heading inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-sm font-medium text-accent">
              <TrophyIcon className="size-3.5" />
              Best {bestScore.score}/{bestScore.total}
            </span>
          )}
          {!quiz.reviewed && (
            <span className="font-heading inline-flex items-center gap-1 rounded-full border border-amber-300/60 bg-amber-50/80 px-2.5 py-1 text-sm font-medium text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-400">
              <FlagIcon className="size-3.5" />
              Needs review
            </span>
          )}
          <ResetQuizButton onReset={handleReset} />
        </div>
      </div>

      <p className="font-article mt-2 text-zinc-600 dark:text-zinc-400">
        {quiz.description}
      </p>

      <div className="mt-8 flex flex-col gap-8">
        {quiz.questions.map((question, i) => (
          <div key={question.id}>
            <p className="font-article font-medium">
              {i + 1}. <InlineMarkdown>{question.prompt}</InlineMarkdown>
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {question.options.map((option) => (
                <label
                  key={option.id}
                  className="font-article flex items-center gap-2 text-base"
                >
                  <input
                    type="radio"
                    name={question.id}
                    checked={answers[question.id] === option.id}
                    onChange={() =>
                      setAnswers((prev) => ({
                        ...prev,
                        [question.id]: option.id,
                      }))
                    }
                  />
                  <span>
                    <InlineMarkdown>{option.text}</InlineMarkdown>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="font-heading mt-8 h-11 rounded-full bg-foreground px-6 text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
      >
        {submitting ? "Submitting…" : "Submit"}
      </button>
    </div>
  );
}
