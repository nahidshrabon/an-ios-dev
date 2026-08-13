"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";
import { Logomark } from "@/components/Logomark";
import { FlagIcon } from "@/components/Icons";
import { TestIcon } from "@/components/HowItWorksIcons";

const NAV_ITEMS = [
  { href: "/roadmap", label: "Roadmap", Icon: FlagIcon },
  { href: "/quizzes", label: "Quizzes", Icon: TestIcon },
];

export function AppShell({
  email,
  children,
}: {
  email?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname.startsWith(href);
  }

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/10 md:hidden">
        <Link
          href="/"
          className="font-heading inline-flex items-center gap-2 font-semibold tracking-tight"
        >
          <Logomark className="size-6" />
          Home
        </Link>
        <SignOutButton />
      </div>
      <nav className="flex gap-4 overflow-x-auto border-b border-black/10 px-6 py-3 text-sm dark:border-white/10 md:hidden">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`font-heading inline-flex items-center gap-1.5 whitespace-nowrap ${
              isActive(item.href)
                ? "font-medium text-accent"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            <item.Icon className="size-4 text-accent" />
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-black/10 px-4 py-6 dark:border-white/10 md:sticky md:top-0 md:flex md:h-screen">
        <Link
          href="/"
          className="font-heading inline-flex items-center gap-2 px-2 font-semibold tracking-tight"
        >
          <Logomark className="size-6" />
          Home
        </Link>
        <nav className="mt-6 flex flex-col gap-1 border-t border-black/10 pt-6 dark:border-white/10">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`font-heading flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive(item.href)
                  ? "bg-accent/10 font-medium text-accent"
                  : "text-zinc-600 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/5"
              }`}
            >
              <item.Icon className="size-4 text-accent" />
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
