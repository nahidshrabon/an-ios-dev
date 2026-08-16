import { createClient, getClaims } from "@/lib/supabase/server";
import { roadmap } from "@/lib/content/roadmap";
import { RoadmapChecklist } from "@/components/RoadmapChecklist";

export default async function RoadmapPage() {
  const { data: claims } = await getClaims();
  const userId = claims?.claims.sub as string;

  const supabase = await createClient();
  const [{ data: roadmapRows }, { data: readingRows }, { data: bookmarkRows }] =
    await Promise.all([
      supabase
        .from("roadmap_progress")
        .select("section_id, completed")
        .eq("user_id", userId),
      supabase
        .from("reading_progress")
        .select("article_slug, status")
        .eq("user_id", userId),
      supabase.from("bookmarks").select("article_slug").eq("user_id", userId),
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

  return (
    <RoadmapChecklist
      parts={roadmap}
      manualCompleted={manualCompleted}
      readArticleSlugs={readArticleSlugs}
      bookmarkCountByArticleSlug={bookmarkCountByArticleSlug}
      userId={userId}
    />
  );
}
