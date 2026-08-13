"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SignOutButton } from "@/components/SignOutButton";
import { Logomark } from "@/components/Logomark";
import { ArticleIcon, FlagIcon } from "@/components/Icons";

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
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="font-heading inline-flex items-center gap-2 font-semibold tracking-tight"
        >
          <Logomark className="size-7" />
          <span>
            Become an <span className="text-accent">iOS</span> Developer
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link
            href="/articles"
            className="font-heading inline-flex items-center gap-1.5 hover:underline"
          >
            <ArticleIcon className="size-4 text-accent" />
            Articles
          </Link>
          {userEmail === undefined ? null : userEmail ? (
            <>
              <Link
                href="/roadmap"
                className="font-heading inline-flex items-center gap-1.5 hover:underline"
              >
                <FlagIcon className="size-4 text-accent" />
                Roadmap
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="font-heading hover:underline">
                Log in
              </Link>
              <Link
                href="/signup"
                className="font-heading rounded-full bg-accent px-4 py-1.5 font-medium text-white transition-colors hover:bg-[#0066d6] dark:hover:bg-[#3aa0ff]"
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
