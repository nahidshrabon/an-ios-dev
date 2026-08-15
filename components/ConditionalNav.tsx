"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Nav } from "@/components/Nav";

export function ConditionalNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [supabase] = useState(() => createClient());
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setLoggedIn(!!data.user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  if (
    pathname.startsWith("/roadmap") ||
    pathname.startsWith("/quizzes") ||
    pathname.startsWith("/bookmarks") ||
    pathname.startsWith("/settings")
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
        <Nav />
      </div>
    );
  }

  return <Nav />;
}
