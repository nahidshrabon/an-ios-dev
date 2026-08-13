"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeftIcon } from "@/components/Icons";

export function ArticleBackLink() {
  const searchParams = useSearchParams();
  const fromRoadmap = searchParams.get("from") === "roadmap";

  const href = fromRoadmap ? "/roadmap" : "/articles";
  const label = fromRoadmap ? "Roadmap" : "All articles";

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-base font-medium text-zinc-600 hover:text-foreground dark:text-zinc-400"
    >
      <ArrowLeftIcon className="size-4" />
      {label}
    </Link>
  );
}
