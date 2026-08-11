import Link from "next/link";
import { createClient, getClaims } from "@/lib/supabase/server";
import { getAllQuizzes } from "@/lib/content/quizzes";
import { TrophyIcon } from "@/components/Icons";

export default async function QuizzesPage() {
  const { data: claims } = await getClaims();
  const userId = claims?.claims.sub as string;

  const supabase = await createClient();
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
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Quizzes</h1>
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
                  className="font-heading font-medium hover:underline"
                >
                  {quiz.title}
                </Link>
                <p className="font-article mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {quiz.description}
                </p>
              </div>
              {best && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
                  <TrophyIcon className="size-4" />
                  Best:{" "}
                  <span className="font-heading">
                    {best.score}/{best.total}
                  </span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
