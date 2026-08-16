"use client";

import Link from "next/link";
import { useReadingStatusContext } from "@/components/ReadingStatusProvider";

export function ReadingStatusControl() {
  const { userId, isRead, toggleRead } = useReadingStatusContext();

  if (userId === undefined) {
    return null;
  }

  if (userId === null) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        <Link href="/signup" className="underline">
          Sign up
        </Link>{" "}
        to mark this article as read.
      </p>
    );
  }

  return (
    <label className="font-heading inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
      <input
        type="checkbox"
        checked={isRead}
        onChange={toggleRead}
        className="size-4 accent-emerald-600 dark:accent-emerald-400"
      />
      {isRead ? "Read" : "Mark as read"}
    </label>
  );
}
