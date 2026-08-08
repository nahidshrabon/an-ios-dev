"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Quiz } from "@/lib/content/types";
import { CheckIcon, XIcon } from "@/components/Icons";
import { InlineMarkdown } from "@/components/InlineMarkdown";

interface GradedAnswer {
  questionId: string;
  selectedOptionId: string | undefined;
  correct: boolean;
}

export function QuizRunner({ quiz }: { quiz: Quiz }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    total: number;
    graded: GradedAnswer[];
  } | null>(null);
  const [supabase] = useState(() => createClient());

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
  }

  if (result) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {quiz.title}
        </h1>
        <p className="mt-4 text-lg">
          You scored{" "}
          <span className="font-heading">
            {result.score} / {result.total}
          </span>
          .
        </p>
        <div className="mt-4 flex gap-4">
          <Link href="/dashboard/quizzes" className="text-sm underline">
            Back to quizzes
          </Link>
        </div>

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
                <div className="flex items-start justify-between gap-3">
                  <p className="font-article font-medium">
                    {i + 1}. <InlineMarkdown>{question.prompt}</InlineMarkdown>
                  </p>
                  <span
                    className={`font-heading shrink-0 rounded-full px-2 py-0.5 text-xs ${
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
                </div>
                <div className="mt-3 flex flex-col gap-1.5 text-base">
                  {question.options.map((option) => {
                    const isCorrectOption =
                      option.id === question.correctOptionId;
                    const isSelected = option.id === graded.selectedOptionId;
                    return (
                      <div
                        key={option.id}
                        className={`font-article ${
                          isCorrectOption
                            ? "font-medium text-green-700 dark:text-green-400"
                            : isSelected
                              ? "text-red-700 dark:text-red-400"
                              : "text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        <InlineMarkdown>{option.text}</InlineMarkdown>
                        {isCorrectOption && (
                          <CheckIcon className="ml-1 inline size-4 align-text-bottom" />
                        )}
                        {isSelected && !isCorrectOption && (
                          <XIcon className="ml-1 inline size-4 align-text-bottom" />
                        )}
                        {isSelected && (
                          <span className="ml-1 align-text-bottom text-xs text-zinc-500 dark:text-zinc-500">
                            (your answer)
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="font-article mt-3 text-base text-zinc-600 dark:text-zinc-400">
                  <InlineMarkdown>{question.explanation}</InlineMarkdown>
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">{quiz.title}</h1>
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
