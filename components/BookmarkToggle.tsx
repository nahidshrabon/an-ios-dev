"use client";

import { useState } from "react";
import { useBookmarksContext } from "@/components/BookmarksProvider";
import { BookmarkIcon, SpinnerIcon } from "@/components/Icons";
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
  const { userId, bookmarkedSlugs } = useBookmarksContext();
  const [override, setOverride] = useState<boolean | null>(null);
  const bookmarked = override ?? bookmarkedSlugs.has(headingSlug);

  async function toggle() {
    if (!userId) return;
    const next = !bookmarked;
    setOverride(next);
    if (next) {
      await addBookmark(articleSlug, headingSlug, headingTitle);
    } else {
      await removeBookmark(articleSlug, headingSlug);
    }
  }

  if (userId === undefined) {
    return (
      <span className="-m-1 inline-flex shrink-0 items-center justify-center p-1 align-middle text-zinc-300 dark:text-zinc-600">
        <SpinnerIcon className="size-6 animate-spin" />
      </span>
    );
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
