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

// Articles already marked in progress in this tab. Deliberately module
// scope, not state: it must survive remounts as the reader navigates.
const markedThisSession = new Set<string>();

type ReadingStatusContextValue = {
  // undefined = still loading, null = logged out, string = user id (set only
  // once the article's status is known)
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

      if (!user) {
        setUserId(null);
        return;
      }

      const { data } = await supabase
        .from("reading_progress")
        .select("status")
        .eq("article_slug", articleSlug)
        .maybeSingle();
      if (!active) return;

      const current = (data?.status as ReadingStatus | undefined) ?? "unread";

      // Opening an article you haven't finished is what makes it the one
      // to resume, and re-opening refreshes the timestamp so the roadmap
      // offers the most recent one. Finished articles are left alone.
      //
      // Bouncing between articles in one sitting would otherwise write on
      // every visit; once per article per tab is enough to keep the
      // ordering right without the extra round trips.
      if (current !== "read" && !markedThisSession.has(articleSlug)) {
        markedThisSession.add(articleSlug);
        void updateReadingStatus(articleSlug, "in_progress");
      }
      setStatus(current === "read" ? "read" : "in_progress");

      // Last, because the checkbox only renders once there's a user id.
      // Shown any earlier, a click made while the status loaded was
      // overwritten just above, and the in_progress write then landed after
      // the click's. Now a click's write is always dispatched after that
      // one, and Next runs Server Actions one at a time, in call order.
      setUserId(user.id);
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
