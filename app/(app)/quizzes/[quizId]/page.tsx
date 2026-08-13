import { notFound } from "next/navigation";
import { getQuiz } from "@/lib/content/quizzes";
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

  return <QuizRunner quiz={quiz} />;
}
