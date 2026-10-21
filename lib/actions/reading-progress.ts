"use server";

import { revalidatePath } from "next/cache";
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";
import type { ReadingStatus } from "@/lib/types";

export type ReadingStatusResult = { ok: true } | { ok: false; error: string };

export async function updateReadingStatus(
  articleSlug: string,
  status: ReadingStatus
): Promise<ReadingStatusResult> {
  const { userId } = await getAuthenticatedUser();
  if (!userId) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase.from("reading_progress").upsert({
    user_id: userId,
    article_slug: articleSlug,
    status,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/roadmap");
  return { ok: true };
}
