import { notFound } from "next/navigation";
import { getQuiz } from "@/lib/content/quizzes";
import type { GradedAnswer } from "@/lib/content/types";
import { createClient, getClaims } from "@/lib/supabase/server";
import { QuizRunner } from "@/components/QuizRunner";

type Props = {
  params: Promise<{ quizId: string }>;
  searchParams: Promise<{ practice?: string }>;
};

export default async function QuizPage({ params, searchParams }: Props) {
  const { quizId } = await params;
  const { practice } = await searchParams;
  const quiz = getQuiz(quizId);

  if (!quiz) {
    notFound();
  }

  let activeQuiz = quiz;
  let previousAnswers: Record<string, GradedAnswer> | undefined;

  if (practice === "1") {
    const { data: claims } = await getClaims();
    const userId = claims?.claims.sub as string | undefined;

    if (userId) {
      const supabase = await createClient();
      const { data: lastAttempt } = await supabase
        .from("quiz_attempts")
        .select("answers")
        .eq("user_id", userId)
        .eq("quiz_id", quiz.id)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const missed: Record<string, GradedAnswer> = {};
      ((lastAttempt?.answers as GradedAnswer[] | null) ?? []).forEach((a) => {
        if (!a.correct) missed[a.questionId] = a;
      });
      const missedQuestions = quiz.questions.filter((q) => missed[q.id]);

      if (missedQuestions.length > 0) {
        activeQuiz = {
          ...quiz,
          questions: missedQuestions,
          description: `Practicing the ${missedQuestions.length} question${
            missedQuestions.length === 1 ? "" : "s"
          } you missed last time.`,
        };
        previousAnswers = missed;
      }
    }
  }

  return <QuizRunner quiz={activeQuiz} previousAnswers={previousAnswers} />;
}
