import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAllArticles } from "@/lib/content/articles";
import { getAllQuizzes } from "@/lib/content/quizzes";
import {
  countCompletedRoadmapSections,
  getAllRoadmapSections,
  isRoadmapSectionCompleted,
  roadmap,
} from "@/lib/content/roadmap";
import { ProgressRing } from "@/components/ProgressRing";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub as string;

  const [{ data: progress }, { data: attempts }, { data: roadmapProgress }] =
    await Promise.all([
      supabase
        .from("reading_progress")
        .select("article_slug, status")
        .eq("user_id", userId),
      supabase
        .from("quiz_attempts")
        .select("score, total_questions")
        .eq("user_id", userId),
      supabase
        .from("roadmap_progress")
        .select("section_id, completed")
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

  const manualRoadmapCompleted: Record<string, boolean> = {};
  roadmapProgress?.forEach((row) => {
    manualRoadmapCompleted[row.section_id] = row.completed;
  });
  const readArticleSlugs = new Set(
    progress?.filter((p) => p.status === "read").map((p) => p.article_slug)
  );

  const totalRoadmapSections = getAllRoadmapSections().length;
  const roadmapCompleted = countCompletedRoadmapSections(
    manualRoadmapCompleted,
    readArticleSlugs
  );
  const roadmapPercent =
    totalRoadmapSections > 0
      ? Math.round((roadmapCompleted / totalRoadmapSections) * 100)
      : 0;

  const articlesPercent =
    totalArticles > 0 ? Math.round((readCount / totalArticles) * 100) : 0;

  const totalQuizzes = getAllQuizzes().length;
  const quizzesPercent =
    totalQuizzes > 0 ? Math.round((quizzesTaken / totalQuizzes) * 100) : 0;

  const partBreakdown = roadmap.map((part) => {
    const completed = part.sections.filter((section) =>
      isRoadmapSectionCompleted(section, manualRoadmapCompleted, readArticleSlugs)
    ).length;
    const total = part.sections.length;
    return {
      id: part.id,
      title: part.title,
      completed,
      total,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl border border-black/10 p-5 dark:border-white/10">
          <ProgressRing percent={roadmapPercent}>
            <span className="text-sm font-semibold">{roadmapPercent}%</span>
          </ProgressRing>
          <div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Roadmap progress
            </p>
            <p className="mt-1 text-xl font-semibold">
              {roadmapCompleted}
              <span className="text-sm text-zinc-500">
                /{totalRoadmapSections}
              </span>
            </p>
            <Link
              href="/dashboard/roadmap"
              className="mt-2 inline-block text-sm underline"
            >
              View roadmap →
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-black/10 p-5 dark:border-white/10">
          <ProgressRing percent={articlesPercent}>
            <span className="text-sm font-semibold">{articlesPercent}%</span>
          </ProgressRing>
          <div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Articles read
            </p>
            <p className="mt-1 text-xl font-semibold">
              {readCount}
              <span className="text-sm text-zinc-500">/{totalArticles}</span>
            </p>
            <Link
              href="/dashboard/progress"
              className="mt-2 inline-block text-sm underline"
            >
              View all articles →
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-black/10 p-5 dark:border-white/10">
          <ProgressRing percent={quizzesPercent}>
            <span className="text-sm font-semibold">{quizzesPercent}%</span>
          </ProgressRing>
          <div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Quizzes taken
            </p>
            <p className="mt-1 text-xl font-semibold">
              {quizzesTaken}
              <span className="text-sm text-zinc-500">/{totalQuizzes}</span>
              {avgScore !== null && (
                <span className="text-sm text-zinc-500"> · {avgScore}% avg</span>
              )}
            </p>
            <Link
              href="/dashboard/quizzes"
              className="mt-2 inline-block text-sm underline"
            >
              Take a quiz →
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-black/10 p-5 dark:border-white/10">
        <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Roadmap by part
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {partBreakdown.map((part) => (
            <div key={part.id}>
              <div className="flex items-center justify-between text-sm">
                <span>{part.title}</span>
                <span className="text-zinc-500">
                  {part.completed}/{part.total}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${part.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
