import { createClient, getClaims } from "@/lib/supabase/server";
import { roadmap } from "@/lib/content/roadmap";
import { RoadmapChecklist } from "@/components/RoadmapChecklist";

export default async function RoadmapPage() {
  const { data: claims } = await getClaims();
  const userId = claims?.claims.sub as string;

  const supabase = await createClient();
  const [{ data: roadmapRows }, { data: readingRows }] = await Promise.all([
    supabase
      .from("roadmap_progress")
      .select("section_id, completed")
      .eq("user_id", userId),
    supabase
      .from("reading_progress")
      .select("article_slug, status")
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

  return (
    <RoadmapChecklist
      parts={roadmap}
      manualCompleted={manualCompleted}
      readArticleSlugs={readArticleSlugs}
      userId={userId}
    />
  );
}
