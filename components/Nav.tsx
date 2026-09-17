"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SignOutButton } from "@/components/SignOutButton";
import { Logomark } from "@/components/Logomark";
import { ArticleIcon, DashboardIcon } from "@/components/Icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SiteSearch } from "@/components/SiteSearch";

export function Nav() {
  const [supabase] = useState(() => createClient());
  // undefined = still checking, null = logged out, string = user's email
  const [userEmail, setUserEmail] = useState<string | null | undefined>(
    undefined
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="font-heading inline-flex items-center gap-2 font-semibold tracking-tight"
          >
            <Logomark className="size-7" />
            <span className="hidden sm:inline">
              an <span className="text-accent">iOS</span> dev
            </span>
          </Link>
          <SiteSearch className="md:w-44" />
        </div>
        <nav className="flex shrink-0 items-center gap-3 text-sm sm:gap-6">
          <ThemeToggle />
          <Link
            href="/articles"
            aria-label="Articles"
            className="font-heading inline-flex items-center gap-1.5 hover:underline"
          >
            <ArticleIcon className="size-4 text-accent" />
            <span className="hidden sm:inline">Articles</span>
          </Link>
          {userEmail === undefined ? null : userEmail ? (
            <>
              <Link
                href="/roadmap"
                className="font-heading inline-flex items-center gap-1.5 hover:underline"
              >
                <DashboardIcon className="size-4 text-accent" />
                Dashboard
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="font-heading whitespace-nowrap hover:underline"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="font-heading whitespace-nowrap rounded-full bg-accent px-3 py-1.5 font-medium text-white transition-colors hover:bg-[#0066d6] sm:px-4 dark:hover:bg-[#3aa0ff]"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
