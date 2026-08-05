"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SignOutButton } from "@/components/SignOutButton";

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
        <Link href="/" className="font-semibold tracking-tight">
          Become an iOS Developer
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/articles" className="hover:underline">
            Articles
          </Link>
          {userEmail === undefined ? null : userEmail ? (
            <>
              <Link href="/dashboard" className="hover:underline">
                Dashboard
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="hover:underline">
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-foreground px-4 py-1.5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
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
