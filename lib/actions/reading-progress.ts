"use server";

import { revalidatePath } from "next/cache";
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";
import type { ReadingStatus } from "@/lib/types";

export async function updateReadingStatus(
  articleSlug: string,
  status: ReadingStatus
) {
  const { userId } = await getAuthenticatedUser();
  if (!userId) return;

  const supabase = await createClient();
  await supabase.from("reading_progress").upsert({
    user_id: userId,
    article_slug: articleSlug,
    status,
    updated_at: new Date().toISOString(),
  });

  revalidatePath("/roadmap");
}
