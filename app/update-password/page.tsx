"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [status, setStatus] = useState<"checking" | "ready" | "no-session">(
    "checking"
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    // The reset link's code is exchanged for a session server-side in
    // /auth/callback before this page loads, so a valid session normally
    // already exists. If it doesn't — a link that was expired, already used,
    // or opened in a different browser than it was requested from — there's
    // nothing to update, so send the user back to request a fresh link
    // instead of letting them fill in a password only to hit a raw
    // "Auth session missing!" error on submit.
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setStatus(data.user ? "ready" : "no-session");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (session || event === "PASSWORD_RECOVERY") setStatus("ready");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/roadmap");
    router.refresh();
  }

  if (status === "checking") {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
      </main>
    );
  }

  if (status === "no-session") {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          This link is invalid or expired
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Password reset links can only be used once and expire after a short
          time. Request a new one to continue.
        </p>
        <Link
          href="/reset-password"
          className="font-heading mt-6 inline-flex h-11 items-center justify-center rounded-full bg-foreground px-6 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Request a new link
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Set a new password
      </h1>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <div>
          <label htmlFor="password" className="text-sm font-medium">
            New password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 dark:border-white/15 dark:bg-transparent"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="font-heading mt-2 h-11 rounded-full bg-foreground text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {loading ? "Saving…" : "Save password"}
        </button>
      </form>
    </main>
  );
}
