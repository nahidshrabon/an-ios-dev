"use server";

import { revalidatePath } from "next/cache";
import { getQuiz } from "@/lib/content/quizzes";
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";
import type { GradedAnswer } from "@/lib/content/types";

export type QuizResult = {
  score: number;
  total: number;
  graded: GradedAnswer[];
  /** Released only with the result, never with the questions. */
  answerKey: Record<string, { correctOptionId: string; explanation: string }>;
};

/**
 * Grades against the server's copy of the quiz and records the attempt.
 *
 * Previously the browser graded itself and inserted the row directly, so the
 * score was whatever the client claimed. `questionIds` is accepted because
 * practice runs cover a subset, but it is intersected with the real quiz, and
 * `total_questions` is derived from that — a short submission simply records
 * a short attempt, which the best-score logic already discounts.
 */
export async function submitQuizAttempt(
  quizId: string,
  questionIds: string[],
  answers: Record<string, string>
): Promise<QuizResult> {
  const quiz = getQuiz(quizId);
  if (!quiz) throw new Error(`Unknown quiz: ${quizId}`);

  const byId = new Map(quiz.questions.map((question) => [question.id, question]));
  const asked = questionIds.flatMap((id) => {
    const question = byId.get(id);
    return question ? [question] : [];
  });

  const graded: GradedAnswer[] = asked.map((question) => {
    const selectedOptionId = answers[question.id];
    return {
      questionId: question.id,
      selectedOptionId,
      correct: selectedOptionId === question.correctOptionId,
    };
  });

  const answerKey: QuizResult["answerKey"] = {};
  asked.forEach((question) => {
    answerKey[question.id] = {
      correctOptionId: question.correctOptionId,
      explanation: question.explanation,
    };
  });

  const score = graded.filter((answer) => answer.correct).length;

  const { userId } = await getAuthenticatedUser();
  if (userId) {
    const supabase = await createClient();
    await supabase.from("quiz_attempts").insert({
      user_id: userId,
      quiz_id: quiz.id,
      score,
      total_questions: asked.length,
      answers: graded,
    });

    revalidatePath("/quizzes");
    revalidatePath("/roadmap");
  }

  return { score, total: asked.length, graded, answerKey };
}
