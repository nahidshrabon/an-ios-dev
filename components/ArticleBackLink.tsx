"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function ArticleBackLink() {
  const searchParams = useSearchParams();
  const fromRoadmap = searchParams.get("from") === "roadmap";

  const href = fromRoadmap ? "/dashboard/roadmap" : "/articles";
  const label = fromRoadmap ? "← Roadmap" : "← All articles";

  return (
    <Link
      href={href}
      className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
    >
      {label}
    </Link>
  );
}
