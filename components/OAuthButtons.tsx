"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GitHubIcon } from "@/components/Icons";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

type Provider = "github";

const PROVIDERS: { id: Provider; label: string; Icon: typeof GitHubIcon }[] = [
  { id: "github", label: "Continue with GitHub", Icon: GitHubIcon },
];

// Deliberately does NOT forward a ?next= param through redirectTo. Every
// call site here wants /roadmap anyway (the login page's own default and
// /auth/callback's fallback both already resolve there), and a callback URL
// carrying its own nested query string is one more thing that has to survive
// unmangled through Supabase's redirect-URL matching and the full
// provider round trip. Keeping this URL as plain as possible removes a
// variable that isn't earning its keep.
export function OAuthButtons() {
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  async function handleClick(provider: Provider) {
    setLoadingProvider(provider);
    setError(null);

    const redirectTo = new URL("/auth/callback", window.location.origin);

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
      <GoogleSignInButton />
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
