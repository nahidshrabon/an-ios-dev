"use client";

import { useEffect, useRef, useState } from "react";
import { useBookmarksContext } from "@/components/BookmarksProvider";
import { BookmarkIcon, SpinnerIcon } from "@/components/Icons";
import { addBookmark, removeBookmark } from "@/lib/actions/bookmarks";

const SAVE_FAILED = "Couldn't save the bookmark. Try again.";

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
  const [failed, setFailed] = useState(false);
  // Clicks during a save are ignored: reverting a failed save to the value
  // before its click is only right if no later click is still in flight.
  const saving = useRef(false);
  const bookmarked = override ?? bookmarkedSlugs.has(headingSlug);

  useEffect(() => {
    if (!failed) return;
    const timer = setTimeout(() => setFailed(false), 4000);
    return () => clearTimeout(timer);
  }, [failed]);

  async function toggle() {
    if (!userId || saving.current) return;
    saving.current = true;
    const next = !bookmarked;
    setOverride(next);
    setFailed(false);

    const result = await (next
      ? addBookmark(articleSlug, headingSlug, headingTitle)
      : removeBookmark(articleSlug, headingSlug)
    ).catch(() => ({ ok: false as const }));

    saving.current = false;
    if (!result.ok) {
      setOverride(!next);
      setFailed(true);
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

  const label = failed
    ? SAVE_FAILED
    : bookmarked
      ? "Remove bookmark"
      : "Bookmark this section";

  return (
    <button
      onClick={toggle}
      title={label}
      aria-label={label}
      className={`-m-1 inline-flex shrink-0 items-center justify-center rounded-full p-1 align-middle transition-all hover:scale-110 ${
        failed
          ? "text-red-600 hover:bg-red-600/10"
          : bookmarked
            ? "text-accent hover:bg-accent/10"
            : "text-zinc-400 hover:bg-accent/10 hover:text-accent dark:text-zinc-500"
      }`}
    >
      <BookmarkIcon className="size-6" filled={bookmarked} />
    </button>
  );
}
