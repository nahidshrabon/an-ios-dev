"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function GetStartedButton() {
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

  return (
    <Link
      href={loggedIn ? "/roadmap" : "/signup"}
      className="font-heading flex h-12 items-center justify-center rounded-full bg-accent px-6 font-medium text-white transition-colors hover:bg-[#0066d6] dark:hover:bg-[#3aa0ff]"
    >
      Get started
    </Link>
  );
}
