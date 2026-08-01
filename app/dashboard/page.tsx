import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAllArticles } from "@/lib/content/articles";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub as string;

  const { data: progress } = await supabase
    .from("reading_progress")
    .select("status")
    .eq("user_id", userId);

  const total = getAllArticles().length;
  const readCount = progress?.filter((p) => p.status === "read").length ?? 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Your progress
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        {readCount} of {total} article{total === 1 ? "" : "s"} read.
      </p>
      <Link
        href="/dashboard/progress"
        className="mt-4 inline-block text-sm underline"
      >
        View all articles →
      </Link>
    </div>
  );
}
