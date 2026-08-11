import { createClient, getClaims } from "@/lib/supabase/server";
import { getAllArticles } from "@/lib/content/articles";
import { roadmap } from "@/lib/content/roadmap";
import { ProgressList } from "@/components/ProgressList";
import type { ReadingStatus } from "@/lib/types";

export default async function ProgressPage() {
  const { data: claims } = await getClaims();
  const userId = claims?.claims.sub as string;

  const supabase = await createClient();
  const { data } = await supabase
    .from("reading_progress")
    .select("article_slug, status")
    .eq("user_id", userId);

  const initialProgress: Record<string, ReadingStatus> = {};
  data?.forEach((row) => {
    initialProgress[row.article_slug] = row.status as ReadingStatus;
  });

  const articlesBySlug = new Map(
    getAllArticles().map((article) => [article.slug, article])
  );
  const groups = roadmap
    .map((part) => ({
      id: part.id,
      title: part.title,
      articles: part.sections
        .filter((s) => s.articleSlug)
        .map((s) => articlesBySlug.get(s.articleSlug!)!),
    }))
    .filter((g) => g.articles.length > 0);

  return (
    <ProgressList
      groups={groups}
      initialProgress={initialProgress}
      userId={userId}
    />
  );
}
