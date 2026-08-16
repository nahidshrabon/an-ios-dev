import { notFound } from "next/navigation";
import { getQuiz } from "@/lib/content/quizzes";
import { createClient, getClaims } from "@/lib/supabase/server";
import { QuizRunner } from "@/components/QuizRunner";

export default async function QuizPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const quiz = getQuiz(quizId);

  if (!quiz) {
    notFound();
  }

  const { data: claims } = await getClaims();
  const userId = claims?.claims.sub as string;

  const supabase = await createClient();
  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("score, total_questions, answers")
    .eq("user_id", userId)
    .eq("quiz_id", quiz.id);

  const bestScore = attempts?.reduce<{ score: number; total: number } | null>(
    (best, attempt) =>
      !best || attempt.score > best.score
        ? { score: attempt.score, total: attempt.total_questions }
        : best,
    null
  );

  // A question needs review if it's ever been missed, across every attempt
  // — not just the best-scoring one.
  const wrongQuestionIds = Array.from(
    new Set(
      (attempts ?? []).flatMap((attempt) =>
        Array.isArray(attempt.answers)
          ? attempt.answers
              .filter((g: { correct: boolean }) => !g.correct)
              .map((g: { questionId: string }) => g.questionId)
          : []
      )
    )
  );

  const bestAttempt = bestScore ? { ...bestScore, wrongQuestionIds } : null;

  return <QuizRunner quiz={quiz} bestAttempt={bestAttempt} />;
}
