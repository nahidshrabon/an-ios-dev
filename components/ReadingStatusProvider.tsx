"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { ReadingStatus } from "@/lib/types";
import { updateReadingStatus } from "@/lib/actions/reading-progress";

type ReadingStatusContextValue = {
  // undefined = still checking auth, null = logged out, string = user id
  userId: string | null | undefined;
  isRead: boolean;
  toggleRead: () => Promise<void>;
};

const ReadingStatusContext = createContext<ReadingStatusContextValue | null>(
  null
);

export function useReadingStatusContext() {
  const ctx = useContext(ReadingStatusContext);
  if (!ctx) {
    throw new Error(
      "useReadingStatusContext must be used within a ReadingStatusProvider"
    );
  }
  return ctx;
}

export function ReadingStatusProvider({
  articleSlug,
  children,
}: {
  articleSlug: string;
  children: ReactNode;
}) {
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [status, setStatus] = useState<ReadingStatus>("unread");

  useEffect(() => {
    let active = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      setUserId(user?.id ?? null);

      if (user) {
        const { data } = await supabase
          .from("reading_progress")
          .select("status")
          .eq("article_slug", articleSlug)
          .maybeSingle();
        if (active && data) {
          setStatus(data.status as ReadingStatus);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [articleSlug, supabase]);

  const isRead = status === "read";

  async function toggleRead() {
    if (!userId) return;
    const next: ReadingStatus = isRead ? "unread" : "read";
    setStatus(next);
    await updateReadingStatus(articleSlug, next);
  }

  return (
    <ReadingStatusContext.Provider value={{ userId, isRead, toggleRead }}>
      {children}
    </ReadingStatusContext.Provider>
  );
}
