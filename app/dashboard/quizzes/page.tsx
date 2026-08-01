import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAllQuizzes } from "@/lib/content/quizzes";

export default async function QuizzesPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub as string;

  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("quiz_id, score, total_questions")
    .eq("user_id", userId);

  const bestByQuiz: Record<string, { score: number; total: number }> = {};
  attempts?.forEach((a) => {
    const current = bestByQuiz[a.quiz_id];
    if (!current || a.score > current.score) {
      bestByQuiz[a.quiz_id] = { score: a.score, total: a.total_questions };
    }
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Quizzes</h1>
      <ul className="mt-6 flex flex-col gap-3">
        {getAllQuizzes().map((quiz) => {
          const best = bestByQuiz[quiz.id];
          return (
            <li
              key={quiz.id}
              className="flex items-center justify-between rounded-xl border border-black/10 p-4 dark:border-white/10"
            >
              <div>
                <Link
                  href={`/dashboard/quizzes/${quiz.id}`}
                  className="font-medium hover:underline"
                >
                  {quiz.title}
                </Link>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {quiz.description}
                </p>
              </div>
              {best && (
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  Best: {best.score}/{best.total}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
