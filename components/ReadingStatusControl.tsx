"use client";

import Link from "next/link";
import { useReadingStatusContext } from "@/components/ReadingStatusProvider";

export function ReadingStatusControl({
  className,
  hideSignupPrompt = false,
}: {
  className?: string;
  hideSignupPrompt?: boolean;
}) {
  const { userId, isRead, saveFailed, toggleRead } = useReadingStatusContext();

  if (userId === undefined) {
    return null;
  }

  if (userId === null) {
    if (hideSignupPrompt) {
      return null;
    }
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
    <label
      className={`font-heading inline-flex cursor-pointer items-center gap-2 text-sm font-medium ${
        saveFailed
          ? "text-red-600"
          : isRead
            ? "text-emerald-600 dark:text-emerald-400"
            : ""
      } ${className ?? ""}`}
    >
      <input
        type="checkbox"
        checked={isRead}
        onChange={toggleRead}
        className="size-5 shrink-0 self-center accent-emerald-600 dark:accent-emerald-400"
      />
      {saveFailed
        ? "Couldn't save. Try again."
        : isRead
          ? "Read"
          : "Mark as read"}
    </label>
  );
}
