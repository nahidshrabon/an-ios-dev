"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GitHubIcon, GoogleIcon } from "@/components/Icons";

type Provider = "google" | "github";

const PROVIDERS: { id: Provider; label: string; Icon: typeof GoogleIcon }[] = [
  { id: "google", label: "Continue with Google", Icon: GoogleIcon },
  { id: "github", label: "Continue with GitHub", Icon: GitHubIcon },
];

// `next` mirrors the ?next= param the email/password flow already uses —
// preserved through the OAuth round trip so both paths land in the same
// place. /auth/callback needs no changes: it already exchanges the `code`
// param that any Supabase OAuth provider redirects back with.
export function OAuthButtons({ next }: { next?: string }) {
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  async function handleClick(provider: Provider) {
    setLoadingProvider(provider);
    setError(null);

    const redirectTo = new URL("/auth/callback", window.location.origin);
    if (next) redirectTo.searchParams.set("next", next);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectTo.toString() },
    });

    // On success the browser navigates to the provider immediately; this
    // only runs for the failure case.
    if (error) {
      setError(error.message);
      setLoadingProvider(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {PROVIDERS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => handleClick(id)}
          disabled={loadingProvider !== null}
          className="font-heading flex h-11 items-center justify-center gap-2 rounded-full border border-black/10 transition-colors hover:bg-black/[.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-[#1a1a1a]"
        >
          <Icon className="size-4 shrink-0" />
          {loadingProvider === id ? "Redirecting…" : label}
        </button>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
