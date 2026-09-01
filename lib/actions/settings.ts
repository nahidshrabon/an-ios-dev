"use server";

import { revalidatePath } from "next/cache";
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";

export type ResetResult = { ok: true } | { ok: false; error: string };

async function getUserId() {
  const { userId } = await getAuthenticatedUser();
  return userId;
}

export async function resetRoadmapProgress(): Promise<ResetResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  // Article read status auto-completes roadmap sections, so it's cleared
  // alongside manually-checked sections — otherwise "reset" would leave
  // read-derived checkmarks in place.
  const [roadmap, reading] = await Promise.all([
    supabase.from("roadmap_progress").delete().eq("user_id", userId),
    supabase.from("reading_progress").delete().eq("user_id", userId),
  ]);
  const error = roadmap.error ?? reading.error;
  if (error) return { ok: false, error: error.message };

  revalidatePath("/roadmap");
  revalidatePath("/settings");
  return { ok: true };
}

export async function resetQuizHistory(): Promise<ResetResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("quiz_attempts")
    .delete()
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/quizzes");
  revalidatePath("/settings");
  return { ok: true };
}

export async function resetBookmarks(): Promise<ResetResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/bookmarks");
  revalidatePath("/settings");
  return { ok: true };
}

export async function resetAllProgress(): Promise<ResetResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const [roadmap, reading, quizzes, bookmarks] = await Promise.all([
    supabase.from("roadmap_progress").delete().eq("user_id", userId),
    supabase.from("reading_progress").delete().eq("user_id", userId),
    supabase.from("quiz_attempts").delete().eq("user_id", userId),
    supabase.from("bookmarks").delete().eq("user_id", userId),
  ]);
  const error =
    roadmap.error ?? reading.error ?? quizzes.error ?? bookmarks.error;
  if (error) return { ok: false, error: error.message };

  revalidatePath("/roadmap");
  revalidatePath("/quizzes");
  revalidatePath("/bookmarks");
  revalidatePath("/settings");
  return { ok: true };
}
