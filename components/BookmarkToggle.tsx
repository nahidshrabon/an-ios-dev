"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BookmarkIcon } from "@/components/Icons";
import { addBookmark, removeBookmark } from "@/lib/actions/bookmarks";

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
      const [{ data: userData }, { data: existing }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("bookmarks")
          .select("id")
          .eq("article_slug", articleSlug)
          .eq("heading_slug", headingSlug)
          .maybeSingle(),
      ]);
      if (!active) return;
      // Set both together so the button never renders an intermediate
      // "not bookmarked" frame before flipping to its real state.
      setBookmarked(!!existing);
      setUserId(userData.user?.id ?? null);
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
      await addBookmark(articleSlug, headingSlug, headingTitle);
    } else {
      await removeBookmark(articleSlug, headingSlug);
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
