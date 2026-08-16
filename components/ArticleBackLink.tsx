"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeftIcon } from "@/components/Icons";

export function ArticleBackLink() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromRoadmap = searchParams.get("from") === "roadmap";

  const href = fromRoadmap ? "/roadmap" : "/articles";
  const label = fromRoadmap ? "Roadmap" : "All articles";

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    // Modifier clicks (open in new tab, etc.) fall through to the plain
    // href. A normal click uses real browser back navigation instead of a
    // fresh push, so the previous page's scroll position is restored.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    router.back();
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 text-base font-medium text-zinc-600 hover:text-foreground dark:text-zinc-400"
    >
      <ChevronLeftIcon className="size-4" />
      {label}
    </Link>
  );
}
