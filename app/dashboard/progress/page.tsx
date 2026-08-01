import { createClient } from "@/lib/supabase/server";
import { getAllArticles } from "@/lib/content/articles";
import { ProgressList } from "@/components/ProgressList";
import type { ReadingStatus } from "@/lib/types";

export default async function ProgressPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub as string;

  const { data } = await supabase
    .from("reading_progress")
    .select("article_slug, status")
    .eq("user_id", userId);

  const initialProgress: Record<string, ReadingStatus> = {};
  data?.forEach((row) => {
    initialProgress[row.article_slug] = row.status as ReadingStatus;
  });

  return (
    <ProgressList
      articles={getAllArticles()}
      initialProgress={initialProgress}
      userId={userId}
    />
  );
}
