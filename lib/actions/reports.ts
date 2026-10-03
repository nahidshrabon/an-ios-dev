"use server";

import { revalidatePath } from "next/cache";
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";
import {
  MESSAGE_MAX,
  MESSAGE_MIN,
  PAGE_URL_MAX,
  REPORT_CATEGORIES,
  type ReportResult,
} from "@/lib/reports";

const REPORTS_PER_HOUR = 5;

export async function submitReport(
  _prevState: ReportResult,
  formData: FormData,
): Promise<ReportResult> {
  const { userId, email } = await getAuthenticatedUser();
  if (!userId) return { ok: false, error: "Please sign in to send a report." };

  const category = String(formData.get("category") ?? "");
  const message = String(formData.get("message") ?? "").trim();
  const pageUrl = String(formData.get("page_url") ?? "").trim();

  if (!REPORT_CATEGORIES.some((c) => c.value === category)) {
    return { ok: false, error: "Choose what kind of problem this is." };
  }
  if (message.length < MESSAGE_MIN) {
    return {
      ok: false,
      error: `Please describe the problem in at least ${MESSAGE_MIN} characters.`,
    };
  }
  if (message.length > MESSAGE_MAX) {
    return {
      ok: false,
      error: `Please keep it under ${MESSAGE_MAX} characters.`,
    };
  }
  if (pageUrl.length > PAGE_URL_MAX) {
    return { ok: false, error: "That page location is too long." };
  }

  const supabase = await createClient();

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("problem_reports")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  if (countError) {
    return { ok: false, error: "Couldn't send your report. Please try again." };
  }
  if ((count ?? 0) >= REPORTS_PER_HOUR) {
    return {
      ok: false,
      error: "You've sent several reports recently. Please try again later.",
    };
  }

  const { error } = await supabase.from("problem_reports").insert({
    user_id: userId,
    email: email ?? null,
    category,
    page_url: pageUrl || null,
    message,
  });

  if (error) {
    return { ok: false, error: "Couldn't send your report. Please try again." };
  }

  revalidatePath("/report");
  return { ok: true };
}
