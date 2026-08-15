"use client";

import { useReadingStatusContext } from "@/components/ReadingStatusProvider";
import { CheckIcon } from "@/components/Icons";

export function ArticleTitleReadBadge() {
  const { isRead } = useReadingStatusContext();

  if (!isRead) {
    return null;
  }

  return (
    <span
      role="img"
      aria-label="Read"
      className="ml-2 inline-flex align-middle"
    >
      <CheckIcon className="size-6 text-emerald-600 dark:text-emerald-400" />
    </span>
  );
}
