import { createClient, getClaims } from "@/lib/supabase/server";
import { roadmap } from "@/lib/content/roadmap";
import { getAllQuizzes } from "@/lib/content/quizzes";
import { RoadmapChecklist } from "@/components/RoadmapChecklist";

export default async function RoadmapPage() {
  const { data: claims } = await getClaims();
  const userId = claims?.claims.sub as string;

  const supabase = await createClient();
  const [
    { data: roadmapRows },
    { data: readingRows },
    { data: bookmarkRows },
    { data: attemptRows },
  ] = await Promise.all([
    supabase
      .from("roadmap_progress")
      .select("section_id, completed")
      .eq("user_id", userId),
    supabase
      .from("reading_progress")
      .select("article_slug, status")
      .eq("user_id", userId),
    supabase.from("bookmarks").select("article_slug").eq("user_id", userId),
    supabase
      .from("quiz_attempts")
      .select("quiz_id, score, total_questions")
      .eq("user_id", userId),
  ]);

  const manualCompleted: Record<string, boolean> = {};
  roadmapRows?.forEach((row) => {
    manualCompleted[row.section_id] = row.completed;
  });

  const readArticleSlugs =
    readingRows
      ?.filter((row) => row.status === "read")
      .map((row) => row.article_slug) ?? [];

  const bookmarkCountByArticleSlug: Record<string, number> = {};
  bookmarkRows?.forEach((row) => {
    bookmarkCountByArticleSlug[row.article_slug] =
      (bookmarkCountByArticleSlug[row.article_slug] ?? 0) + 1;
  });

  const allQuizzes = getAllQuizzes();
  const articleSlugByQuizId = new Map(
    allQuizzes
      .filter((quiz) => quiz.relatedArticleSlug)
      .map((quiz) => [quiz.id, quiz.relatedArticleSlug!])
  );
  const totalQuestionsByQuizId = new Map(
    allQuizzes.map((quiz) => [quiz.id, quiz.questions.length])
  );

  const bestScoreByArticleSlug: Record<
    string,
    { score: number; total: number }
  > = {};
  attemptRows?.forEach((row) => {
    // Only full attempts count toward Best — review runs cover fewer
    // questions, so their raw score isn't comparable.
    const isFullAttempt =
      row.total_questions === totalQuestionsByQuizId.get(row.quiz_id);
    if (!isFullAttempt) return;

    const articleSlug = articleSlugByQuizId.get(row.quiz_id);
    if (!articleSlug) return;

    const current = bestScoreByArticleSlug[articleSlug];
    if (!current || row.score > current.score) {
      bestScoreByArticleSlug[articleSlug] = {
        score: row.score,
        total: row.total_questions,
      };
    }
  });

  return (
    <RoadmapChecklist
      parts={roadmap}
      manualCompleted={manualCompleted}
      readArticleSlugs={readArticleSlugs}
      bookmarkCountByArticleSlug={bookmarkCountByArticleSlug}
      bestScoreByArticleSlug={bestScoreByArticleSlug}
      userId={userId}
    />
  );
}
