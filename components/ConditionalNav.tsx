"use client";

import { usePathname } from "next/navigation";
import { Nav } from "@/components/Nav";

export function ConditionalNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/dashboard")) {
    return null;
  }
  return <Nav />;
}
