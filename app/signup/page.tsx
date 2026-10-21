"use client";

import { use, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { OAuthButtons } from "@/components/OAuthButtons";
import { rememberNextPath, safeNextPath } from "@/lib/safe-redirect";

// The searchParams prop rather than useSearchParams: on this otherwise
// static page the hook left the whole form out of the server HTML, so it
// only appeared once JS loaded. The prop renders the page per request instead.
export default function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = use(searchParams);
  return <SignupForm rawNext={typeof next === "string" ? next : undefined} />;
}

function SignupForm({ rawNext }: { rawNext?: string }) {
  const next = safeNextPath(rawNext);
  const nextQuery = rawNext !== undefined ? `?next=${next}` : "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setAlreadyRegistered(false);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    // With email confirmation on, Supabase doesn't say an address is taken:
    // it answers like a new sign-up, but the user has no identities and no
    // email is sent. (With phone confirmation off it errors instead.) This
    // is common after first signing up with Google or GitHub.
    if (
      error?.code === "user_already_exists" ||
      data.user?.identities?.length === 0
    ) {
      setAlreadyRegistered(true);
      return;
    }

    if (error) {
      setError(error.message);
      return;
    }

    // The confirmation link lands on /auth/callback with no ?next=, so
    // opening it in this browser goes on to where the reader was headed.
    rememberNextPath(next);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Check your email
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          We sent a confirmation link to <strong>{email}</strong>. Click it to
          finish creating your account.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Sign up</h1>

      <div className="mt-8">
        <OAuthButtons next={next} />
      </div>

      <div className="my-6 flex items-center gap-3 text-xs text-zinc-500">
        <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
        OR
        <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 dark:border-white/15 dark:bg-transparent"
          />
        </div>
        <div>
          <label htmlFor="password" className="text-sm font-medium">
            Password
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
        {alreadyRegistered && (
          <p className="text-sm text-red-600">
            This email already has an account.{" "}
            <Link href={`/login${nextQuery}`} className="underline">
              Log in
            </Link>{" "}
            instead, or{" "}
            <Link href="/reset-password" className="underline">
              reset your password
            </Link>{" "}
            if you signed up with Google or GitHub and never set one.
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="font-heading mt-2 h-11 rounded-full bg-foreground text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {loading ? "Signing up…" : "Sign up"}
        </button>
      </form>

      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link href={`/login${nextQuery}`} className="underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
