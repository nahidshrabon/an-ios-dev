import { createClient } from "@/lib/supabase/server";
import { getQuiz } from "@/lib/content/quizzes";

export default async function QuizHistoryPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub as string;

  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("id, quiz_id, score, total_questions, completed_at")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false });

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Quiz history
      </h1>
      {!attempts || attempts.length === 0 ? (
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          No attempts yet.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {attempts.map((attempt) => {
            const quiz = getQuiz(attempt.quiz_id);
            return (
              <li
                key={attempt.id}
                className="flex items-center justify-between rounded-xl border border-black/10 p-4 dark:border-white/10"
              >
                <div>
                  <p className="font-medium">
                    {quiz?.title ?? attempt.quiz_id}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {new Date(attempt.completed_at).toLocaleString()}
                  </p>
                </div>
                <span className="text-sm font-medium">
                  {attempt.score}/{attempt.total_questions}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
