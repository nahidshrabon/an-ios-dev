"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  READING_STATUSES,
  READING_STATUS_LABELS,
  type ReadingStatus,
} from "@/lib/types";

export function ReadingStatusControl({ slug }: { slug: string }) {
  const [supabase] = useState(() => createClient());
  // undefined = still checking auth, null = logged out, string = user id
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [status, setStatus] = useState<ReadingStatus>("unread");

  useEffect(() => {
    let active = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      setUserId(user?.id ?? null);

      if (user) {
        const { data } = await supabase
          .from("reading_progress")
          .select("status")
          .eq("article_slug", slug)
          .maybeSingle();
        if (active && data) {
          setStatus(data.status as ReadingStatus);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [slug, supabase]);

  async function updateStatus(next: ReadingStatus) {
    if (!userId) return;
    setStatus(next);
    await supabase.from("reading_progress").upsert({
      user_id: userId,
      article_slug: slug,
      status: next,
      updated_at: new Date().toISOString(),
    });
  }

  if (userId === undefined) {
    return null;
  }

  if (userId === null) {
    return (
      <div className="mt-12 rounded-xl border border-black/10 p-5 dark:border-white/10">
        <p className="font-heading font-medium">Track your progress</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/signup" className="underline">
            Sign up
          </Link>{" "}
          to mark this article as read and pick up where you left off on any
          device.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-12 rounded-xl border border-black/10 p-5 dark:border-white/10">
      <p className="font-medium">Track your progress</p>
      <div className="mt-3 flex gap-2">
        {READING_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => updateStatus(s)}
            className={`font-heading rounded-full px-3 py-1 text-sm transition-colors ${
              status === s
                ? "bg-foreground text-background"
                : "bg-black/5 text-zinc-600 hover:bg-black/10 dark:bg-white/10 dark:text-zinc-400 dark:hover:bg-white/15"
            }`}
          >
            {READING_STATUS_LABELS[s]}
          </button>
        ))}
      </div>
    </div>
  );
}
