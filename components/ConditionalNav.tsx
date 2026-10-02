"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Nav } from "@/components/Nav";

export function ConditionalNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [supabase] = useState(() => createClient());
  // Owned here and handed to Nav, so one subscription serves both rather
  // than each component opening its own.
  // undefined = still checking, null = logged out, string = user's email
  const [userEmail, setUserEmail] = useState<string | null | undefined>(
    undefined,
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

  const loggedIn = userEmail != null;

  if (
    pathname.startsWith("/roadmap") ||
    pathname.startsWith("/quizzes") ||
    pathname.startsWith("/bookmarks") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/report") ||
    // About renders its own chrome: AppShell with a session, Nav without.
    // Deciding here instead would flash both while auth resolves.
    pathname.startsWith("/about")
  ) {
    return null;
  }

  // Article pages get the AppShell sidebar instead of the top nav, but only
  // when arriving from the roadmap and only once logged in — direct/listing
  // visits and logged-out readers still get the plain top nav. On mobile the
  // slim top nav stays instead of the sidebar so article content isn't
  // squeezed by the app-shell mobile chrome.
  const fromRoadmap =
    pathname.startsWith("/articles/") && searchParams.get("from") === "roadmap";

  if (fromRoadmap && loggedIn) {
    return (
      <div className="md:hidden">
        <Nav userEmail={userEmail} />
      </div>
    );
  }

  return <Nav userEmail={userEmail} />;
}
