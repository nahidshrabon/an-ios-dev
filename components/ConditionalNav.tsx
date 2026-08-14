"use client";

import { usePathname } from "next/navigation";
import { Nav } from "@/components/Nav";

export function ConditionalNav() {
  const pathname = usePathname();
  if (
    pathname.startsWith("/roadmap") ||
    pathname.startsWith("/quizzes") ||
    pathname.startsWith("/bookmarks")
  ) {
    return null;
  }
  return <Nav />;
}
