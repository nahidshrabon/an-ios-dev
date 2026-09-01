"use server";

import { revalidatePath } from "next/cache";
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";

export async function addBookmark(
  articleSlug: string,
  headingSlug: string,
  headingTitle: string
) {
  const { userId } = await getAuthenticatedUser();
  if (!userId) return;

  const supabase = await createClient();
  await supabase.from("bookmarks").insert({
    user_id: userId,
    article_slug: articleSlug,
    heading_slug: headingSlug,
    heading_title: headingTitle,
  });

  revalidatePath("/bookmarks");
  revalidatePath("/roadmap");
}

export async function removeBookmark(articleSlug: string, headingSlug: string) {
  const { userId } = await getAuthenticatedUser();
  if (!userId) return;

  const supabase = await createClient();
  await supabase
    .from("bookmarks")
    .delete()
    .eq("user_id", userId)
    .eq("article_slug", articleSlug)
    .eq("heading_slug", headingSlug);

  revalidatePath("/bookmarks");
  revalidatePath("/roadmap");
}
