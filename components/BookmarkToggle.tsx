"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BookmarkIcon } from "@/components/Icons";

export function BookmarkToggle({
  articleSlug,
  headingSlug,
  headingTitle,
}: {
  articleSlug: string;
  headingSlug: string;
  headingTitle: string;
}) {
  const [supabase] = useState(() => createClient());
  // undefined = still checking auth, null = logged out, string = user id
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [bookmarked, setBookmarked] = useState(false);

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
          .from("bookmarks")
          .select("id")
          .eq("article_slug", articleSlug)
          .eq("heading_slug", headingSlug)
          .maybeSingle();
        if (active) {
          setBookmarked(!!data);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [articleSlug, headingSlug, supabase]);

  async function toggle() {
    if (!userId) return;
    const next = !bookmarked;
    setBookmarked(next);
    if (next) {
      await supabase.from("bookmarks").insert({
        user_id: userId,
        article_slug: articleSlug,
        heading_slug: headingSlug,
        heading_title: headingTitle,
      });
    } else {
      await supabase
        .from("bookmarks")
        .delete()
        .eq("user_id", userId)
        .eq("article_slug", articleSlug)
        .eq("heading_slug", headingSlug);
    }
  }

  if (!userId) {
    return null;
  }

  return (
    <button
      onClick={toggle}
      title={bookmarked ? "Remove bookmark" : "Bookmark this section"}
      aria-label={bookmarked ? "Remove bookmark" : "Bookmark this section"}
      className={`-m-1 inline-flex shrink-0 items-center justify-center rounded-full p-1 align-middle transition-all hover:scale-110 ${
        bookmarked
          ? "text-accent hover:bg-accent/10"
          : "text-zinc-400 hover:bg-accent/10 hover:text-accent dark:text-zinc-500"
      }`}
    >
      <BookmarkIcon className="size-6" filled={bookmarked} />
    </button>
  );
}
