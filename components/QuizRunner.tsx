"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Quiz } from "@/lib/content/types";

export function QuizRunner({ quiz }: { quiz: Quiz }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number } | null>(
    null
  );
  const [supabase] = useState(() => createClient());

  const allAnswered = quiz.questions.every((q) => answers[q.id]);

  async function handleSubmit() {
    setSubmitting(true);

    const gradedAnswers = quiz.questions.map((q) => {
      const selectedOptionId = answers[q.id];
      return {
        questionId: q.id,
        selectedOptionId,
        correct: selectedOptionId === q.correctOptionId,
      };
    });
    const score = gradedAnswers.filter((a) => a.correct).length;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase.from("quiz_attempts").insert({
        user_id: user.id,
        quiz_id: quiz.id,
        score,
        total_questions: quiz.questions.length,
        answers: gradedAnswers,
      });
    }

    setResult({ score, total: quiz.questions.length });
    setSubmitting(false);
  }

  if (result) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {quiz.title}
        </h1>
        <p className="mt-4 text-lg">
          You scored {result.score} / {result.total}.
        </p>
        <div className="mt-6 flex gap-4">
          <Link href="/dashboard/quizzes" className="text-sm underline">
            Back to quizzes
          </Link>
          <Link
            href="/dashboard/quizzes/history"
            className="text-sm underline"
          >
            View history
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{quiz.title}</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        {quiz.description}
      </p>

      <div className="mt-8 flex flex-col gap-8">
        {quiz.questions.map((question, i) => (
          <div key={question.id}>
            <p className="font-medium">
              {i + 1}. {question.prompt}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {question.options.map((option) => (
                <label
                  key={option.id}
                  className="flex items-center gap-2 text-sm"
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
                  {option.text}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!allAnswered || submitting}
        className="mt-8 h-11 rounded-full bg-foreground px-6 text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
      >
        {submitting ? "Submitting…" : "Submit"}
      </button>
    </div>
  );
}
