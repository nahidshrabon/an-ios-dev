"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { OAuthButtons } from "@/components/OAuthButtons";
import { safeNextPath } from "@/lib/safe-redirect";

// The messages behind the ?error= codes that /auth/callback sends. The text
// is never read from the URL: any other value shows nothing, so a crafted
// /login?error= link can't put its own words on the real login page. A Map,
// not an object, so "constructor" or "__proto__" can't match a prototype key.
const CALLBACK_ERRORS = new Map([
  [
    "link_other_browser",
    "That link was opened in a different browser than the one it was requested from. If you were confirming a new account, it's confirmed — just log in. If you were resetting your password, request a new link and open it in this browser.",
  ],
  [
    "link_invalid",
    "That link couldn't be verified. It may have expired or already been used, or it was opened in a different browser than the one you requested it from. Request a new link and open it in the same browser.",
  ],
  [
    "link_used",
    "That link was already used (often by your email app scanning it for safety). If you just signed up, your email is likely already confirmed — try logging in.",
  ],
  ["auth_failed", "Could not authenticate"],
]);

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Validated: router.push follows an absolute or //host URL off-site.
  const next = safeNextPath(searchParams.get("next"));
  const nextQuery = searchParams.has("next") ? `?next=${next}` : "";
  const urlError = CALLBACK_ERRORS.get(searchParams.get("error") ?? "") ?? null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(urlError);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Log in</h1>

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
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>

      <div className="mt-6 flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <Link href="/reset-password" className="hover:underline">
          Forgot your password?
        </Link>
        <p>
          Don&apos;t have an account?{" "}
          <Link href={`/signup${nextQuery}`} className="underline">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
