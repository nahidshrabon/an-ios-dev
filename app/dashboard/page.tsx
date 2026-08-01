import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAllArticles } from "@/lib/content/articles";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub as string;

  const [{ data: progress }, { data: attempts }] = await Promise.all([
    supabase.from("reading_progress").select("status").eq("user_id", userId),
    supabase
      .from("quiz_attempts")
      .select("score, total_questions")
      .eq("user_id", userId),
  ]);

  const totalArticles = getAllArticles().length;
  const readCount = progress?.filter((p) => p.status === "read").length ?? 0;
  const quizzesTaken = attempts?.length ?? 0;
  const avgScore =
    attempts && quizzesTaken > 0
      ? Math.round(
          (attempts.reduce((sum, a) => sum + a.score / a.total_questions, 0) /
            quizzesTaken) *
            100
        )
      : null;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-black/10 p-5 dark:border-white/10">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Articles read
          </p>
          <p className="mt-1 text-3xl font-semibold">
            {readCount}
            <span className="text-lg text-zinc-500">/{totalArticles}</span>
          </p>
          <Link
            href="/dashboard/progress"
            className="mt-3 inline-block text-sm underline"
          >
            View all articles →
          </Link>
        </div>
        <div className="rounded-xl border border-black/10 p-5 dark:border-white/10">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Quizzes taken
          </p>
          <p className="mt-1 text-3xl font-semibold">
            {quizzesTaken}
            {avgScore !== null && (
              <span className="text-lg text-zinc-500"> · {avgScore}% avg</span>
            )}
          </p>
          <Link
            href="/dashboard/quizzes"
            className="mt-3 inline-block text-sm underline"
          >
            Take a quiz →
          </Link>
        </div>
      </div>
    </div>
  );
}
