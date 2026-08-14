"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";

type BookmarksContextValue = {
  // undefined = still checking auth, null = logged out, string = user id
  userId: string | null | undefined;
  bookmarkedSlugs: Set<string>;
};

const BookmarksContext = createContext<BookmarksContextValue | null>(null);

export function useBookmarksContext() {
  const ctx = useContext(BookmarksContext);
  if (!ctx) {
    throw new Error(
      "useBookmarksContext must be used within a BookmarksProvider"
    );
  }
  return ctx;
}

export function BookmarksProvider({
  articleSlug,
  children,
}: {
  articleSlug: string;
  children: ReactNode;
}) {
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [bookmarkedSlugs, setBookmarkedSlugs] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    let active = true;

    (async () => {
      const [{ data: userData }, { data: rows }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("bookmarks")
          .select("heading_slug")
          .eq("article_slug", articleSlug),
      ]);
      if (!active) return;
      setBookmarkedSlugs(new Set((rows ?? []).map((r) => r.heading_slug)));
      setUserId(userData.user?.id ?? null);
    })();

    return () => {
      active = false;
    };
  }, [articleSlug, supabase]);

  return (
    <BookmarksContext.Provider value={{ userId, bookmarkedSlugs }}>
      {children}
    </BookmarksContext.Provider>
  );
}
