"use server";

import { revalidatePath } from "next/cache";
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";

export type BookmarkResult = { ok: true } | { ok: false; error: string };

// Postgres unique_violation: the bookmark already exists (added from another
// tab after this page loaded), which is the state the reader asked for.
const ALREADY_EXISTS = "23505";

export async function addBookmark(
  articleSlug: string,
  headingSlug: string,
  headingTitle: string
): Promise<BookmarkResult> {
  const { userId } = await getAuthenticatedUser();
  if (!userId) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase.from("bookmarks").insert({
    user_id: userId,
    article_slug: articleSlug,
    heading_slug: headingSlug,
    heading_title: headingTitle,
  });
  if (error && error.code !== ALREADY_EXISTS) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/bookmarks");
  revalidatePath("/roadmap");
  return { ok: true };
}

export async function removeBookmark(
  articleSlug: string,
  headingSlug: string
): Promise<BookmarkResult> {
  const { userId } = await getAuthenticatedUser();
  if (!userId) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .eq("user_id", userId)
    .eq("article_slug", articleSlug)
    .eq("heading_slug", headingSlug);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/bookmarks");
  revalidatePath("/roadmap");
  return { ok: true };
}
