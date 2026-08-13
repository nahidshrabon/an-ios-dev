"use client";

import { usePathname } from "next/navigation";
import { Nav } from "@/components/Nav";

export function ConditionalNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/roadmap") || pathname.startsWith("/quizzes")) {
    return null;
  }
  return <Nav />;
}
