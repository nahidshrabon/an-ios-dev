"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOutIcon } from "@/components/Icons";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="font-heading inline-flex items-center gap-1.5 text-sm text-zinc-600 hover:underline dark:text-zinc-400"
    >
      <LogOutIcon className="size-4 text-accent" />
      Log out
    </button>
  );
}
