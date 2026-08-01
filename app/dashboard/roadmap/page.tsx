import { createClient } from "@/lib/supabase/server";
import { roadmap } from "@/lib/content/roadmap";
import { RoadmapChecklist } from "@/components/RoadmapChecklist";

export default async function RoadmapPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub as string;

  const { data } = await supabase
    .from("roadmap_progress")
    .select("section_id, completed")
    .eq("user_id", userId);

  const initialCompleted: Record<string, boolean> = {};
  data?.forEach((row) => {
    initialCompleted[row.section_id] = row.completed;
  });

  return (
    <RoadmapChecklist
      parts={roadmap}
      initialCompleted={initialCompleted}
      userId={userId}
    />
  );
}
