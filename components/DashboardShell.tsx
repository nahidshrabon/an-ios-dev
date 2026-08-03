"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/roadmap", label: "Roadmap" },
  { href: "/dashboard/progress", label: "Articles" },
  { href: "/dashboard/quizzes", label: "Quizzes" },
  { href: "/dashboard/quizzes/history", label: "Quiz History" },
];

export function DashboardShell({
  email,
  children,
}: {
  email?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/10 md:hidden">
        <Link href="/" className="font-semibold tracking-tight">
          Home
        </Link>
        <SignOutButton />
      </div>
      <nav className="flex gap-4 overflow-x-auto border-b border-black/10 px-6 py-3 text-sm dark:border-white/10 md:hidden">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap ${
              isActive(item.href)
                ? "font-medium text-foreground"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-black/10 px-4 py-6 dark:border-white/10 md:sticky md:top-0 md:flex md:h-screen">
        <Link href="/" className="px-2 font-semibold tracking-tight">
          Home
        </Link>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive(item.href)
                  ? "bg-black/5 font-medium text-foreground dark:bg-white/10"
                  : "text-zinc-600 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/5"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3 border-t border-black/10 pt-4 dark:border-white/10">
          {email && (
            <span className="truncate px-3 text-sm text-zinc-600 dark:text-zinc-400">
              {email}
            </span>
          )}
          <div className="px-3">
            <SignOutButton />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 px-6 py-8 md:px-10 md:py-10">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
